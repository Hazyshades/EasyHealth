-- EH-161: assistant artifacts participate in durable document deletion.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'eh161_purge_assistant_document_artifacts'
      and tgrelid = 'public.documents'::regclass
      and not tgisinternal
  ),
  'durable document delete trigger is installed'
);
select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'eh161_purge_assistant_document_artifacts'
  ),
  'assistant deletion trigger function exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh161_purge_assistant_document_artifacts()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated role cannot invoke assistant deletion trigger function'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.eh161_purge_assistant_document_artifacts()'::regprocedure,
    'EXECUTE'
  ),
  'service role cannot invoke assistant deletion trigger function directly'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assistant_document_chunks'::regclass
      and confrelid = 'public.documents'::regclass
      and confdeltype = 'c'
  ),
  'semantic chunks cascade with the source document'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assistant_reindex_jobs'::regclass
      and confrelid = 'public.documents'::regclass
      and confdeltype = 'c'
  ),
  'semantic jobs cascade with the source document'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assistant_document_chunks'::regclass
      and confrelid = 'public.document_pages'::regclass
      and confdeltype = 'c'
  ),
  'page deletion cascades to semantic chunks'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assistant_document_chunks'
      and indexdef ilike '%document_id%'
  ),
  'semantic chunks remain addressable for deletion by document'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assistant_reindex_jobs'
      and indexdef ilike '%document_id%'
  ),
  'semantic jobs remain addressable for deletion by document'
);
select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'finalize_document_deletion'
  ),
  'durable document finalizer remains available'
);
select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'claim_document_deletion_operation'
  ),
  'durable deletion worker claim remains available'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assistant_document_chunks'
      and column_name = 'source_write_generation'
  ),
  'semantic chunks carry a deletion-safe source generation'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assistant_reindex_jobs'
      and column_name = 'requested_write_generation'
  ),
  'semantic jobs carry a deletion-safe source generation'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assistant_document_chunks'
      and column_name in ('answer', 'prompt', 'question')
  ),
  'semantic artifacts do not store assistant prompts or answers'
);

select * from finish();
rollback;
