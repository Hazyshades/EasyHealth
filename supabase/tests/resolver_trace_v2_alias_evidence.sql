begin;

-- Versioned persisted resolver decision trace.
--
-- Schema 1 is frozen: traces already stored against patient revisions must keep
-- validating and must never be rewritten. Schema 2 adds the alias evidence that
-- explains which alias admitted a candidate, and the trace is the source of
-- truth for those facts: `resolver_evidence` may not disagree with it.

select plan(26);

insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000d0001');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type)
values (
  '00000000-0000-0000-0000-0000000d0002',
  '00000000-0000-0000-0000-0000000d0001',
  'trace-v2/multilingual.pdf',
  'multilingual.pdf',
  'processing',
  'lab_result'
);

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, raw_name,
  value_numeric, value_text, value_kind, unit, raw_unit, raw_value_text,
  source_page, source_text, confidence, status, is_current, extraction_method
)
values
  (
    '00000000-0000-0000-0000-0000000d0003',
    '00000000-0000-0000-0000-0000000d0002',
    '00000000-0000-0000-0000-0000000d0001',
    'Hemoglobin', 'Гемоглобин',
    142, '142', 'numeric', 'g/L', 'g/L', '142',
    1, 'Гемоглобин, цельная кровь 142 g/L',
    1, 'needs_review', true, 'llm'
  ),
  (
    '00000000-0000-0000-0000-0000000d0004',
    '00000000-0000-0000-0000-0000000d0002',
    '00000000-0000-0000-0000-0000000d0001',
    'Triglycerides', 'Trigliceridos',
    1.3, '1.3', 'numeric', 'mmol/L', 'mmol/L', '1.3',
    1, 'Trigliceridos, suero 1.3 mmol/L',
    1, 'needs_review', true, 'llm'
  ),
  (
    '00000000-0000-0000-0000-0000000d0005',
    '00000000-0000-0000-0000-0000000d0002',
    '00000000-0000-0000-0000-0000000d0001',
    'Glucose', 'Глюкоза',
    5.1, '5.1', 'numeric', 'mmol/L', 'mmol/L', '5.1',
    1, 'Глюкоза 5.1 mmol/L',
    1, 'needs_review', true, 'llm'
  ),
  (
    '00000000-0000-0000-0000-0000000d0006',
    '00000000-0000-0000-0000-0000000d0002',
    '00000000-0000-0000-0000-0000000d0001',
    'ALT', 'ALT (alanine aminotransferase)',
    28, '28', 'numeric', 'U/L', 'U/L', '28',
    1, 'ALT (alanine aminotransferase) 28 U/L',
    1, 'needs_review', true, 'llm'
  );

-- ── Fixtures ───────────────────────────────────────────────────────────────

-- A schema-1 trace exactly as it was written before schema 2 existed.
create function public.trace_v1_fixture() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'schemaVersion', '1',
    'outcome', 'resolved',
    'decisionKind', 'single_reviewed_candidate',
    'inputEvidenceHash', repeat('a', 64),
    'catalogManifestVersion', '2026-08-03.0',
    'catalogManifestDigest', repeat('b', 64),
    'resolverVersion', '10',
    'winningCandidateKey', 'alt_serum_catalytic_activity',
    'candidates', jsonb_build_array(
      jsonb_build_object(
        'candidateKey', 'alt_serum_catalytic_activity',
        'maturity', 'reviewed',
        'score', 61,
        'accepted', jsonb_build_array(
          jsonb_build_object('code', 'alias_normalized_match', 'strength', 'strong'),
          jsonb_build_object('code', 'unit_compatible', 'strength', 'strong')
        ),
        'rejected', '[]'::jsonb,
        'missingAxes', '[]'::jsonb,
        'conflicts', '[]'::jsonb
      )
    ),
    'missingAxes', '[]'::jsonb,
    'conflicts', '[]'::jsonb
  );
$$;

create function public.trace_v2_candidate(
  p_candidate_key text,
  p_alias_key text,
  p_locale text,
  p_laboratory jsonb,
  p_fold_fallback boolean
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'candidateKey', p_candidate_key,
    'maturity', 'reviewed',
    'score', 75,
    'accepted', jsonb_build_array(
      jsonb_build_object('code', 'alias_normalized_match', 'strength', 'strong'),
      jsonb_build_object('code', 'unit_compatible', 'strength', 'strong'),
      jsonb_build_object('code', 'specimen_compatible', 'strength', 'strong')
    ),
    'rejected', '[]'::jsonb,
    'missingAxes', '[]'::jsonb,
    'conflicts', '[]'::jsonb,
    'aliasKey', p_alias_key,
    'aliasMatchType', 'normalized',
    'aliasLocale', p_locale,
    'aliasLaboratory', p_laboratory,
    'aliasFoldFallback', p_fold_fallback
  );
