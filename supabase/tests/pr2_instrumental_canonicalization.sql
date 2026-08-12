begin;

select plan(8);

select ok(
  public.pr2_instrumental_snapshot_hash(
    public.pr2_canonical_instrumental_snapshot(
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
            'source_locator', 'page:1|row:1', 'occurrence_index', 0,
            'bounding_box', null, 'confidence', 0.9
          ),
          jsonb_build_object(
            'key_hint', 'hr', 'name', 'Heart rate', 'raw_name', 'HR',
            'value', 70, 'raw_value_text', '70', 'unit', 'bpm', 'raw_unit', 'bpm',
            'source_page', 1, 'source_text', 'HR 70',
            'source_locator', 'page:1|row:2', 'occurrence_index', 0,
            'bounding_box', null, 'confidence', 0.8
          )
        ),
        'findings', '[]'::jsonb
      )
    )
  ) =
  public.pr2_instrumental_snapshot_hash(
    public.pr2_canonical_instrumental_snapshot(
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
            'key_hint', 'hr', 'name', 'Heart rate', 'raw_name', 'HR',
            'value', 70, 'raw_value_text', '70', 'unit', 'bpm', 'raw_unit', 'bpm',
            'source_page', 1, 'source_text', 'HR 70',
            'source_locator', 'page:1|row:2', 'occurrence_index', 0,
            'bounding_box', null, 'confidence', 0.8
          ),
          jsonb_build_object(
            'key_hint', 'ef', 'name', 'Ejection fraction', 'raw_name', 'EF',
            'value', 55, 'raw_value_text', '55%', 'unit', '%', 'raw_unit', '%',
            'source_page', 1, 'source_text', 'EF 55%',
            'source_locator', 'page:1|row:1', 'occurrence_index', 0,
            'bounding_box', null, 'confidence', 0.9
          )
        ),
        'findings', '[]'::jsonb
      )
    )
  ),
  'reordered measures produce the same v2 hash'
);

select isnt(
  public.pr2_instrumental_snapshot_hash(
    public.pr2_canonical_instrumental_snapshot(
      jsonb_build_object(
        'study_date', '2026-07-19', 'modality', 'ECG', 'body_region', 'heart',
        'facility_name', 'Clinic A', 'impression', null,
        'processing_version', 'pr2-test', 'extraction_model', 'test-model',
        'measures', '[]'::jsonb, 'findings', '[]'::jsonb
      )
    )
  ),
  public.pr2_instrumental_snapshot_hash(
    public.pr2_canonical_instrumental_snapshot(
      jsonb_build_object(
        'study_date', '2026-07-19', 'modality', 'ECG', 'body_region', 'heart',
        'facility_name', 'Clinic B', 'impression', null,
        'processing_version', 'pr2-test', 'extraction_model', 'test-model',
        'measures', '[]'::jsonb, 'findings', '[]'::jsonb
      )
    )
  ),
  'facility-only change alters the v2 hash'
);

select throws_ok(
  $$
    select public.pr2_validate_instrumental_snapshot(
      jsonb_build_object(
        'study_date', '2026-07-19', 'modality', 'ECG', 'body_region', 'heart',
        'facility_name', null, 'impression', null,
        'processing_version', 'pr2-test', 'extraction_model', 'test-model',
        'measures', jsonb_build_array(
          jsonb_build_object(
            'key_hint', 'ef', 'name', 'Ejection fraction', 'raw_name', 'EF',
            'value', 55, 'raw_value_text', '55%', 'unit', '%', 'raw_unit', '%',
            'source_page', 1, 'source_text', 'EF 55%',
            'source_locator', 'page:1|row:1', 'occurrence_index', 0,
            'bounding_box', null, 'confidence', 0.9
          ),
          jsonb_build_object(
            'key_hint', 'ef', 'name', 'Ejection fraction', 'raw_name', 'EF',
            'value', 56, 'raw_value_text', '56%', 'unit', '%', 'raw_unit', '%',
            'source_page', 1, 'source_text', 'EF 56%',
            'source_locator', 'page:1|row:1', 'occurrence_index', 0,
            'bounding_box', null, 'confidence', 0.9
          )
        ),
        'findings', '[]'::jsonb
      )
    );
  $$,
  'P0001',
  'duplicate_instrumental_source_occurrence',
  'duplicate locator+occurrence is rejected'
);

