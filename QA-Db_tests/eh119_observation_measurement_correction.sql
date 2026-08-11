begin;

select plan(39);

-- EH-119 uses only synthetic identifiers and data. The test is transactional and
-- rolls back so it can run against a disposable local Supabase database.
select ok(
  has_function_privilege(
    'service_role',
    'public.write_observation_normalization_revision_v2(uuid,jsonb,jsonb,text,uuid,text,jsonb,uuid,text,text,uuid,uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'the explicit correction writer is executable only by service_role'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.write_observation_normalization_revision_v2(uuid,jsonb,jsonb,text,uuid,text,jsonb,uuid,text,text,uuid,uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'anonymous clients cannot call the correction writer'
);

create function public.eh119_db_observation_payload(
  p_value numeric,
  p_ref_high numeric,
  p_observed_at date
)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'profile_id', '00000000-0000-0000-0000-000000001191',
    'document_id', '00000000-0000-0000-0000-000000001192',
    'name', 'ALT',
    'value', p_value,
    'value_kind', 'numeric',
    'value_text', null,
    'unit', 'U/L',
    'ref_low', 0,
    'ref_high', p_ref_high,
    'observed_at', p_observed_at,
    'specimen', 'serum',
    'modifier', 'none',
    'raw_name', 'ALT',
    'raw_value_text', '31',
    'raw_reference_text', '0-41',
    'raw_unit', 'U/L',
    'source_page', 1,
    'source_text', 'ALT 31 U/L (0-41)',
    'confidence', 0.95,
    'provenance_schema_version', '1'
  );
$$;

create function public.eh119_db_resolution_payload(p_hash text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'input_evidence_hash', p_hash,
    'measurement_definition_key', 'alt_serum_catalytic_activity',
    'analyte_key', 'alt',
    'resolver_result', 'resolved',
    'mapping_confidence', 0.95,
    'mapping_confidence_band', 'high',
    'resolver_evidence', jsonb_build_object(
      'version', 2,
      'compatibilityPolicyVersion', 'eh119-db-test',
      'selectedCandidateKey', 'alt_serum_catalytic_activity',
      'runnerUpCandidateKey', null,
      'outcome', 'resolved',
      'confidence', 0.95,
      'candidates', jsonb_build_array(jsonb_build_object(
        'candidateKey', 'alt_serum_catalytic_activity',
        'accepted', '[]'::jsonb,
        'missing', '[]'::jsonb,
        'rejected', '[]'::jsonb,
        'missingAxes', '[]'::jsonb,
        'score', 95,
        'selectable', true,
        'eligible', true,
        'admissibilityRejections', '[]'::jsonb
      ))
    ),
    'resolver_decision_trace', jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'resolved',
      'decisionKind', 'single_reviewed_candidate',
      'inputEvidenceHash', p_hash,
      'catalogManifestVersion', 'eh119-db-test',
      'catalogManifestDigest', 'eh119-db-test-digest',
      'resolverVersion', 'eh119-db-test',
      'winningCandidateKey', 'alt_serum_catalytic_activity',
      'candidates', jsonb_build_array(jsonb_build_object(
        'candidateKey', 'alt_serum_catalytic_activity',
        'maturity', 'reviewed',
        'score', 0.95,
        'accepted', '[]'::jsonb,
        'rejected', '[]'::jsonb,
        'missingAxes', '[]'::jsonb,
        'conflicts', '[]'::jsonb
      )),
      'missingAxes', '[]'::jsonb,
      'conflicts', '[]'::jsonb
    ),
    'resolver_trace_schema_version', '1',
    'normalized_unit', 'u/l',
    'unit_dimension', 'enzyme_activity',
    'catalog_manifest_version', 'eh119-db-test',
    'catalog_manifest_digest', 'eh119-db-test-digest',
    'resolver_version', 'eh119-db-test',
    'normalization_version', 'eh119-db-test'
  );