$$;

create function public.trace_v2_fixture(
  p_candidate_key text,
  p_alias_key text,
  p_locale text,
  p_fold_fallback boolean,
  p_hash text
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'schemaVersion', '2',
    'outcome', 'resolved',
    'decisionKind', 'single_reviewed_candidate',
    'inputEvidenceHash', p_hash,
    'catalogManifestVersion', '2026-08-09.0',
    'catalogManifestDigest', repeat('c', 64),
    'resolverVersion', '11',
    'winningCandidateKey', p_candidate_key,
    'candidates', jsonb_build_array(
      public.trace_v2_candidate(p_candidate_key, p_alias_key, p_locale, 'null'::jsonb, p_fold_fallback)
    ),
    'missingAxes', '[]'::jsonb,
    'conflicts', '[]'::jsonb
  );
$$;

-- The operational `resolver_evidence` object, carrying the same alias facts.
create function public.evidence_fixture(
  p_candidate_key text,
  p_alias_key text,
  p_locale text,
  p_fold_fallback boolean
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'version', 2,
    'compatibilityPolicyVersion', '1',
    'selectedCandidateKey', to_jsonb(p_candidate_key),
    'runnerUpCandidateKey', 'null'::jsonb,
    'outcome', 'resolved',
    'confidence', 0.75,
    'candidates', jsonb_build_array(
      jsonb_build_object(
        'candidateKey', p_candidate_key,
        'accepted', '[]'::jsonb,
        'missing', '[]'::jsonb,
        'rejected', '[]'::jsonb,
        'missingAxes', '[]'::jsonb,
        'score', 75,
        'selectable', true,
        'eligible', true,
        'admissibilityRejections', '[]'::jsonb,
        'matchedAlias', jsonb_build_object(
          'key', p_alias_key,
          'measurementDefinitionKey', p_candidate_key,
          'matchType', 'normalized',
          'matchAuthority', 'reviewed_resolution',
          'approvalStatus', 'reviewed',
          'lifecycle', 'active',
          'locale', p_locale,
          'foldFallback', p_fold_fallback,
          'value', 'catalog-literal',
          'normalizedValue', 'catalog-literal',
          'provenance', jsonb_build_object('kind', 'registry_v2_review', 'sourceRecordKey', 'registry-2.0:test')
        )
      )
    )
  );
$$;

create function public.resolution_fixture(
  p_candidate_key text,
  p_analyte_key text,
  p_trace jsonb,
  p_evidence jsonb,
  p_hash text,
  p_schema_version text
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'input_evidence_hash', p_hash,
    'measurement_definition_key', p_candidate_key,
    'analyte_key', p_analyte_key,
    'resolver_result', 'resolved',
    'mapping_confidence', 0.75,
    'mapping_confidence_band', 'medium',
    'resolver_evidence', p_evidence,
    'resolver_decision_trace', p_trace,
    'resolver_trace_schema_version', p_schema_version,
    'normalized_unit', 'g/l',
    'unit_dimension', 'mass_concentration',
    'catalog_manifest_version', p_trace ->> 'catalogManifestVersion',
    'catalog_manifest_digest', p_trace ->> 'catalogManifestDigest',
    'resolver_version', p_trace ->> 'resolverVersion',
    'normalization_version', '7'
  );
$$;

create function public.observation_fixture(p_name text, p_raw_name text, p_value numeric)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'profile_id', '00000000-0000-0000-0000-0000000d0001',
    'document_id', '00000000-0000-0000-0000-0000000d0002',
    'name', p_name,
    'value', p_value,
    'value_kind', 'numeric',
    'value_text', p_value::text,
    'unit', 'g/L',
    'observed_at', '2026-08-10',
    'raw_name', p_raw_name,
    'raw_value_text', p_value::text,
    'raw_unit', 'g/L',
    'source_page', 1,
    'provenance_schema_version', '2'
  );
$$;

-- ── 1. Schema 1 is untouched ───────────────────────────────────────────────

select ok(
  public.eh115_validate_resolver_decision_trace(public.trace_v1_fixture(), '1'),
  'a schema-1 trace written before schema 2 existed still validates'
);

select ok(
  public.eh115_validate_resolver_decision_trace(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'hemoglobin_whole_blood:ru:laboratory:12', 'ru', false, repeat('d', 64)),
    '2'
  ),
  'a schema-2 trace with alias evidence validates'
);

