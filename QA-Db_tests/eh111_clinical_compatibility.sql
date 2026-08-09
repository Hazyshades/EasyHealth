begin;

select plan(14);

create function public.eh111_db_observation_payload(p_profile_id uuid, p_document_id uuid, p_name text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'profile_id', p_profile_id, 'document_id', p_document_id, 'name', p_name,
    'value', 90, 'value_kind', 'numeric', 'value_text', '90', 'unit', 'mg/dL',
    'observed_at', '2026-07-28', 'specimen', 'serum', 'modifier', 'none',
    'raw_name', p_name, 'raw_value_text', '90', 'raw_unit', 'mg/dL',
    -- EH-118: a document-sourced observation must name its page.
    'source_page', 1,
    'provenance_schema_version', '1'
  );
$$;

create function public.eh111_db_resolution_payload(p_result text, p_key text, p_analyte text, p_evidence jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'input_evidence_hash', repeat('e', 64), 'measurement_definition_key', p_key,
    'analyte_key', p_analyte, 'resolver_result', p_result, 'mapping_confidence', 0.75,
    'mapping_confidence_band', 'medium', 'resolver_evidence', p_evidence,
    'resolver_decision_trace', jsonb_build_object(
      'schemaVersion', '1',
      'outcome', p_result,
      'decisionKind', case p_result
        when 'resolved' then 'single_reviewed_candidate'
        when 'ambiguous' then 'multiple_reviewed_candidates'
        when 'partial' then 'recognized_incomplete'
        else 'no_matching_candidate'
      end,
      'inputEvidenceHash', repeat('e', 64),
      'catalogManifestVersion', '2026-07-28.0',
      'catalogManifestDigest', 'eh111-db-test-digest',
      'resolverVersion', '7',
      'winningCandidateKey', case when p_result = 'resolved' then p_key else null end,
      'candidates', case
        when p_result = 'resolved' then jsonb_build_array(jsonb_build_object(
          'candidateKey', p_key, 'maturity', 'reviewed', 'score', 75,
          'accepted', '[]'::jsonb, 'rejected', '[]'::jsonb,
          'missingAxes', '[]'::jsonb, 'conflicts', '[]'::jsonb
        ))
        when p_result = 'partial' then jsonb_build_array(jsonb_build_object(
          'candidateKey', 'glucose_serum', 'maturity', 'reviewed', 'score', 75,
          'accepted', '[]'::jsonb, 'rejected', '[]'::jsonb,
          'missingAxes', '["specimen", "unit"]'::jsonb, 'conflicts', '[]'::jsonb
        ))
        else '[]'::jsonb
      end,
      'missingAxes', case
        when p_result = 'partial' then '["specimen", "unit"]'::jsonb
        else '[]'::jsonb
      end,
      'conflicts', '[]'::jsonb
    ),
    'resolver_trace_schema_version', '1',
    'normalized_unit', 'mg/dl', 'unit_dimension', 'mass_concentration',
    'catalog_manifest_version', '2026-07-28.0', 'catalog_manifest_digest', 'eh111-db-test-digest',
    'resolver_version', '7', 'normalization_version', '5'
  );
$$;

insert into public.profiles (id, email) values
  ('00000000-0000-0000-0000-000000001111', 'eh111-owner@example.test'),
  ('00000000-0000-0000-0000-000000001112', 'eh111-reviewer@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status) values
  ('00000000-0000-0000-0000-000000001121', '00000000-0000-0000-0000-000000001111', 'eh111/synthetic.pdf', 'synthetic.pdf', 'completed');

insert into public.document_extracted_biomarkers (id, document_id, profile_id, biomarker_name, status) values
  ('00000000-0000-0000-0000-000000001131', '00000000-0000-0000-0000-000000001121', '00000000-0000-0000-0000-000000001111', 'EH111 partial glucose', 'needs_review'),
  ('00000000-0000-0000-0000-000000001132', '00000000-0000-0000-0000-000000001121', '00000000-0000-0000-0000-000000001111', 'EH111 ambiguous glucose', 'needs_review'),
  ('00000000-0000-0000-0000-000000001133', '00000000-0000-0000-0000-000000001121', '00000000-0000-0000-0000-000000001111', 'EH111 resolved glucose', 'needs_review'),
  ('00000000-0000-0000-0000-000000001134', '00000000-0000-0000-0000-000000001121', '00000000-0000-0000-0000-000000001111', 'EH111 analyte-only glucose', 'needs_review');

select lives_ok($$
  select public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001131',
    public.eh111_db_observation_payload('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-000000001121', 'EH111 partial glucose'),
    public.eh111_db_resolution_payload('partial', null, null, jsonb_build_array(
      jsonb_build_object('axis', 'unit', 'code', 'unit_missing', 'state', 'missing'),
      jsonb_build_object('axis', 'specimen', 'code', 'specimen_missing', 'state', 'missing')
    )),
    'acceptance', '00000000-0000-0000-0000-000000001112', repeat('1', 64), null, 'additive', null, null, null, 'eh111-db-test', false
  )
$$, 'partial compatibility result writes without a concrete identity');

