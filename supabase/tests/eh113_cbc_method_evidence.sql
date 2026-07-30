begin;

select plan(4);

insert into public.profiles (id, email)
values ('00000000-0000-0000-0000-000000001132', 'eh113-owner@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values ('00000000-0000-0000-0000-000000001131', '00000000-0000-0000-0000-000000001132', 'eh113/cbc.pdf', 'cbc.pdf', 'completed');

select has_column(
  'public',
  'document_extracted_biomarkers',
  'method',
  'EH-113 preserves explicit differential method evidence'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_extracted_biomarkers'
      and column_name = 'method'
      and is_nullable = 'YES'
  ),
  'method remains nullable when laboratory evidence is unavailable'
);

select lives_ok(
  $$
    insert into public.document_extracted_biomarkers (id, document_id, profile_id, biomarker_key, biomarker_name, method)
    values ('00000000-0000-0000-0000-000000001130', '00000000-0000-0000-0000-000000001131', '00000000-0000-0000-0000-000000001132', 'eh113_method_fixture', 'EH-113 method fixture', 'manual')
  $$,
  'manual differential method is accepted'
);

select throws_ok(
  $$
    insert into public.document_extracted_biomarkers (id, document_id, profile_id, biomarker_key, biomarker_name, method)
    values ('00000000-0000-0000-0000-000000001133', '00000000-0000-0000-0000-000000001131', '00000000-0000-0000-0000-000000001132', 'eh113_invalid_method_fixture', 'EH-113 invalid method fixture', 'inferred')
  $$,
  '23514',
  null,
  'unsupported method evidence is rejected'
);

select * from finish();
rollback;
