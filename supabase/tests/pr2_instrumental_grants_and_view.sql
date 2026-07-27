begin;

select plan(10);

select ok(
  exists (
    select 1 from pg_views
    where schemaname = 'public' and viewname = 'document_extracted_findings'
  ),
  'document_extracted_findings compatibility view exists'
);

select ok(
  (
    select reloptions::text ilike '%security_invoker=true%'
    from pg_class
    where oid = 'public.document_extracted_findings'::regclass
  ),
  'findings view is security_invoker'
);

select ok(
  has_table_privilege('service_role', 'public.document_extracted_findings', 'SELECT'),
  'service_role can select findings view'
);

select ok(
  not has_table_privilege('anon', 'public.document_extracted_findings', 'SELECT'),
  'anon cannot select findings view by default grant set'
);

select ok(
  not has_table_privilege('authenticated', 'public.document_instrumental_publications', 'INSERT'),
  'authenticated cannot insert publications'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_document_processing_job(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot claim jobs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_instrumental_publication(uuid,uuid,uuid,jsonb,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot prepare publications'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.cleanup_orphan_instrumental_preparations()'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot cleanup orphan preparations'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.pr2_reset_instrumental_publication_state(boolean)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute disposable reset'
);

select throws_ok(
  $$
    insert into public.document_extracted_findings (
      id, document_id, profile_id, finding_text, status
    ) values (
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      'should fail',
      'accepted'
    );
  $$,
  null,
  null,
  'DML against findings compatibility view is denied'
);

select * from finish();
rollback;
