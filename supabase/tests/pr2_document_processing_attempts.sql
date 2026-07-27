begin;

select plan(12);

insert into public.profiles (id, email)
values ('20000000-0000-0000-0000-000000000001', 'pr2-attempts@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type, write_generation)
values (
  '20000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000001',
  'pr2/attempts.pdf',
  'attempts.pdf',
  'processing',
  'instrumental_report',
  0
);

insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status, attempts, max_attempts)
values (
  '20000000-0000-0000-0000-000000000020',
  '20000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000001',
  'extract',
  'queued',
  0,
  3
);

create temporary table pr2_claim1 as
select * from public.claim_document_processing_job('20000000-0000-0000-0000-000000000020');

select is((select count(*)::integer from pr2_claim1), 1, 'atomic claim creates one attempt');
select is((select attempt_number from pr2_claim1), 1, 'first claim attempt_number is 1');
select is((select captured_write_generation from pr2_claim1), 0::bigint, 'claim captures write_generation');

-- Second claim while active/processing returns no row.
select is(
  (select count(*)::integer from public.claim_document_processing_job('20000000-0000-0000-0000-000000000020')),
  0,
  'second claim loses the race cleanly'
);

select lives_ok(
  $$
    select public.requeue_document_processing_attempt(
      (select processing_attempt_id from pr2_claim1),
      'retry'
    );
  $$,
  'active attempt can be requeued'
);

select is(
  (select state from public.document_processing_attempts where id = (select processing_attempt_id from pr2_claim1)),
  'requeued',
  'requeue terminals the attempt'
);

update public.document_processing_jobs
set status = 'queued', finished_at = null, error = null
where id = '20000000-0000-0000-0000-000000000020';

create temporary table pr2_claim2 as
select * from public.claim_document_processing_job('20000000-0000-0000-0000-000000000020');

select is((select attempt_number from pr2_claim2), 2, 'new claim allocates a new attempt number');

select throws_ok(
  $$$
    select public.fail_document_processing_attempt(
      (select processing_attempt_id from pr2_claim1),
      'stale'
    );
  $$,
  'P0001',
  'processing_attempt_not_active',
  'stale attempt cannot fail job/document state'
);

-- Prepare + finalize once, then replay finalize for idempotent generation.
create temporary table pr2_snapshot on commit drop as
select jsonb_build_object(
  'study_date', '2026-07-19',
  'modality', 'ECG',
  'body_region', 'heart',
  'facility_name', null,
  'impression', null,
  'processing_version', 'pr2-test',
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
      'confidence', 0.9
    )
  ),
  'findings', '[]'::jsonb
) as payload;

create temporary table pr2_prepared as
select * from public.prepare_instrumental_publication(
  '20000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000020',
  (select processing_attempt_id from pr2_claim2),
  (select payload from pr2_snapshot),
  null
);

create temporary table pr2_final1 as
select * from public.finalize_instrumental_publication(
  '20000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000020',
  (select processing_attempt_id from pr2_claim2),
  (select publication_id from pr2_prepared),
  (select snapshot_content_id from pr2_prepared),
  (select canonicalization_version from pr2_prepared),
  (select snapshot_hash from pr2_prepared),
  'Summary null facility',
  jsonb_build_object('processing_status', 'completed', 'page_count', 1)
);

select is((select write_generation from pr2_final1), 1::bigint, 'finalize increments write_generation');
select is((select was_replayed from pr2_final1), false, 'first finalize is not a replay');
select is(
  (select lab_name from public.documents where id = '20000000-0000-0000-0000-000000000010'),
  null,
  'null facility_name projects to null lab_name'
);

create temporary table pr2_final2 as
select * from public.finalize_instrumental_publication(
  '20000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000020',
  (select processing_attempt_id from pr2_claim2),
  (select publication_id from pr2_prepared),
  (select snapshot_content_id from pr2_prepared),
  (select canonicalization_version from pr2_prepared),
  (select snapshot_hash from pr2_prepared),
  'Summary null facility',
  jsonb_build_object('processing_status', 'completed', 'page_count', 1)
);

select is((select was_replayed from pr2_final2), true, 'exact finalize replay is idempotent');
select is(
  (select write_generation from public.documents where id = '20000000-0000-0000-0000-000000000010'),
  1::bigint,
  'idempotent finalize does not increment write_generation again'
);

select * from finish();
rollback;
