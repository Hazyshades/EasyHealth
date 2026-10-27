-- EH-156: semantic retrieval storage, ownership, index, and worker RPC contract.
begin;
select plan(37);

select ok(
  exists (select 1 from pg_extension where extname = 'vector'),
  'pgvector extension is installed'
);
select has_table('public', 'assistant_document_chunks', 'assistant chunk table exists');
select has_table('public', 'assistant_reindex_jobs', 'assistant reindex job table exists');
select has_column('public', 'assistant_document_chunks', 'profile_id', 'chunk ownership is explicit');
select has_column('public', 'assistant_document_chunks', 'document_id', 'chunk document identity is explicit');
select has_column('public', 'assistant_document_chunks', 'embedding', 'chunk embedding is stored');
select has_column('public', 'assistant_document_chunks', 'content_sha256', 'chunk content hash is stored');
select has_column('public', 'assistant_reindex_jobs', 'requested_write_generation', 'reindex generation is stored');
select has_column('public', 'assistant_reindex_jobs', 'status', 'reindex status is stored');
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assistant_document_chunks'
      and indexdef ilike '%using hnsw%'
  ),
  'semantic chunks have an HNSW vector index'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assistant_document_chunks'::regclass
      and confrelid = 'public.documents'::regclass
      and confdeltype = 'c'
  ),
  'document deletion cascades to semantic chunks'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assistant_document_chunks'::regclass
      and confrelid = 'public.profiles'::regclass
      and confdeltype = 'c'
  ),
  'profile deletion cascades to semantic chunks'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assistant_reindex_jobs'::regclass
      and confrelid = 'public.documents'::regclass
      and confdeltype = 'c'
  ),
  'document deletion cascades to reindex jobs'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assistant_reindex_jobs'
      and indexdef ilike '%unique%'
      and indexdef ilike '%where%'
      and indexdef ilike '%document_id%'
  ),
  'only one active reindex job is permitted per document'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_document_chunks'::regclass),
  'chunk RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_reindex_jobs'::regclass),
  'reindex job RLS is enabled'
);
select ok(
  has_table_privilege('service_role', 'public.assistant_document_chunks', 'SELECT'),
  'service role can read assistant chunks'
);
select ok(
  not has_table_privilege('authenticated', 'public.assistant_document_chunks', 'SELECT'),
  'authenticated role cannot read assistant chunks directly'
);
select ok(
  not has_table_privilege('anon', 'public.assistant_document_chunks', 'SELECT'),
  'anon role cannot read assistant chunks directly'
);
select ok(
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'match_assistant_document_chunks'),
  'semantic match RPC exists'
);
select ok(
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'claim_assistant_reindex_job'),
  'reindex claim RPC exists'
);
select ok(
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'complete_assistant_reindex_job'),
  'reindex completion RPC exists'
);
select ok(
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fail_assistant_reindex_job'),
  'reindex failure RPC exists'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'publish_assistant_reindex_chunks'
  ),
  'atomic semantic publish RPC exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.publish_assistant_reindex_chunks(uuid,uuid,uuid,text,bigint,jsonb,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'service role can publish semantic chunks'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.publish_assistant_reindex_chunks(uuid,uuid,uuid,text,bigint,jsonb,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated role cannot publish semantic chunks'
);
select ok(
  pg_get_functiondef(
    'public.match_assistant_document_chunks(uuid,extensions.vector,integer,double precision,uuid[],text[],date,date)'::regprocedure
  ) ilike '%source_write_generation = document.write_generation%',
  'semantic match excludes stale source generations'
);
select ok(
  has_function_privilege('service_role', 'public.match_assistant_document_chunks(uuid,extensions.vector,integer,double precision,uuid[],text[],date,date)'::regprocedure, 'EXECUTE'),
  'service role can execute semantic match RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.match_assistant_document_chunks(uuid,extensions.vector,integer,double precision,uuid[],text[],date,date)'::regprocedure, 'EXECUTE'),
  'authenticated role cannot execute semantic match RPC'
);
select ok(
  has_function_privilege('service_role', 'public.claim_assistant_reindex_job()'::regprocedure, 'EXECUTE'),
  'service role can claim reindex jobs'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_assistant_reindex_job()'::regprocedure, 'EXECUTE'),
  'authenticated role cannot claim reindex jobs'
);

