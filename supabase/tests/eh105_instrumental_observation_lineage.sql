begin;

select plan(23);

select ok(
  to_regclass('public.document_extracted_instrumental_measures') is not null,
  'instrumental source lineage table exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'observations'
      and column_name = 'source_instrumental_measure_id'
  ),
  'observations exposes instrumental source lineage'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'observations'
      and indexname = 'observations_source_instrumental_measure_unique'
  ),
  'instrumental observation source uniqueness index exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.replace_document_instrumental_observations(uuid,uuid,text,date,text,text,text,text,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute instrumental replacement RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.replace_document_instrumental_observations(uuid,uuid,text,date,text,text,text,text,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute instrumental replacement RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.replace_document_instrumental_observations(uuid,uuid,text,date,text,text,text,text,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute instrumental replacement RPC'
);

insert into public.profiles (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'eh105-primary@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'eh105-secondary@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type)
values
  ('10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'eh105/primary.pdf', 'primary.pdf', 'processing', 'instrumental_report'),
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002', 'eh105/secondary.pdf', 'secondary.pdf', 'processing', 'instrumental_report');

insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status)
values
  ('10000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'extract', 'processing'),
  ('10000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002', 'extract', 'processing');

select lives_ok(
  $$
    select * from public.replace_document_instrumental_observations(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000020',
      repeat('a', 64),
      '2026-07-19',
      'ECG',
      'heart',
      'eh105-test',
      'test-model',
      '[
        {
          "key_hint": "ef",
          "name": "Ejection fraction",
          "raw_name": "EF",
          "value": 55,
          "raw_value_text": "55%",
          "unit": "%",
          "raw_unit": "%",
          "source_page": 1,
          "source_text": "EF 55%",
          "source_locator": "page:1|table:measurements|row:1",
          "occurrence_index": 0,
          "bounding_box": null,
          "confidence": 0.95
        },
        {
          "key_hint": "ef",
          "name": "Ejection fraction",
          "raw_name": "EF",
          "value": 60,
          "raw_value_text": "60%",
          "unit": "%",
          "raw_unit": "%",
          "source_page": 1,
          "source_text": "EF 60%",
          "source_locator": "page:1|table:measurements|row:1",
          "occurrence_index": 1,
          "bounding_box": null,
          "confidence": 0.95
        }
      ]'::jsonb
    )
  $$,
  'first source snapshot materializes repeated equal-key occurrences'
);

select is(
  (
    select count(*)::bigint
    from public.document_extracted_instrumental_measures
    where document_id = '10000000-0000-0000-0000-000000000010'
      and snapshot_hash = repeat('a', 64)
  ),
  2::bigint,
  'two repeated equal-key source occurrences are retained'
);

select is(
  (
    select count(*)::bigint
    from public.observations
    where document_id = '10000000-0000-0000-0000-000000000010'
      and observation_kind = 'instrumental'
  ),
  2::bigint,
  'one instrumental observation is materialized per source occurrence'
);

select ok(
  not exists (
    select 1
    from public.observations
    where document_id = '10000000-0000-0000-0000-000000000010'
      and observation_kind = 'instrumental'
      and (
        source_instrumental_measure_id is null
        or source_extracted_biomarker_id is not null
        or normalization_revision_id is not null
        or analyte_key is not null
        or measurement_definition_key is not null
      )
  ),
  'instrumental observations have only instrumental lineage'
);

select lives_ok(
  $$
    select * from public.replace_document_instrumental_observations(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000020',
      repeat('a', 64),
      '2026-07-19', 'ECG', 'heart', 'eh105-test', 'test-model',
      '[
        {"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":55,"raw_value_text":"55%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 55%","source_locator":"page:1|table:measurements|row:1","occurrence_index":0,"bounding_box":null,"confidence":0.95},
        {"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":60,"raw_value_text":"60%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 60%","source_locator":"page:1|table:measurements|row:1","occurrence_index":1,"bounding_box":null,"confidence":0.95}
      ]'::jsonb
    )
  $$,
  'unchanged snapshot replay succeeds'
);

select is(
  (
    select count(*)::bigint
    from public.document_extracted_instrumental_measures
    where document_id = '10000000-0000-0000-0000-000000000010'
  ),
  2::bigint,
  'unchanged replay does not duplicate source rows'
);

select is(
  (
    select bool_and(was_replayed)
    from public.replace_document_instrumental_observations(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000020',
      repeat('a', 64),
      '2026-07-19', 'ECG', 'heart', 'eh105-test', 'test-model',
      '[
        {"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":55,"raw_value_text":"55%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 55%","source_locator":"page:1|table:measurements|row:1","occurrence_index":0,"bounding_box":null,"confidence":0.95},
        {"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":60,"raw_value_text":"60%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 60%","source_locator":"page:1|table:measurements|row:1","occurrence_index":1,"bounding_box":null,"confidence":0.95}
      ]'::jsonb
    )
  ),
  true,
  'replay reports its idempotent result'
);