-- ── 2. Schema 2 is not a loophole ──────────────────────────────────────────

select ok(
  not public.eh115_validate_resolver_decision_trace(
    jsonb_set(
      public.trace_v2_fixture('hemoglobin_whole_blood', 'hemoglobin_whole_blood:ru:laboratory:12', 'ru', false, repeat('d', 64)),
      '{candidates,0}',
      (public.trace_v2_fixture('hemoglobin_whole_blood', 'hemoglobin_whole_blood:ru:laboratory:12', 'ru', false, repeat('d', 64)) -> 'candidates' -> 0) - 'aliasLocale'
    ),
    '2'
  ),
  'a schema-2 candidate missing alias evidence is rejected'
);

select ok(
  not public.eh115_validate_resolver_decision_trace(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'hemoglobin_whole_blood:de:laboratory:12', 'de', false, repeat('d', 64)),
    '2'
  ),
  'an unsupported alias locale is rejected'
);

select ok(
  not public.eh115_validate_resolver_decision_trace(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'bad alias key with spaces', 'ru', false, repeat('d', 64)),
    '2'
  ),
  'a malformed alias key is rejected'
);

select ok(
  not public.eh115_validate_resolver_decision_trace(public.trace_v1_fixture(), '2'),
  'a schema-1 trace declared as schema 2 is rejected'
);

select ok(
  not public.eh115_validate_resolver_decision_trace(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'hemoglobin_whole_blood:ru:laboratory:12', 'ru', false, repeat('d', 64)),
    '3'
  ),
  'an unsupported schema version is rejected'
);

-- ── 3. Trace and resolver_evidence may not diverge ─────────────────────────

select ok(
  public.eh122_trace_matches_resolver_evidence(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'alias:ru:1', 'ru', false, repeat('d', 64)),
    public.evidence_fixture('hemoglobin_whole_blood', 'alias:ru:1', 'ru', false)
  ),
  'matching alias facts pass the consistency check'
);

select ok(
  not public.eh122_trace_matches_resolver_evidence(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'alias:ru:1', 'ru', false, repeat('d', 64)),
    public.evidence_fixture('hemoglobin_whole_blood', 'alias:ru:1', 'es', false)
  ),
  'a divergent alias locale fails the consistency check'
);

select ok(
  not public.eh122_trace_matches_resolver_evidence(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'alias:ru:1', 'ru', false, repeat('d', 64)),
    public.evidence_fixture('hemoglobin_whole_blood', 'alias:ru:2', 'ru', false)
  ),
  'a divergent alias key fails the consistency check'
);

select ok(
  not public.eh122_trace_matches_resolver_evidence(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'alias:ru:1', 'ru', false, repeat('d', 64)),
    public.evidence_fixture('hemoglobin_whole_blood', 'alias:ru:1', 'ru', true)
  ),
  'a divergent fold-fallback flag fails the consistency check'
);

select ok(
  not public.eh122_trace_matches_resolver_evidence(
    public.trace_v2_fixture('hemoglobin_whole_blood', 'alias:ru:1', 'ru', false, repeat('d', 64)),
    '[]'::jsonb
  ),
  'legacy array-shaped evidence cannot accompany a schema-2 trace'
);

select ok(
  public.eh122_trace_matches_resolver_evidence(public.trace_v1_fixture(), '[]'::jsonb),
  'a schema-1 trace is out of scope for the alias consistency check'
);

-- ── 4. Round-trip through the writer RPC ───────────────────────────────────

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-0000000d0003',
      public.observation_fixture('Hemoglobin', 'Гемоглобин', 142),
      public.resolution_fixture(
        'hemoglobin_whole_blood',
        'hemoglobin',
        public.trace_v2_fixture('hemoglobin_whole_blood', 'hemoglobin_whole_blood:ru:laboratory:12', 'ru', false, repeat('d', 64)),
        public.evidence_fixture('hemoglobin_whole_blood', 'hemoglobin_whole_blood:ru:laboratory:12', 'ru', false),
        repeat('d', 64),
        '2'
      ),
      'acceptance',
      '00000000-0000-0000-0000-0000000d0001',
      repeat('1', 64),
      null::uuid,
      'additive',
      null::text,
      null::uuid,
      null::uuid,
      'user',
      true
    )
  $$,
  'the writer RPC accepts a schema-2 trace for a Russian label'
);

