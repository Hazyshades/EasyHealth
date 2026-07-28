begin;

select plan(18);

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
  to_regprocedure('public.replace_document_instrumental_observations(uuid,uuid,text,date,text,text,text,text,jsonb)') is null,
  'legacy publish-on-materialize RPC is removed'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_instrumental_publication(uuid,uuid,uuid,jsonb,text)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute prepare_instrumental_publication'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.prepare_instrumental_publication(uuid,uuid,uuid,jsonb,text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute prepare_instrumental_publication'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalize_instrumental_publication(uuid,uuid,uuid,uuid,uuid,text,text,text,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute finalize_instrumental_publication'
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
  ('10000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'extract', 'queued'),
  ('10000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002', 'extract', 'queued');

create temporary table eh105_claim as
select * from public.claim_document_processing_job('10000000-0000-0000-0000-000000000020');

select is(
  (select count(*)::integer from eh105_claim),
  1,
  'claim returns one attempt-owned job row'
);

create temporary table eh105_snapshot on commit drop as
select jsonb_build_object(
  'study_date', '2026-07-19',
  'modality', 'ECG',
  'body_region', 'heart',
  'facility_name', 'Example clinic',
  'impression', null,
  'processing_version', 'eh105-test',
  'extraction_model', 'test-model',
  'measures', jsonb_build_array(
    jsonb_build_object(
      'key_hint', 'ef',
      'name', 'Ejection fraction',
      'raw_name', 'EF',
      'value', 55,
      'raw_value_text', '55%',
      'unit', '%',
      'raw_unit', '%',
      'source_page', 1,
      'source_text', 'EF 55%',
      'source_locator', 'page:1|table:measurements|row:1',
      'occurrence_index', 0,
      'bounding_box', null,
      'confidence', 0.95
    ),
    jsonb_build_object(
      'key_hint', 'ef',
      'name', 'Ejection fraction',
      'raw_name', 'EF',
      'value', 60,
      'raw_value_text', '60%',
      'unit', '%',
      'raw_unit', '%',
      'source_page', 1,
      'source_text', 'EF 60%',
      'source_locator', 'page:1|table:measurements|row:1',
      'occurrence_index', 1,
      'bounding_box', null,
      'confidence', 0.94
    )
  ),
  'findings', '[]'::jsonb
) as payload;

create temporary table eh105_prepared as
select *
from public.prepare_instrumental_publication(
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000020',
  (select processing_attempt_id from eh105_claim),
  (select payload from eh105_snapshot),
  null
);

select isnt(
  (select publication_id from eh105_prepared),
  null,
  'prepare returns a publication id'
);

select is(
  (select count(*)::integer
   from public.document_extracted_instrumental_measures
   where document_id = '10000000-0000-0000-0000-000000000010'
     and is_current),
  0,
  'prepared measures remain invisible to current readers'
);

select lives_ok(
  $$
    select * from public.finalize_instrumental_publication(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000020',
      (select processing_attempt_id from eh105_claim),
      (select publication_id from eh105_prepared),
      (select snapshot_content_id from eh105_prepared),
      (select canonicalization_version from eh105_prepared),
      (select snapshot_hash from eh105_prepared),
      'Summary A',
      jsonb_build_object('processing_status', 'completed', 'page_count', 1)
    );
  $$,
  'finalize publishes prepared content atomically'
);

select is(
  (select count(*)::integer
   from public.document_extracted_instrumental_measures
   where document_id = '10000000-0000-0000-0000-000000000010'
     and is_current),
  2,
  'finalize exposes both occurrence-distinct current measures'
);

select is(
  (select count(*)::integer
   from public.observations
   where document_id = '10000000-0000-0000-0000-000000000010'
     and observation_kind = 'instrumental'
     and source_instrumental_measure_id is not null),
  2,
  'each current measure has one linked instrumental observation'
);

select is(
  (select lab_name from public.documents where id = '10000000-0000-0000-0000-000000000010'),
  'Example clinic',
  'document lab_name projects from content facility_name'
);

select is(
  (select write_generation from public.documents where id = '10000000-0000-0000-0000-000000000010'),
  1::bigint,
  'successful finalize advances write_generation once'
);

-- Cross-profile isolation: secondary profile claim/prepare cannot attach to primary content.
create temporary table eh105_claim_b as
select * from public.claim_document_processing_job('10000000-0000-0000-0000-000000000021');

select throws_ok(
  $$
    select * from public.prepare_instrumental_publication(
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000021',
      (select processing_attempt_id from eh105_claim_b),
      (select payload from eh105_snapshot),
      null
    );
  $$,
  'P0001',
  'instrumental_job_document_profile_mismatch',
  'cross-owner prepare is rejected'
);

select throws_ok(
  $$
    select public.pr2_reset_instrumental_publication_state(false);
  $$,
  'P0001',
  'pr2_reset_not_allowed',
  'disposable reset rejects missing confirmation'
);

select * from finish();
rollback;