select lives_ok(
  $$
    select * from public.replace_document_instrumental_observations(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000020',
      repeat('b', 64),
      '2026-07-19', 'ECG', 'heart', 'eh105-test', 'test-model',
      '[{"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":58,"raw_value_text":"58%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 58%","source_locator":"page:1|table:measurements|row:1","occurrence_index":0,"bounding_box":null,"confidence":0.95}]'::jsonb
    )
  $$,
  'changed reprocess materializes a new snapshot'
);

select is(
  (
    select count(*)::bigint
    from public.document_extracted_instrumental_measures
    where document_id = '10000000-0000-0000-0000-000000000010'
      and snapshot_hash = repeat('a', 64)
      and not is_current
  ),
  2::bigint,
  'changed reprocess supersedes previous current source rows'
);

select is(
  (
    select count(*)::bigint
    from public.document_extracted_instrumental_measures
    where document_id = '10000000-0000-0000-0000-000000000010'
      and snapshot_hash = repeat('b', 64)
      and is_current
  ),
  1::bigint,
  'changed snapshot is the only current source set'
);

select is(
  (
    select count(*)::bigint
    from public.observations
    where document_id = '10000000-0000-0000-0000-000000000010'
      and observation_kind = 'instrumental'
  ),
  3::bigint,
  'superseded observations remain auditable'
);

select throws_ok(
  $$
    select * from public.replace_document_instrumental_observations(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000020',
      repeat('b', 64),
      '2026-07-19', 'ECG', 'heart', 'eh105-test', 'test-model',
      '[{"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":59,"raw_value_text":"59%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 59%","source_locator":"page:1|table:measurements|row:1","occurrence_index":0,"bounding_box":null,"confidence":0.95}]'::jsonb
    )
  $$,
  'P0001',
  'instrumental_snapshot_payload_conflict',
  'a snapshot fingerprint cannot be reused for different immutable source evidence'
);

select throws_ok(
  $$
    select * from public.replace_document_instrumental_observations(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000020',
      repeat('c', 64),
      '2026-07-19', 'ECG', 'heart', 'eh105-test', 'test-model',
      '[
        {"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":57,"raw_value_text":"57%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 57%","source_locator":"page:1|table:measurements|row:1","occurrence_index":0,"bounding_box":null,"confidence":0.95},
        {"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":59,"raw_value_text":"59%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 59%","source_locator":"page:1|table:measurements|row:1","occurrence_index":0,"bounding_box":null,"confidence":0.95}
      ]'::jsonb
    )
  $$,
  'P0001',
  'duplicate_instrumental_source_occurrence',
  'duplicate source occurrences are rejected before replacement'
);

select is(
  (
    select count(*)::bigint
    from public.document_extracted_instrumental_measures
    where document_id = '10000000-0000-0000-0000-000000000010'
      and snapshot_hash = repeat('b', 64)
      and is_current
  ),
  1::bigint,
  'failed replacement leaves the prior current snapshot intact'
);

select throws_ok(
  $$
    insert into public.observations (
      profile_id, document_id, name, value, unit, observed_at, observation_kind
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000010',
      'invalid instrumental', 1, 'mm', '2026-07-19', 'instrumental'
    )
  $$,
  '23514',
  'new row for relation "observations" violates check constraint "observations_instrumental_lineage_check"',
  'new instrumental observations cannot omit source lineage'
);

select throws_ok(
  $$
    select * from public.replace_document_instrumental_observations(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000021',
      repeat('d', 64),
      '2026-07-19', 'ECG', 'heart', 'eh105-test', 'test-model',
      '[{"key_hint":"ef","name":"Ejection fraction","raw_name":"EF","value":58,"raw_value_text":"58%","unit":"%","raw_unit":"%","source_page":1,"source_text":"EF 58%","source_locator":"page:1|table:measurements|row:1","occurrence_index":0,"bounding_box":null,"confidence":0.95}]'::jsonb
    )
  $$,
  'P0001',
  'instrumental_job_document_profile_mismatch',
  'cross-profile job cannot replace another document source snapshot'
);

select is(
  (
    select count(*)::bigint
    from public.document_extracted_instrumental_measures
    where document_id = '10000000-0000-0000-0000-000000000010'
      and snapshot_hash = repeat('d', 64)
  ),
  0::bigint,
  'cross-profile rejection leaves no source rows'
);

select * from finish();

rollback;