select is(
  (select resolver_trace_schema_version from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0003' and is_active),
  '2',
  'the stored revision records schema version 2'
);

select is(
  (select resolver_decision_trace -> 'candidates' -> 0 ->> 'aliasLocale'
   from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0003' and is_active),
  'ru',
  'the Russian alias locale survives persistence and read-back'
);

select is(
  (select resolver_decision_trace -> 'candidates' -> 0 ->> 'aliasKey'
   from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0003' and is_active),
  'hemoglobin_whole_blood:ru:laboratory:12',
  'the admitting alias identity survives persistence'
);

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-0000000d0004',
      public.observation_fixture('Triglycerides', 'Trigliceridos', 1.3),
      public.resolution_fixture(
        'triglycerides_serum',
        'triglycerides',
        public.trace_v2_fixture('triglycerides_serum', 'triglycerides_serum:es:laboratory:9', 'es', true, repeat('e', 64)),
        public.evidence_fixture('triglycerides_serum', 'triglycerides_serum:es:laboratory:9', 'es', true),
        repeat('e', 64),
        '2'
      ),
      'acceptance',
      '00000000-0000-0000-0000-0000000d0001',
      repeat('2', 64),
      null::uuid,
      'additive',
      null::text,
      null::uuid,
      null::uuid,
      'user',
      true
    )
  $$,
  'the writer RPC accepts a schema-2 trace for a Spanish fold-fallback match'
);

select is(
  (select (resolver_decision_trace -> 'candidates' -> 0 ->> 'aliasFoldFallback')::boolean
   from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0004' and is_active),
  true,
  'the Spanish accent-fold fallback flag survives persistence'
);

select is(
  (select resolver_decision_trace -> 'candidates' -> 0 ->> 'aliasLocale'
   from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0004' and is_active),
  'es',
  'the Spanish alias locale survives persistence'
);

-- ── 5. Divergence is refused at the boundary ───────────────────────────────

select throws_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-0000000d0005',
      public.observation_fixture('Glucose', 'Глюкоза', 5.1),
      public.resolution_fixture(
        'glucose_serum',
        'glucose',
        public.trace_v2_fixture('glucose_serum', 'glucose_serum:ru:laboratory:3', 'ru', false, repeat('f', 64)),
        public.evidence_fixture('glucose_serum', 'glucose_serum:es:laboratory:3', 'es', false),
        repeat('f', 64),
        '2'
      ),
      'acceptance',
      '00000000-0000-0000-0000-0000000d0001',
      repeat('3', 64),
      null::uuid,
      'additive',
      null::text,
      null::uuid,
      null::uuid,
      'user',
      true
    )
  $$,
  'resolver_trace_evidence_divergence',
  'the writer refuses a payload whose trace and evidence disagree about the alias'
);

-- ── 6. Immutability still holds ────────────────────────────────────────────

select throws_ok(
  $$
    update public.observation_normalization_revisions
    set resolver_decision_trace = jsonb_set(
      resolver_decision_trace,
      '{candidates,0,aliasLocale}',
      to_jsonb('es'::text)
    )
    where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0003' and is_active
  $$,
  'resolver_decision_trace_immutable',
  'a stored trace cannot be rewritten after the fact'
);

-- ── 7. Schema 1 still writes and reads, with no backfill ───────────────────

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-0000000d0006',
      public.observation_fixture('ALT', 'ALT (alanine aminotransferase)', 28),
      public.resolution_fixture(
        'alt_serum_catalytic_activity',
        'alt',
        public.trace_v1_fixture(),
        public.evidence_fixture('alt_serum_catalytic_activity', 'alias:en:1', 'en', false),
        repeat('a', 64),
        '1'
      ),
      'acceptance',
      '00000000-0000-0000-0000-0000000d0001',
      repeat('4', 64),
      null::uuid,
      'additive',
      null::text,
      null::uuid,
      null::uuid,
      'user',
      true
    )
  $$,
  'a schema-1 payload is still accepted after schema 2 exists'
);

select is(
  (select resolver_trace_schema_version from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0006' and is_active),
  '1',
  'the schema-1 revision keeps its version, with no backfill to schema 2'
);

select ok(
  (select public.eh115_validate_resolver_decision_trace(resolver_decision_trace, resolver_trace_schema_version)
   from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0006' and is_active),
  'the stored schema-1 trace still validates when read back'
);

select ok(
  (select public.eh115_validate_resolver_decision_trace(resolver_decision_trace, resolver_trace_schema_version)
   from public.observation_normalization_revisions
   where extracted_biomarker_id = '00000000-0000-0000-0000-0000000d0003' and is_active),
  'the stored schema-2 trace validates when read back'
);

select * from finish();

rollback;
