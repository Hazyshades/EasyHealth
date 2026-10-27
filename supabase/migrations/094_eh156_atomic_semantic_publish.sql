-- EH-156: publish semantic chunks behind a document-generation fence.
-- The worker must not delete the previous index before the guarded publish succeeds.

create or replace function public.publish_assistant_reindex_chunks(
  p_job_id uuid,
  p_profile_id uuid,
  p_document_id uuid,
  p_requested_content_sha256 text,
  p_requested_write_generation bigint,
  p_chunks jsonb,
  p_embedding_provider text,
  p_embedding_model text
)
returns table (
  status text,
  chunk_count integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_document public.documents%rowtype;
  v_chunk_count integer := 0;
  v_source_hash text;
  v_chunks jsonb := coalesce(p_chunks, '[]'::jsonb);
begin
  if p_profile_id is null
    or p_document_id is null
    or p_job_id is null
    or p_requested_content_sha256 is null
    or p_requested_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_requested_write_generation is null
    or p_embedding_provider is null
    or btrim(p_embedding_provider) = ''
    or p_embedding_model is null
    or btrim(p_embedding_model) = ''
    or jsonb_typeof(v_chunks) is distinct from 'array' then
    raise exception using message = 'assistant_reindex_publish_input_invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_chunks) as entry(value)
    where jsonb_typeof(entry.value) is distinct from 'object'
      or (entry.value ->> 'document_page_id') is null
      or (entry.value ->> 'page_number')::integer <= 0
      or (entry.value ->> 'chunk_index')::integer < 0
      or (entry.value ->> 'content') is null
      or (entry.value ->> 'content_sha256') is null
      or (entry.value ->> 'content_sha256') !~ '^[0-9a-f]{64}$'
      or coalesce(jsonb_typeof(entry.value -> 'embedding'), 'null') is distinct from 'string'
      or not exists (
        select 1
        from public.document_pages as page
        where page.id = (entry.value ->> 'document_page_id')::uuid
          and page.document_id = p_document_id
          and page.profile_id = p_profile_id
      )
  ) then
    raise exception using message = 'assistant_reindex_publish_chunk_invalid';
  end if;

  select *
    into v_document
  from public.documents
  where id = p_document_id
    and profile_id = p_profile_id
  for update;

  if not found
    or v_document.lifecycle_state is distinct from 'active'
    or v_document.upload_state is distinct from 'complete'
    or v_document.archived_at is not null
    or v_document.write_generation is distinct from p_requested_write_generation
    or not (
      v_document.processing_status in ('ready', 'needs_review')
      or v_document.status = 'completed'
    ) then
    update public.assistant_reindex_jobs as job
    set status = 'stale',
        finished_at = now(),
        updated_at = now(),
        error_code = 'assistant_reindex_source_stale'
    where job.id = p_job_id
      and job.profile_id = p_profile_id
      and job.document_id = p_document_id
      and job.status = 'processing';
    return query select 'stale'::text, 0;
    return;
  end if;
  with page_text as (
    select
      page.page_number,
      coalesce(
        (
          select string_agg(normalized.paragraph, E'\n\n' order by normalized.ordinality)
          from (
            select
              btrim(regexp_replace(paragraph.value, '\s+', ' ', 'g')) as paragraph,
              paragraph.ordinality
            from regexp_split_to_table(
              replace(replace(coalesce(page.ocr_text, ''), E'\r\n', E'\n'), E'\r', E'\n'),
              E'\n{2,}'
            ) with ordinality as paragraph(value, ordinality)
          ) as normalized
          where normalized.paragraph <> ''
        ),
        ''
      ) as normalized_text
    from public.document_pages as page
    where page.document_id = p_document_id
      and page.profile_id = p_profile_id
      and page.is_current
  )
  select encode(
    extensions.digest(
      convert_to(
        coalesce(
          string_agg(
            page_number::text || ':' || normalized_text,
            E'\n' order by page_number
          ),
          ''
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  into v_source_hash
  from page_text;

  if v_source_hash is distinct from p_requested_content_sha256 then
    update public.assistant_reindex_jobs as job
    set status = 'stale',
        finished_at = now(),
        updated_at = now(),
        error_code = 'assistant_reindex_source_stale'
    where job.id = p_job_id
      and job.profile_id = p_profile_id
      and job.document_id = p_document_id
      and job.status = 'processing';
    return query select 'stale'::text, 0;
    return;
  end if;


  if not exists (
    select 1
    from public.assistant_reindex_jobs as job
    where job.id = p_job_id
      and job.profile_id = p_profile_id
      and job.document_id = p_document_id
      and job.requested_content_sha256 = p_requested_content_sha256
      and job.requested_write_generation = p_requested_write_generation
      and job.status = 'processing'
  ) then
    raise exception using message = 'assistant_reindex_job_invalid';
  end if;

  delete from public.assistant_document_chunks
  where profile_id = p_profile_id
    and document_id = p_document_id;

  insert into public.assistant_document_chunks (
    profile_id,
    document_id,
    document_page_id,
    page_number,
    chunk_index,
    section_context,
    content,
    content_sha256,
    embedding,
    embedding_provider,
    embedding_model,
    source_write_generation,
    is_current
  )
  select
    p_profile_id,
    p_document_id,
    (entry.value ->> 'document_page_id')::uuid,
    (entry.value ->> 'page_number')::integer,
    (entry.value ->> 'chunk_index')::integer,
    nullif(entry.value ->> 'section_context', ''),
    entry.value ->> 'content',
    entry.value ->> 'content_sha256',
    (entry.value ->> 'embedding')::extensions.vector(1536),
    p_embedding_provider,
    p_embedding_model,
    p_requested_write_generation,
    true
  from jsonb_array_elements(v_chunks) as entry(value);

  get diagnostics v_chunk_count = row_count;
  return query select 'published'::text, v_chunk_count;
end;
$$;

revoke all on function public.publish_assistant_reindex_chunks(
  uuid,
  uuid,
  uuid,
  text,
  bigint,
  jsonb,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.publish_assistant_reindex_chunks(
  uuid,
  uuid,
  uuid,
  text,
  bigint,
  jsonb,
  text,
  text
) to service_role;

create or replace function public.match_assistant_document_chunks(
  p_profile_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 8,
  p_min_similarity double precision default 0.72,
  p_document_ids uuid[] default null,
  p_document_types text[] default null,
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  chunk_id uuid,
  profile_id uuid,
  document_id uuid,
  page_number integer,
  chunk_index integer,
  section_context text,
  content text,
  content_sha256 text,
  similarity double precision,
  original_filename text,
  document_type text,
  observed_at date
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    chunk.id,
    chunk.profile_id,
    chunk.document_id,
    chunk.page_number,
    chunk.chunk_index,
    chunk.section_context,
    chunk.content,
    chunk.content_sha256,
    1 - (chunk.embedding <=> p_query_embedding) as similarity,
    document.original_filename,
    document.document_type,
    document.observed_at
  from public.assistant_document_chunks as chunk
  join public.documents as document
    on document.id = chunk.document_id
   and document.profile_id = p_profile_id
   and document.lifecycle_state = 'active'
   and document.upload_state = 'complete'
   and document.archived_at is null
   and (
     document.processing_status in ('ready', 'needs_review')
     or document.status = 'completed'
   )
   and chunk.source_write_generation = document.write_generation
  where chunk.profile_id = p_profile_id
    and chunk.is_current
    and (
      p_document_ids is null
      or cardinality(p_document_ids) = 0
      or chunk.document_id = any(p_document_ids)
    )
    and (
      p_document_types is null
      or cardinality(p_document_types) = 0
      or document.document_type = any(p_document_types)
    )
    and (p_start_date is null or document.observed_at >= p_start_date)
    and (p_end_date is null or document.observed_at <= p_end_date)
    and 1 - (chunk.embedding <=> p_query_embedding) >= coalesce(p_min_similarity, 0.72)
  order by chunk.embedding <=> p_query_embedding, chunk.page_number, chunk.chunk_index
  limit least(greatest(coalesce(p_match_count, 8), 1), 24);
$$;

revoke all on function public.match_assistant_document_chunks(
  uuid,
  extensions.vector(1536),
  integer,
  double precision,
  uuid[],
  text[],
  date,
  date
) from public, anon, authenticated;
grant execute on function public.match_assistant_document_chunks(
  uuid,
  extensions.vector(1536),
  integer,
  double precision,
  uuid[],
  text[],
  date,
  date
) to service_role;

notify pgrst, 'reload schema';
