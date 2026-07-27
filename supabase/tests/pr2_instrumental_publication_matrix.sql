begin;

select plan(10);

insert into public.profiles (id, email)
values ('30000000-0000-0000-0000-000000000001', 'pr2-matrix@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type)
values (
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000001',
  'pr2/matrix.pdf',
  'matrix.pdf',
  'processing',
  'instrumental_report'
);

-- Helper to build snapshots A and B
create temporary table pr2_payloads on commit drop as
select
  jsonb_build_object(
    'study_date', '2026-07-19',
    'modality', 'ECG',
    'body_region', 'heart',
    'facility_name', 'Clinic A',
    'impression', null,
    'processing_version', 'pr2-test',
    'extraction_model', 'test-model',
    'measures', jsonb_build_array(
      jsonb_build_object(
        'key_hint', 'ef', 'name', 'Ejection fraction', 'raw_name', 'EF',
        'value', 55, 'raw_value_text', '55%', 'unit', '%', 'raw_unit', '%',
        'source_page', 1, 'source_text', 'EF 55%',
        'source_locator', 'page:1|table:measurements|row:1',
        'occurrence_index', 0, 'bounding_box', null, 'confidence', 0.9
      )
    ),
    'findings', jsonb_build_array(
      jsonb_build_object(
        'finding_text', 'Normal sinus rhythm',
        'source_page', 1,
        'source_text', 'Normal sinus rhythm',
        'confidence', 0.91
      )
    )
  ) as payload_a,
  jsonb_build_object(
    'study_date', '2026-07-19',
    'modality', 'ECG',
    'body_region', 'heart',
    'facility_name', 'Clinic A',
    'impression', null,
    'processing_version', 'pr2-test',
    'extraction_model', 'test-model',
    'measures', jsonb_build_array(
      jsonb_build_object(
        'key_hint', 'ef', 'name', 'Ejection fraction', 'raw_name', 'EF',
        'value', 56, 'raw_value_text', '56%', 'unit', '%', 'raw_unit', '%',
        'source_page', 1, 'source_text', 'EF 56%',
        'source_locator', 'page:1|table:measurements|row:1',
        'occurrence_index', 0, 'bounding_box', null, 'confidence', 0.9
      )
    ),
    'findings', jsonb_build_array(
      jsonb_build_object(
        'finding_text', 'Mild changes',
        'source_page', 1,
        'source_text', 'Mild changes',
        'confidence', 0.88
      )
    )
  ) as payload_b;

insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status)
values
  ('30000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000001', 'extract', 'queued');

create temporary table m_claim_a1 as
select * from public.claim_document_processing_job('30000000-0000-0000-0000-000000000021');

create temporary table m_prep_a1 as
select * from public.prepare_instrumental_publication(
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000021',
  (select processing_attempt_id from m_claim_a1),
  (select payload_a from pr2_payloads),
  null
);

select is(
  (select state from public.document_instrumental_publications where id = (select publication_id from m_prep_a1)),
  'prepared',
  'prepare creates PREPARED publication'
);

select * from public.finalize_instrumental_publication(
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000021',
  (select processing_attempt_id from m_claim_a1),
  (select publication_id from m_prep_a1),
  (select snapshot_content_id from m_prep_a1),
  (select canonicalization_version from m_prep_a1),
  (select snapshot_hash from m_prep_a1),
  'Summary A',
  jsonb_build_object('processing_status', 'completed', 'page_count', 1)
);

select is(
  (select state from public.document_instrumental_publications where id = (select publication_id from m_prep_a1)),
  'current',
  'finalize promotes publication to CURRENT'
);

select is(
  (select count(*)::integer from public.document_extracted_findings where document_id = '30000000-0000-0000-0000-000000000010'),
  1,
  'compatibility view shows only current findings'
);

-- Reprocess with B
insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status)
values ('30000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000001', 'extract', 'queued');

create temporary table m_claim_b as
select * from public.claim_document_processing_job('30000000-0000-0000-0000-000000000022');

create temporary table m_prep_b as
select * from public.prepare_instrumental_publication(
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000022',
  (select processing_attempt_id from m_claim_b),
  (select payload_b from pr2_payloads),
  null
);

select * from public.finalize_instrumental_publication(
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000022',
  (select processing_attempt_id from m_claim_b),
  (select publication_id from m_prep_b),
  (select snapshot_content_id from m_prep_b),
  (select canonicalization_version from m_prep_b),
  (select snapshot_hash from m_prep_b),
  'Summary B',
  jsonb_build_object('processing_status', 'completed', 'page_count', 1)
);

select is(
  (select state from public.document_instrumental_publications where id = (select publication_id from m_prep_a1)),
  'superseded',
  'prior CURRENT becomes SUPERSEDED on A->B'
);

select is(
  (select document_summary from public.documents where id = '30000000-0000-0000-0000-000000000010'),
  'Summary B',
  'document summary matches current publication B'
);

select is(
  (select finding_text from public.document_extracted_findings where document_id = '30000000-0000-0000-0000-000000000010'),
  'Mild changes',
  'findings view switches coherently to B'
);

-- A -> B -> A
insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status)
values ('30000000-0000-0000-0000-000000000023', '30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000001', 'extract', 'queued');

create temporary table m_claim_a2 as
select * from public.claim_document_processing_job('30000000-0000-0000-0000-000000000023');

create temporary table m_prep_a2 as
select * from public.prepare_instrumental_publication(
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000023',
  (select processing_attempt_id from m_claim_a2),
  (select payload_a from pr2_payloads),
  null
);

select is((select content_reused from m_prep_a2), true, 'A->B->A reuses immutable content A');

select * from public.finalize_instrumental_publication(
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000023',
  (select processing_attempt_id from m_claim_a2),
  (select publication_id from m_prep_a2),
  (select snapshot_content_id from m_prep_a2),
  (select canonicalization_version from m_prep_a2),
  (select snapshot_hash from m_prep_a2),
  'Summary A again',
  jsonb_build_object('processing_status', 'completed', 'page_count', 1)
);

select is(
  (select finding_text from public.document_extracted_findings where document_id = '30000000-0000-0000-0000-000000000010'),
  'Normal sinus rhythm',
  'A->B->A restores content A findings through the current pointer'
);

-- Abandoned path: prepare then fail attempt then cleanup
insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status)
values ('30000000-0000-0000-0000-000000000024', '30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000001', 'extract', 'queued');

create temporary table m_claim_c as
select * from public.claim_document_processing_job('30000000-0000-0000-0000-000000000024');

create temporary table m_prep_c as
select * from public.prepare_instrumental_publication(
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000024',
  (select processing_attempt_id from m_claim_c),
  (select payload_b from pr2_payloads),
  null
);

select public.fail_document_processing_attempt((select processing_attempt_id from m_claim_c), 'forced failure');
select is(public.cleanup_orphan_instrumental_preparations() >= 1, true, 'cleanup abandons orphan prepared publication');
select is(
  (select state from public.document_instrumental_publications where id = (select publication_id from m_prep_c)),
  'abandoned',
  'orphan preparation becomes ABANDONED'
);

select * from finish();
rollback;