$$;
create function public.eh119_db_partial_resolution_payload(p_hash text)
returns jsonb language sql immutable as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                public.eh119_db_resolution_payload(p_hash),
                '{measurement_definition_key}', 'null'::jsonb
              ),
              '{resolver_result}', '"partial"'::jsonb
            ),
            '{resolver_evidence,outcome}', '"partial"'::jsonb
          ),
          '{resolver_evidence,selectedCandidateKey}', 'null'::jsonb
        ),
        '{resolver_decision_trace,outcome}', '"partial"'::jsonb
      ),
      '{resolver_decision_trace,winningCandidateKey}', 'null'::jsonb
    ),
    '{resolver_decision_trace,decisionKind}', '"recognized_incomplete"'::jsonb
  );
$$;
-- Mutation evidence: pre-047 has no override column or validator, so both
-- assertions fail before the correction contract exists. The impossible-date
-- assertion also fails against the first draft of 047 until calendar semantics
-- are enforced in the immutable database validator.
select is(
  public.eh119_is_measurement_override(
    jsonb_build_object('value', 31, 'observed_at', '2028-02-29')
  ),
  true,
  'the database override contract accepts a real leap-day date'
);
select is(
  public.eh119_is_measurement_override(
    jsonb_build_object('observed_at', '2026-02-30')
  ),
  false,
  'the database override contract rejects an impossible calendar date'
);
select is(
  public.eh119_is_measurement_override(
    jsonb_build_object('value_kind', null, 'value_text', 'reported')
  ),
  false,
  'the database override contract rejects a null value kind'
);
select is(
  public.eh119_is_measurement_override(
    jsonb_build_object('value', 31, 'raw_value_text', '31')
  ),
  false,
  'the database override contract rejects raw-field keys'
);

insert into public.profiles (id, email) values
  ('00000000-0000-0000-0000-000000001191', 'eh119-owner@example.test'),
  ('00000000-0000-0000-0000-000000001193', 'eh119-reviewer@example.test');

insert into public.documents (
  id, profile_id, storage_path, original_filename, status, document_type
) values (
  '00000000-0000-0000-0000-000000001192',
  '00000000-0000-0000-0000-000000001191',
  'eh119/synthetic-correction.pdf',
  'synthetic-correction.pdf',
  'completed',
  'lab_result'
);

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, raw_name,
  value_numeric, value_text, value_kind, unit, raw_unit, raw_value_text,
  raw_reference_range, source_page, source_text, confidence,
  status, is_current, extraction_method
) values (
  '00000000-0000-0000-0000-000000001194',
  '00000000-0000-0000-0000-000000001192',
  '00000000-0000-0000-0000-000000001191',
  'ALT', 'ALT', 31, null, 'numeric', 'U/L', 'U/L', '31',
  '0-41', 1, 'ALT 31 U/L (0-41)', 0.95,
  'needs_review', true, 'llm'
);
insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, raw_name,
  value_numeric, value_text, value_kind, unit, raw_unit, raw_value_text,
  raw_reference_range, source_page, source_text, confidence,
  status, is_current, extraction_method
) values (
  '00000000-0000-0000-0000-000000001195',
  '00000000-0000-0000-0000-000000001192',
  '00000000-0000-0000-0000-000000001191',
  'ALT', 'ALT', 31, null, 'numeric', 'U/L', 'U/L', '31',
  '0-41', 1, 'ALT 31 U/L (0-41)', 0.95,
  'needs_review', true, 'llm'
);

select lives_ok($$
  select * from public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001194',
    public.eh119_db_observation_payload(31, 41, '2026-08-01'),
    public.eh119_db_resolution_payload(repeat('a', 64)),
    'acceptance',
    '00000000-0000-0000-0000-000000001193',
    repeat('a', 64),
    null::jsonb,
    null::uuid,
    'additive',
    null::text,
    null::uuid,
    null::uuid,
    'eh119-db-test',
    true
  )
$$, 'the initial raw extraction writes through the explicit writer');

