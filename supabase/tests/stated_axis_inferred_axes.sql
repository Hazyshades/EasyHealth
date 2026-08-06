begin;

select plan(6);

-- #106: the observability column must be additive and inert. It records what
-- extraction discarded; it must never participate in identity or resolution.

select has_column(
  'public',
  'document_extracted_biomarkers',
  'inferred_axes',
  'discarded axis inferences are recorded'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_extracted_biomarkers'
      and column_name = 'inferred_axes'
      and is_nullable = 'YES'
      and data_type = 'jsonb'
  ),
  'inferred_axes is a nullable jsonb column'
);

select ok(
  not exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'document_extracted_biomarkers'
      and column_name = 'inferred_axes'
  ),
  'inferred_axes participates in no constraint'
);

select ok(
  not exists (
    select 1
    from pg_index i
    join pg_attribute a
      on a.attrelid = i.indrelid
     and a.attnum = any (i.indkey)
    where i.indrelid = 'public.document_extracted_biomarkers'::regclass
      and a.attname = 'inferred_axes'
  ),
  'inferred_axes participates in no index, so it cannot affect identity lookup'
);

insert into public.profiles (id, email)
values ('00000000-0000-0000-0000-000000001062', 'issue106-owner@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values (
  '00000000-0000-0000-0000-000000001061',
  '00000000-0000-0000-0000-000000001062',
  'issue106/chem.pdf',
  'chem.pdf',
  'completed'
);

select lives_ok(
  $$
    insert into public.document_extracted_biomarkers (
      document_id, profile_id, biomarker_key, biomarker_name, raw_name,
      value_numeric, unit, source_page, source_text, status, is_current,
      specimen, modifier, inferred_axes
    )
    values (
      '00000000-0000-0000-0000-000000001061',
      '00000000-0000-0000-0000-000000001062',
      'alt', 'ALT (alanine aminotransferase)', 'ALT (alanine aminotransferase)',
      28, 'U/L', 1, 'ALT (alanine aminotransferase) 28 U/L 2 - 41',
      'needs_review', true,
      'unspecified', 'none',
      '[{"axis":"specimen","discarded":"serum"}]'::jsonb
    )
  $$,
  'a row records its discarded inference alongside the neutral stored axis'
);

select is(
  (
    select specimen
    from public.document_extracted_biomarkers
    where document_id = '00000000-0000-0000-0000-000000001061'
  ),
  'unspecified',
  'the stored specimen stays neutral even though an inference was recorded'
);

select * from finish();

rollback;