insert into public.profiles (id)
values ('00000000-0000-0000-0000-000000156001')
on conflict do nothing;

insert into public.documents (
  id,
  profile_id,
  storage_path,
  original_filename,
  status,
  document_type,
  processing_status,
  lifecycle_state,
  upload_state,
  write_generation
) values (
  '00000000-0000-0000-0000-000000156002',
  '00000000-0000-0000-0000-000000156001',
  'assistant-stale/fixture.pdf',
  'assistant-stale.pdf',
  'completed',
  'consultation_note',
  'ready',
  'active',
  'complete',
  0
);

insert into public.document_pages (
  id,
  document_id,
  profile_id,
  page_number,
  preview_storage_path,
  ocr_text,
  is_current
) values (
  '00000000-0000-0000-0000-000000156003',
  '00000000-0000-0000-0000-000000156002',
  '00000000-0000-0000-0000-000000156001',
  1,
  'assistant-stale/fixture-page.png',
  'Old indexed text',
  true
);

insert into public.assistant_reindex_jobs (
  id,
  profile_id,
  document_id,
  requested_content_sha256,
  requested_write_generation,
  status,
  attempts,
  max_attempts
) values (
  '00000000-0000-0000-0000-000000156004',
  '00000000-0000-0000-0000-000000156001',
  '00000000-0000-0000-0000-000000156002',
  repeat('a', 64),
  1,
  'processing',
  1,
  3
);

insert into public.assistant_document_chunks (
  profile_id,
  document_id,
  document_page_id,
  page_number,
  chunk_index,
  content,
  content_sha256,
  embedding,
  embedding_provider,
  embedding_model,
  source_write_generation,
  is_current
) values (
  '00000000-0000-0000-0000-000000156001',
  '00000000-0000-0000-0000-000000156002',
  '00000000-0000-0000-0000-000000156003',
  1,
  0,
  'Old indexed text',
  repeat('b', 64),
  ('[' || repeat('0,', 1535) || '0]')::extensions.vector(1536),
  'openai',
  'text-embedding-3-small',
  0,
  true
);

select is(
  (select status from public.publish_assistant_reindex_chunks(
    '00000000-0000-0000-0000-000000156004',
    '00000000-0000-0000-0000-000000156001',
    '00000000-0000-0000-0000-000000156002',
    repeat('a', 64),
    1,
    '[]'::jsonb,
    'openai',
    'text-embedding-3-small'
  )),
  'stale',
  'stale semantic publish is rejected'
);
select is(
  (select count(*)::integer
   from public.assistant_document_chunks
   where document_id = '00000000-0000-0000-0000-000000156002'),
  1,
  'stale semantic publish preserves the previous index'
);
select is(
  (select status
   from public.assistant_reindex_jobs
   where id = '00000000-0000-0000-0000-000000156004'),
  'stale',
  'stale semantic publish records the safe job outcome'
);
insert into public.assistant_reindex_jobs (
  id,
  profile_id,
  document_id,
  requested_content_sha256,
  requested_write_generation,
  status,
  attempts,
  max_attempts
) values (
  '00000000-0000-0000-0000-000000156005',
  '00000000-0000-0000-0000-000000156001',
  '00000000-0000-0000-0000-000000156002',
  repeat('c', 64),
  0,
  'processing',
  1,
  3
);

select is(
  (select status from public.publish_assistant_reindex_chunks(
    '00000000-0000-0000-0000-000000156005',
    '00000000-0000-0000-0000-000000156001',
    '00000000-0000-0000-0000-000000156002',
    repeat('c', 64),
    0,
    '[]'::jsonb,
    'openai',
    'text-embedding-3-small'
  )),
  'stale',
  'source hash changes are rejected even when generation is unchanged'
);
select is(
  (select count(*)::integer
   from public.assistant_document_chunks
   where document_id = '00000000-0000-0000-0000-000000156002'),
  1,
  'source hash mismatch preserves the previous index'
);
select is(
  (select status
   from public.assistant_reindex_jobs
   where id = '00000000-0000-0000-0000-000000156005'),
  'stale',
  'source hash mismatch records the safe job outcome'
);


select * from finish();
rollback;
