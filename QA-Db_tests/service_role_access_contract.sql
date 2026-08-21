begin;

select plan(4);

select ok(
  has_table_privilege('service_role', 'public.ai_invocations', 'select'),
  'service_role can read ai invocation history'
);
select ok(
  has_table_privilege('service_role', 'public.ai_invocations', 'insert'),
  'service_role can write ai invocation history'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.document_extracted_instrumental_measures',
    'select'
  ),
  'service_role can read instrumental source rows for observation embeds'
);
select ok(
  not has_table_privilege('anon', 'public.ai_invocations', 'select'),
  'anon cannot read ai invocation history'
);

select * from finish();
rollback;