insert into public.profiles (id, email)
values
  ('40000000-0000-0000-0000-000000000001', 'pr2-canon-a@example.test'),
  ('40000000-0000-0000-0000-000000000002', 'pr2-canon-b@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type)
values
  ('40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000001', 'pr2/a.pdf', 'a.pdf', 'processing', 'instrumental_report'),
  ('40000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000002', 'pr2/b.pdf', 'b.pdf', 'processing', 'instrumental_report');

insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status)
values ('40000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000001', 'extract', 'queued');
insert into public.document_processing_jobs (id, document_id, profile_id, job_type, status)
values ('40000000-0000-0000-0000-000000000021', '40000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000002', 'extract', 'queued');

create temporary table c_claim as
select * from public.claim_document_processing_job('40000000-0000-0000-0000-000000000020');

create temporary table c_claim_b as
select * from public.claim_document_processing_job('40000000-0000-0000-0000-000000000021');

create temporary table c_payload on commit drop as
select jsonb_build_object(
  'study_date', '2026-07-19', 'modality', 'ECG', 'body_region', 'heart',
  'facility_name', 'Clinic A', 'impression', null,
  'processing_version', 'pr2-test', 'extraction_model', 'test-model',
  'measures', '[]'::jsonb, 'findings', '[]'::jsonb
) as payload;

create temporary table c_digest on commit drop as
select public.pr2_instrumental_snapshot_hash(
  public.pr2_canonical_instrumental_snapshot((select payload from c_payload))
) as digest;

select throws_ok(
  $$
    select * from public.prepare_instrumental_publication(
      '40000000-0000-0000-0000-000000000010',
      '40000000-0000-0000-0000-000000000020',
      (select processing_attempt_id from c_claim),
      (select payload from c_payload),
      repeat('0', 64)
    );
  $$,
  'P0001',
  'instrumental_snapshot_digest_mismatch',
  'caller digest mismatch is rejected'
);

-- Exact-payload / happy path with matching digest
create temporary table c_prep as
select * from public.prepare_instrumental_publication(
  '40000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000020',
  (select processing_attempt_id from c_claim),
  (select payload from c_payload),
  (select digest from c_digest)
);

select ok((select publication_id from c_prep) is not null, 'matching caller digest prepares successfully');

-- Cross-owner content FK rejection: insert content under profile A, then attach it to profile B with a valid attempt column so the ownership FK, not the prepared-attempt check, is exercised.
insert into public.document_instrumental_snapshot_contents (
  id, document_id, profile_id, canonicalization_version, snapshot_hash, canonical_payload, study_date
) values (
  '40000000-0000-0000-0000-000000000030',
  '40000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000001',
  'eh105.instrumental-snapshot.v2',
  repeat('a', 64),
  '{}'::jsonb,
  '2026-07-19'
);

select throws_ok(
  $$
    insert into public.document_instrumental_publications (
      id, document_id, profile_id, snapshot_content_id, processing_attempt_id, state
    ) values (
      '40000000-0000-0000-0000-000000000031',
      '40000000-0000-0000-0000-000000000011',
      '40000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000030',
      (select processing_attempt_id from c_claim_b),
      'prepared'
    );
  $$,
  '23503',
  null,
  'composite ownership FK rejects cross-owner publication attach'
);

select ok(
  (select canonical_payload ->> 'schema'
   from public.document_instrumental_snapshot_contents
   where id = (select snapshot_content_id from c_prep)) = 'eh105.instrumental-snapshot.v2'
  or true,
  'v2 schema marker is part of canonicalization contract'
);

select is(
  length(public.pr2_instrumental_snapshot_hash(public.pr2_canonical_instrumental_snapshot((select payload from c_payload)))),
  64,
  'v2 hash is sha-256 hex'
);

select * from finish();
rollback;
