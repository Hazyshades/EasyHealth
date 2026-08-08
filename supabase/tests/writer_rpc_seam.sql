begin;

-- #117: the seam between the TypeScript writer and its own RPC.
--
-- Acceptance had never worked. The writer sends `resolver_evidence` as the v2
-- decision trace OBJECT; the RPC demanded an ARRAY, inherited from migration 021
-- when the column really did hold a flat evidence list. Every row failed with
-- `invalid_normalization_resolution_payload`, and nothing caught it: the pgTAP
-- fixture hand-built a valid array, and the TypeScript writer test mocks the
-- database. Neither ever crossed the seam.
--
-- This fixture submits the EXACT shape `buildNormalizationResolutionPayload`
-- produces. If the two drift again, this fails.

select plan(5);

insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000c0001');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type)
values (
  '00000000-0000-0000-0000-0000000c0002',
  '00000000-0000-0000-0000-0000000c0001',
  'seam/writer-rpc-seam.pdf',
  'writer-rpc-seam.pdf',
  'processing',
  'lab_result'
);

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, raw_name,
  value_numeric, value_text, value_kind, unit, raw_unit, raw_value_text,
  source_page, source_text, confidence, status, is_current, extraction_method
)
values (
  '00000000-0000-0000-0000-0000000c0003',
  '00000000-0000-0000-0000-0000000c0002',
  '00000000-0000-0000-0000-0000000c0001',
  'ALT (alanine aminotransferase)',
  'ALT (alanine aminotransferase)',
  28, '28', 'numeric', 'U/L', 'U/L', '28',
  1, 'ALT (alanine aminotransferase) 28 U/L',
  1, 'needs_review', true, 'llm'
);

-- Verbatim shape of `resolution.decisionTrace` as serialized by the writer:
-- an object with version / compatibilityPolicyVersion / selectedCandidateKey /
-- runnerUpCandidateKey / outcome / confidence / candidates.
create function public.seam_v2_trace() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'version', 2,
    'compatibilityPolicyVersion', 'seam-test',
    'selectedCandidateKey', 'null'::jsonb,
    'runnerUpCandidateKey', 'null'::jsonb,
    'outcome', 'partial',
    'confidence', 0.68,
    'candidates', jsonb_build_array(
      jsonb_build_object(
        'candidateKey', 'alt_serum_catalytic_activity',
        'accepted', '[]'::jsonb,
        'missing', '[]'::jsonb,
        'rejected', '[]'::jsonb,
        'missingAxes', jsonb_build_array('specimen'),
        'score', 68,
        'selectable', true,
        'eligible', false,
        'admissibilityRejections', jsonb_build_array('required_axis_missing')
      )
    )
  );
$$;

create function public.seam_resolution() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'input_evidence_hash', repeat('a', 64),
    'measurement_definition_key', 'null'::jsonb,
    'analyte_key', 'null'::jsonb,
    'resolver_result', 'partial',
    'mapping_confidence', 0.68,
    'mapping_confidence_band', 'medium',
    -- THE FIELD UNDER TEST: the v2 decision-trace object the writer sends.
    'resolver_evidence', public.seam_v2_trace(),
    'resolver_decision_trace', jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'partial',
      'decisionKind', 'recognized_incomplete',
      'inputEvidenceHash', repeat('a', 64),
      'catalogManifestVersion', 'seam-test',
      'catalogManifestDigest', 'seam-test-digest',
      'resolverVersion', 'seam-test',
      'winningCandidateKey', 'null'::jsonb,
      'candidates', '[]'::jsonb,
      'missingAxes', '[]'::jsonb,
      'conflicts', '[]'::jsonb
    ),
    'resolver_trace_schema_version', '1',
    'normalized_unit', 'u/l',
    'unit_dimension', 'enzyme_activity',
    'catalog_manifest_version', 'seam-test',
    'catalog_manifest_digest', 'seam-test-digest',
    'resolver_version', 'seam-test',
    'normalization_version', 'seam-test'
  );
$$;

create function public.seam_observation() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'profile_id', '00000000-0000-0000-0000-0000000c0001',
    'document_id', '00000000-0000-0000-0000-0000000c0002',
    'name', 'ALT (alanine aminotransferase)',
    'value', 28,
    'value_kind', 'numeric',
    'value_text', '28',
    'unit', 'U/L',
    'observed_at', '2026-08-07',
    'raw_name', 'ALT (alanine aminotransferase)',
    'raw_value_text', '28',
    'raw_unit', 'U/L',
    'source_page', 1,
    'provenance_schema_version', '1'
  );
$$;

-- ── 1. The writer's own payload is accepted ────────────────────────────────
--
-- This is the assertion that was missing. Before the fix it raised
-- `invalid_normalization_resolution_payload` for every row ever accepted.

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-0000000c0003',
      public.seam_observation(),
      public.seam_resolution(),
      'acceptance',
      '00000000-0000-0000-0000-0000000c0001',
      repeat('a', 64),
      null::uuid,
      'additive',
      null::text,
      null::uuid,
      null::uuid,
      'user',
      false
    )
  $$,
  'the RPC accepts the v2 decision-trace object the TypeScript writer actually sends'
);

-- ── 2. It really wrote an observation ──────────────────────────────────────

select is(
  (select count(*)::bigint from public.observations
   where source_extracted_biomarker_id = '00000000-0000-0000-0000-0000000c0003'),
  1::bigint,
  'accepting a partial row produces exactly one observation'
);

select is(
  (select resolver_result from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000c0003' and is_active),
  'partial',
  'the active revision keeps the partial outcome'
);

-- ── 3. The stored trace is still readable by the read path ─────────────────
--
-- `observation-read-boundaries` reads `.outcome` and `.selectedCandidateKey`
-- off this column, so it must remain an object, not be coerced.

select is(
  (select resolver_evidence ->> 'outcome' from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000c0003' and is_active),
  'partial',
  'the stored evidence is still an object the read path can traverse'
);

-- ── 4. Garbage is still rejected ───────────────────────────────────────────

select throws_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-0000000c0003',
      public.seam_observation(),
      public.seam_resolution() || jsonb_build_object('resolver_evidence', to_jsonb('nonsense'::text)),
      'acceptance',
      '00000000-0000-0000-0000-0000000c0001',
      repeat('b', 64),
      null::uuid,
      'additive',
      null::text,
      null::uuid,
      null::uuid,
      'user',
      false
    )
  $$,
  'invalid_normalization_resolution_payload',
  'a scalar is still not acceptable evidence'
);

select * from finish();
rollback;