select is(
  (select resolver_result from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001131' and is_active),
  'partial', 'active revision retains the partial outcome'
);

select is(
  (select measurement_definition_key from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001131' and is_active),
  null, 'partial active revision has no concrete definition key'
);

select ok(
  (select resolver_evidence @> jsonb_build_array(jsonb_build_object('axis', 'unit', 'code', 'unit_missing', 'state', 'missing')) from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001131' and is_active),
  'active revision preserves the unit-missing evidence'
);

select ok(exists (
  select 1 from public.observations
  where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001131'
    and resolution_status = 'partial' and analyte_key is null and measurement_definition_key is null and normalization_revision_id is not null
), 'partial projection exposes no concrete Registry 2.0 identity');

select throws_ok($$
  select public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001132',
    public.eh111_db_observation_payload('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-000000001121', 'EH111 ambiguous glucose'),
    public.eh111_db_resolution_payload('ambiguous', 'glucose_serum', 'glucose', '[]'::jsonb),
    'acceptance', '00000000-0000-0000-0000-000000001112', repeat('2', 64), null, 'additive', null, null, null, 'eh111-db-test', false
  )
$$, 'P0001', 'incomplete_normalization_cannot_have_concrete_identity', 'ambiguous result cannot persist a concrete candidate key');

select throws_ok($$
  select public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001132',
    public.eh111_db_observation_payload('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-000000001121', 'EH111 partial glucose'),
    public.eh111_db_resolution_payload('partial', 'glucose_serum', 'glucose', '[]'::jsonb),
    'acceptance', '00000000-0000-0000-0000-000000001112', repeat('3', 64), null, 'additive', null, null, null, 'eh111-db-test', false
  )
$$, 'P0001', 'incomplete_normalization_cannot_have_concrete_identity', 'partial result cannot persist a concrete candidate key');

select is(
  (select count(*)::bigint from public.observations where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001132'),
  0::bigint, 'invalid incomplete writes roll back their source observation'
);

select lives_ok($$
  select public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001133',
    public.eh111_db_observation_payload('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-000000001121', 'EH111 resolved glucose'),
    public.eh111_db_resolution_payload('resolved', 'glucose_serum', 'glucose', jsonb_build_array(jsonb_build_object('axis', 'unit', 'state', 'compatible'))),
    'acceptance', '00000000-0000-0000-0000-000000001112', repeat('4', 64), null, 'additive', null, null, null, 'eh111-db-test', true
  )
$$, 'reviewed resolved result writes atomically');

select ok(exists (
  select 1 from public.observations
  where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001133'
    and resolution_status = 'resolved' and analyte_key = 'glucose' and measurement_definition_key = 'glucose_serum' and normalization_revision_id is not null
), 'resolved projection retains its reviewed concrete identity');

select throws_ok($$
  select public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001133',
    public.eh111_db_observation_payload('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-000000001121', 'EH111 unreviewed glucose'),
    public.eh111_db_resolution_payload('resolved', 'glucose_serum', 'glucose', '[]'::jsonb),
    'acceptance', '00000000-0000-0000-0000-000000001112', repeat('5', 64), null, 'additive', null, null, null, 'eh111-db-test', false
  )
$$, 'P0001', 'unreviewed_measurement_definition', 'resolved result requires reviewed-definition evidence');

-- #120: the middle case this suite never covered. Rows 1131 and 1132 assert the
-- two ends — no identity at all, and a fabricated concrete definition — but the
-- state a real incomplete row actually reaches is neither: the resolver knows
-- the analyte and cannot pick the definition. The guard used to reject it,
-- which made every recognized-incomplete row unacceptable.

select lives_ok($$
  select public.write_observation_normalization_revision_v2(
    '00000000-0000-0000-0000-000000001134',
    public.eh111_db_observation_payload('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-000000001121', 'EH111 analyte-only glucose'),
    public.eh111_db_resolution_payload('partial', null, 'glucose', jsonb_build_array(
      jsonb_build_object('axis', 'specimen', 'code', 'specimen_missing', 'state', 'missing')
    )),
    'acceptance', '00000000-0000-0000-0000-000000001112', repeat('6', 64), null, 'additive', null, null, null, 'eh111-db-test', false
  )
$$, 'partial result carrying only an analyte key writes atomically');

select is(
  (select analyte_key from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001134' and is_active),
  'glucose', 'analyte-level identity survives an incomplete outcome'
);

select ok(exists (
  select 1 from public.observations
  where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001134'
    and resolution_status = 'partial' and analyte_key = 'glucose' and measurement_definition_key is null and normalization_revision_id is not null
), 'the partial projection carries the analyte tier and no concrete definition');

select * from finish();
rollback;
