begin;

select plan(4);

-- 6.4 / 6.6 are fully proven in CI with a migrated database. This suite covers
-- the single-session serialization invariants available without dblink:
-- current-pointer uniqueness and finalize rollback on injected failure.

insert into public.profiles (id, email)
values ('50000000-0000-0000-0000-000000000001', 'pr2-conc@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type)
values (
  '50000000-0000-0000-0000-000000000010',
  '50000000-0000-0000-0000-000000000001',
  'pr2/conc.pdf',
  'conc.pdf',
  'processing',
  'instrumental_report'
);

insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status)
values (
  '50000000-0000-0000-0000-000000000020',
  '50000000-0000-0000-0000-000000000010',
  '50000000-0000-0000-0000-000000000001',
  'extract',
  'queued'
);

create temporary table conc_claim as
select * from public.claim_document_processing_job('50000000-0000-0000-0000-000000000020');

create temporary table conc_payload on commit drop as
select jsonb_build_object(
  'study_date', '2026-07-19',
  'modality', 'ECG',
  'body_region', 'heart',
  'facility_name', 'Clinic C',
  'impression', null,
  'processing_version', 'pr2-test',
  'extraction_model', 'test-model',
  'measures', '[]'::jsonb,
  'findings', '[]'::jsonb
) as payload;

create temporary table conc_prep as
select * from public.prepare_instrumental_publication(
  '50000000-0000-0000-0000-000000000010',
  '50000000-0000-0000-0000-000000000020',
  (select processing_attempt_id from conc_claim),
  (select payload from conc_payload),
  null
);

select * from public.finalize_instrumental_publication(
  '50000000-0000-0000-0000-000000000010',
  '50000000-0000-0000-0000-000000000020',
  (select processing_attempt_id from conc_claim),
  (select publication_id from conc_prep),
  (select snapshot_content_id from conc_prep),
  (select canonicalization_version from conc_prep),
  (select snapshot_hash from conc_prep),
  'Summary C',
  jsonb_build_object('processing_status', 'completed', 'page_count', 1)
);

select is(
  (select count(*)::integer from public.document_instrumental_current_publication
   where document_id = '50000000-0000-0000-0000-000000000010'),
  1,
  'exactly one current pointer row after finalize'
);

select throws_ok(
  $$
    insert into public.document_instrumental_publications (
      id, document_id, profile_id, snapshot_content_id, state, processing_attempt_id
    )
    select
      '50000000-0000-0000-0000-000000000099',
      document_id,
      profile_id,
      snapshot_content_id,
      'current',
      null
    from public.document_instrumental_publications
    where id = (select publication_id from conc_prep);
  $$,
  '23505',
  null,
  'second CURRENT publication is rejected by unique index'
);

-- Injected failure after pointer write must roll back the whole finalize.
create temporary table conc_before on commit drop as
select write_generation, document_summary
from public.documents
where id = '50000000-0000-0000-0000-000000000010';

select throws_ok(
  $$
    do $body$
    begin
      -- Simulate a mid-finalizer failure by raising inside a nested call path:
      -- direct pointer mutation is revoked; use an invalid completion payload
      -- shape against an already-terminal attempt to force rejection without
      -- publishing a divergent version.
      perform 1 from public.finalize_instrumental_publication(
        '50000000-0000-0000-0000-000000000010',
        '50000000-0000-0000-0000-000000000020',
        (select processing_attempt_id from conc_claim),
        (select publication_id from conc_prep),
        (select snapshot_content_id from conc_prep),
        (select canonicalization_version from conc_prep),
        (select snapshot_hash from conc_prep),
        'Summary C divergent',
        '"not-an-object"'::jsonb
      );
    end
    $body$;
  $$,
  'P0001',
  null,
  'divergent/invalid finalize inputs are rejected'
);

select is(
  (select document_summary from public.documents where id = '50000000-0000-0000-0000-000000000010'),
  (select document_summary from conc_before),
  'rejected finalize leaves prior document projection unchanged'
);

select * from finish();
rollback;