select is(
  (select resolver_result from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
  'resolved', 'the initial active revision is resolved'
);
select is(
  (select measurement_override from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
  null::jsonb, 'the initial active revision has no measurement override'
);
select is(
  (select value from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  31::numeric, 'the initial observation projection uses the extracted value'
);
select is(
  (select raw_value_text from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  '31', 'the initial observation preserves raw value text'
);
select is(
  (select raw_reference_text from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  '0-41', 'the initial observation preserves the raw reference text'
);

select lives_ok($$
  select * from public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001194',
    public.eh119_db_observation_payload(32, 42, '2026-08-02'),
    public.eh119_db_resolution_payload(repeat('b', 64)),
    'value_correction',
    '00000000-0000-0000-0000-000000001193',
    repeat('b', 64),
    jsonb_build_object('value', 32, 'ref_high', 42, 'observed_at', '2026-08-02'),
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
    'additive',
    'The printed result is 32, not 31.',
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
    'eh119-db-test',
    true
  )
$$, 'a value correction appends and promotes a new revision');

select is(
  (select count(*)::bigint from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  2::bigint, 'the correction creates a second append-only revision'
);
select is(
  (select count(*)::bigint from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
  1::bigint, 'exactly one correction revision is active'
);
select is(
  (select is_active from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'
     and writer_request_hash = repeat('a', 64)),
  false, 'the prior revision becomes inactive instead of being overwritten'
);
select is(
  (select measurement_override from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
  jsonb_build_object('value', 32, 'ref_high', 42, 'observed_at', '2026-08-02'),
  'the active revision stores only the corrected fields'
);
select is(
  (select verification_status from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
  'manually_corrected',
  'a resolved value correction derives manually_corrected status'
);
select is(
  (select value from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  32::numeric, 'the observation projection reflects the corrected value'
);
select is(
  (select ref_high from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  42::numeric, 'the observation projection reflects the corrected reference bound'
);
select is(
  (select observed_at from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  '2026-08-02'::date, 'the observation projection reflects the corrected date'
);
select is(
  (select raw_value_text from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  '31', 'the corrected projection does not overwrite raw value text'
);
select is(
  (select raw_reference_text from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  '0-41', 'the corrected projection does not overwrite raw reference text'
);
select is(
  (select source_text from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  'ALT 31 U/L (0-41)', 'the corrected projection does not overwrite source text'
);
-- Mutation evidence: before 047 the second call is rejected as
-- `invalid_normalization_write_kind` and no measurement projection exists;
-- with 047 the request hash reaches the widened identity-plus-measurement
-- short-circuit and reuses exactly one revision.
select is(
  (
    select was_reused
    from public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001194',
      public.eh119_db_observation_payload(32, 42, '2026-08-02'),
      public.eh119_db_resolution_payload(repeat('b', 64)),
      'value_correction',
      '00000000-0000-0000-0000-000000001193',
      repeat('b', 64),
      jsonb_build_object('value', 32, 'ref_high', 42, 'observed_at', '2026-08-02'),
      (select id from public.observation_normalization_revisions
       where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
      'additive',
      'The printed result is 32, not 31.',
      (select id from public.observation_normalization_revisions
       where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'
         and writer_request_hash = repeat('a', 64)),
      (select id from public.observation_normalization_revisions
       where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'
         and writer_request_hash = repeat('a', 64)),
      'eh119-db-test',
      true
    )
  ),
  true,
  'an identical correction replay reuses the existing revision'
);
select is(
  (select count(*)::bigint from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  2::bigint, 'an identical correction replay does not append a revision'
);
-- Mutation evidence: pre-047 rejects `value_correction` as an invalid write
-- kind before it can append a row; the old identity-only writer also cannot
-- project the corrected value or retain the analyte-only partial outcome.
select is(
  (
    select verification_status
    from public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001195',
      public.eh119_db_observation_payload(27, 41, '2026-08-03'),
      public.eh119_db_partial_resolution_payload(repeat('f', 64)),
      'value_correction',
      '00000000-0000-0000-0000-000000001193',
      repeat('f', 64),
      jsonb_build_object('value', 27),
      null::uuid,
      'additive',
      'The printed result is 27, not 31.',
      null::uuid,
      null::uuid,
      'eh119-db-test',
      true
    )
  ),
  'pending',
  'an incomplete measurement correction remains pending'
);
select is(
  (select measurement_definition_key from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001195' and is_active),
  null::text,
  'an incomplete correction stores no concrete definition'
);
select is(
  (select analyte_key from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001195' and is_active),
  'alt',
  'an incomplete correction preserves the resolver analyte identity'
);
select is(
  (select correction_reason from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001195' and is_active),
  'The printed result is 27, not 31.',
  'an incomplete correction records its reason'
);
select is(
  (select value from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001195'),
  27::numeric,
  'an incomplete correction still projects the effective value'
);
-- Invariant-preservation evidence: this mapping-correction assertion is
-- intentionally green against pre-047 too; it records the unchanged guard
-- and proves EH-119 did not turn a measurement edit into a mapping bypass.
select throws_ok($$
  select * from public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001195',
    public.eh119_db_observation_payload(28, 41, '2026-08-04'),
    public.eh119_db_partial_resolution_payload(repeat('7', 64)),
    'correction',
    '00000000-0000-0000-0000-000000001193',
    repeat('7', 64),
    jsonb_build_object('value', 28),
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001195' and is_active),
    'additive',
    'This mapping correction must remain resolved-only.',
    null::uuid,
    null::uuid,
    'eh119-db-test',
    true
  )
$$, 'P0001', 'correction_requires_reviewed_concrete_definition',
  'a mapping correction still rejects an incomplete resolution');
select is(
  (select count(*)::bigint from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001195'),
  1::bigint, 'a rejected mapping correction does not append a revision'
);
-- Invariant-preservation evidence: the write-once trigger predates 047 and
-- must remain green in the pre-047 mutation baseline as well as here.
select throws_ok(
  $$
    update public.observations
    set raw_value_text = '27'
    where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001195'
  $$,
  'P0001',
  'Observation provenance is write-once; raw, source, and version fields cannot be mutated after creation.',
  'the write-once trigger still protects raw extraction fields'
);

select throws_ok($$
  select * from public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001194',
    public.eh119_db_observation_payload(33, 43, '2026-08-03'),
    public.eh119_db_resolution_payload(repeat('c', 64)),
    'value_correction',
    '00000000-0000-0000-0000-000000001193',
    repeat('c', 64),
    jsonb_build_object('specimen', 'serum'),
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
    'additive',
    'This invalid correction must be rejected.',
    null::uuid,
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
    'eh119-db-test',
    true
  )
$$, 'P0001', 'invalid_measurement_override', 'unknown clinical axes are rejected by the writer');
select is(
  (select count(*)::bigint from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  2::bigint, 'an invalid override does not append a revision'
);

select throws_ok($$
  select * from public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001194',
    public.eh119_db_observation_payload(33, 43, '2026-08-03'),
    public.eh119_db_resolution_payload(repeat('d', 64)),
    'value_correction',
    '00000000-0000-0000-0000-000000001193',
    repeat('d', 64),
    jsonb_build_object('value', 33),
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
    'additive',
    '   ',
    null::uuid,
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
    'eh119-db-test',
    true
  )
$$, 'P0001', 'measurement_correction_requires_reason', 'a correction without a reason is rejected');

select throws_ok($$
  select * from public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001194',
    public.eh119_db_observation_payload(34, 44, '2026-08-04'),
    public.eh119_db_resolution_payload(repeat('e', 64)),
    'value_correction',
    '00000000-0000-0000-0000-000000001193',
    repeat('e', 64),
    jsonb_build_object('value', 34),
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'
       and writer_request_hash = repeat('a', 64)),
    'additive',
    'The stale correction must be rejected.',
    null::uuid,
    (select id from public.observation_normalization_revisions
     where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194' and is_active),
    'eh119-db-test',
    true
  )
$$, 'P0001', 'stale_revision_conflict', 'a stale expected-active revision cannot overwrite a newer correction');
select is(
  (select count(*)::bigint from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-000000001194'),
  2::bigint, 'a stale correction does not append a revision'
);

select * from finish();
rollback;
