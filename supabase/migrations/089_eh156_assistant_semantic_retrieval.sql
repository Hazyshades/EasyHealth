-- EH-156: profile-scoped semantic document retrieval.
-- Source text remains service-role-only and is removed with its document.

create extension if not exists vector with schema extensions;

create table if not exists public.assistant_document_chunks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  document_page_id uuid references public.document_pages(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  chunk_index integer not null check (chunk_index >= 0),
  section_context text,
  content text not null check (length(btrim(content)) > 0 and length(content) <= 12000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  embedding extensions.vector(1536) not null,
  embedding_provider text not null,
  embedding_model text not null,
  source_write_generation bigint not null default 0,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, page_number, chunk_index, content_sha256)
);

create index if not exists assistant_document_chunks_profile_current_idx
  on public.assistant_document_chunks (profile_id, is_current, document_id);
create index if not exists assistant_document_chunks_document_page_idx
  on public.assistant_document_chunks (document_id, page_number, chunk_index);
create index if not exists assistant_document_chunks_embedding_hnsw_idx
  on public.assistant_document_chunks
  using hnsw (embedding vector_cosine_ops)
  where is_current;

create table if not exists public.assistant_reindex_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  requested_content_sha256 text not null check (requested_content_sha256 ~ '^[0-9a-f]{64}$'),
  requested_write_generation bigint not null default 0,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'stale')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  error_code text,
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_reindex_jobs_status_idx
  on public.assistant_reindex_jobs (status, created_at);
create index if not exists assistant_reindex_jobs_document_idx
  on public.assistant_reindex_jobs (document_id, created_at desc);
create unique index if not exists assistant_reindex_jobs_active_document_idx
  on public.assistant_reindex_jobs (document_id)
  where status in ('queued', 'processing');

alter table public.assistant_document_chunks enable row level security;
alter table public.assistant_reindex_jobs enable row level security;

revoke all on table public.assistant_document_chunks from public, anon, authenticated;
revoke all on table public.assistant_reindex_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.assistant_document_chunks to service_role;
grant select, insert, update, delete on table public.assistant_reindex_jobs to service_role;

drop policy if exists "service_all_assistant_document_chunks" on public.assistant_document_chunks;
create policy "service_all_assistant_document_chunks"
  on public.assistant_document_chunks for all to service_role using (true) with check (true);
drop policy if exists "service_all_assistant_reindex_jobs" on public.assistant_reindex_jobs;
create policy "service_all_assistant_reindex_jobs"
  on public.assistant_reindex_jobs for all to service_role using (true) with check (true);

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

create or replace function public.claim_assistant_reindex_job()
returns table (
  id uuid,
  profile_id uuid,
  document_id uuid,
  requested_content_sha256 text,
  requested_write_generation bigint
)
language sql
security definer
set search_path = public
as $$
  with next_job as (
    select job.id
    from public.assistant_reindex_jobs as job
    where job.status = 'queued'
      and job.attempts < job.max_attempts
    order by job.created_at, job.id
    for update skip locked
    limit 1
  )
  update public.assistant_reindex_jobs as job
  set status = 'processing',
      attempts = job.attempts + 1,
      claimed_at = now(),
      updated_at = now()
  from next_job
  where job.id = next_job.id
  returning
    job.id,
    job.profile_id,
    job.document_id,
    job.requested_content_sha256,
    job.requested_write_generation;
$$;

create or replace function public.complete_assistant_reindex_job(p_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.assistant_reindex_jobs
  set status = 'completed',
      finished_at = now(),
      updated_at = now(),
      error_code = null
  where id = p_job_id
    and status = 'processing';
$$;

create or replace function public.fail_assistant_reindex_job(
  p_job_id uuid,
  p_error_code text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.assistant_reindex_jobs
  set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
      finished_at = case when attempts >= max_attempts then now() else null end,
      updated_at = now(),
      error_code = case
        when p_error_code in (
          'assistant_reindex_source_unavailable',
          'assistant_reindex_source_stale',
          'assistant_embedding_provider_unavailable',
          'assistant_embedding_count_mismatch'
        ) then p_error_code
        else 'assistant_reindex_failed'
      end
  where id = p_job_id
    and status = 'processing';
$$;
create or replace function public.mark_assistant_reindex_job_stale(p_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.assistant_reindex_jobs
  set status = 'stale',
      finished_at = now(),
      updated_at = now(),
      error_code = 'assistant_reindex_source_stale'
  where id = p_job_id
    and status = 'processing';
$$;

revoke all on function public.mark_assistant_reindex_job_stale(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_assistant_reindex_job_stale(uuid)
  to service_role;


revoke all on function public.claim_assistant_reindex_job() from public, anon, authenticated;
revoke all on function public.complete_assistant_reindex_job(uuid) from public, anon, authenticated;
revoke all on function public.fail_assistant_reindex_job(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_assistant_reindex_job() to service_role;
grant execute on function public.complete_assistant_reindex_job(uuid) to service_role;
grant execute on function public.fail_assistant_reindex_job(uuid, text) to service_role;

comment on table public.assistant_document_chunks is
  'Profile-scoped page-anchored semantic evidence. Service role only; cascades with source documents.';
comment on table public.assistant_reindex_jobs is
  'Idempotent semantic index work queue. Job rows contain metadata, never prompt or answer text.';
