-- EH-156: semantic retrieval storage, ownership, index, and worker RPC contract.
begin;
select plan(27);

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

select * from finish();
rollback;
