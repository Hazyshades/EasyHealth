-- EH-121: observation change history ledger, capture triggers, and append-only
-- guarantees.
--
-- Events are captured from the append-only stores themselves, so this test
-- drives the sources (normalization revisions, extracted-row supersession) and
-- asserts on the ledger rather than inserting events directly. Direct inserts
-- are used only where a constraint is under test.
begin;

select plan(37);

-- ── 1. Privilege matrix ──────────────────────────────────────────────────────

select ok(
  has_table_privilege('service_role', 'public.observation_change_events', 'SELECT'),
  'service_role can read the change history'
);

select ok(
  has_table_privilege('service_role', 'public.observation_change_events', 'INSERT'),
  'service_role can append to the change history'
);

select ok(
  not has_table_privilege('service_role', 'public.observation_change_events', 'UPDATE'),
  'service_role cannot update the change history'
);

select ok(
  not has_table_privilege('service_role', 'public.observation_change_events', 'DELETE'),
  'service_role cannot delete from the change history'
);

select ok(
  not has_table_privilege('anon', 'public.observation_change_events', 'SELECT'),
  'anon cannot read the change history'
);

select ok(
  not has_table_privilege('authenticated', 'public.observation_change_events', 'SELECT'),
  'authenticated cannot read the change history'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.observation_change_events'::regclass
  ),
  'row level security is enabled on the change history'
);

-- ── 2. The ledger carries no raw document text ───────────────────────────────

select is(
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'observation_change_events'
      and column_name in (
        'raw_name',
        'raw_value_text',
        'raw_reference_text',
        'raw_unit',
        'source_text',
        'bounding_box',
        'resolver_decision_trace',
        'resolver_evidence'
      )
  ),
  0,
  'the ledger declares no column that could duplicate raw document text'
);

-- ── 3. Fixtures ──────────────────────────────────────────────────────────────

insert into public.profiles (id)
values ('00000000-0000-0000-0000-000000000121')
on conflict (id) do nothing;

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values (
  '00000000-0000-0000-0000-000000000122',
  '00000000-0000-0000-0000-000000000121',
  'eh121/doc',
  'eh121.pdf',
  'completed'
)
on conflict (id) do nothing;

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, raw_name, value_numeric, unit,
  raw_unit, raw_value_text, specimen, source_page, source_text, confidence,
  processing_version, catalog_manifest_version, catalog_manifest_digest,
  resolver_version, normalization_version, resolver_result
)
values (
  '00000000-0000-0000-0000-000000000123',
  '00000000-0000-0000-0000-000000000122',
  '00000000-0000-0000-0000-000000000121',
  'Glucose', 'Glucose', 90, 'mg/dL', 'mg/dL', '90', 'serum', 1, 'Glucose 90 mg/dL', 0.95,
  'eh121-fixture', '2026-08-10.0', repeat('a', 64), '8', '5', 'resolved'
)
on conflict (id) do nothing;

-- ── 4. Acceptance is captured with a null prior side ─────────────────────────

insert into public.observation_normalization_revisions (
  id, extracted_biomarker_id, input_evidence_hash, measurement_definition_key,
  analyte_key, resolver_result, mapping_confidence, mapping_confidence_band,
  verification_status, is_active, catalog_manifest_version,
  catalog_manifest_digest, resolver_version, normalization_version,
  extraction_version
)
values (
  '00000000-0000-0000-0000-0000000001a1',
  '00000000-0000-0000-0000-000000000123',
  repeat('b', 64),
  'glucose_serum_fasting',
  'glucose',
  'resolved',
  0.91,
  'high',
  'pending',
  true,
  '2026-08-10.0',
  repeat('a', 64),
  '8',
  '5',
  'eh121-fixture'
);

select is(
  (
    select event_kind::text
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a1'
  ),
  'observation_accepted',
  'a first active revision is captured as an acceptance'
);

select is(
  (
    select prior_measurement_definition_key
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a1'
  ),
  null::text,
  'a first acceptance has no prior mapping'
);

select is(
  (
    select next_input_evidence_hash
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a1'
  ),
  repeat('b', 64),
  'evidence is referenced by its hash'
);

select is(
  (
    select actor_type
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a1'
  ),
  'system',
  'a revision with no attributable actor is captured as an automatic change'
);

select is(
  (
    select origin::text
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a1'
  ),
  'capture',
  'a live capture is not marked as reconstructed'
);

-- ── 5. A correction is captured with both axes it moved ──────────────────────

update public.observation_normalization_revisions
set is_active = false
where id = '00000000-0000-0000-0000-0000000001a1';

insert into public.observation_normalization_revisions (
  id, extracted_biomarker_id, input_evidence_hash, measurement_definition_key,
  analyte_key, resolver_result, mapping_confidence, mapping_confidence_band,
  verification_status, verification_decided_at, verification_actor_type,
  verification_actor_id, is_active, supersedes_revision_id, created_by,
  correction_reason, mapping_change_classification, catalog_manifest_version,
  catalog_manifest_digest, resolver_version, normalization_version
)
values (
  '00000000-0000-0000-0000-0000000001a2',
  '00000000-0000-0000-0000-000000000123',
  repeat('c', 64),
  'glucose_plasma_fasting',
  'glucose',
  'resolved',
  0.99,
  'high',
  'manually_corrected',
  now(),
  'user',
  '00000000-0000-0000-0000-000000000121',
  true,
  '00000000-0000-0000-0000-0000000001a1',
  '00000000-0000-0000-0000-000000000121',
  'Report states plasma',
  'review_required',
  '2026-08-10.0',
  repeat('a', 64),
  '8',
  '5'
);

select is(
  (
    select event_kind::text
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a2'
  ),
  'mapping_corrected',
  'a revision that changes the measurement key is captured as a correction'
);

select is(
  (
    select prior_measurement_definition_key || ' -> ' || next_measurement_definition_key
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a2'
  ),
  'glucose_serum_fasting -> glucose_plasma_fasting',
  'the correction records the mapping it replaced'
);

select is(
  (
    select prior_verification_status || ' -> ' || next_verification_status
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a2'
  ),
  'pending -> manually_corrected',
  'the same event also records the verification transition it caused'
);

select is(
  (
    select actor_type || ':' || actor_id::text
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a2'
  ),
  'user:00000000-0000-0000-0000-000000000121',
  'a user correction attributes the acting profile'
);

select is(
  (
    select correction_reason
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a2'
  ),
  'Report states plasma',
  'the recorded reason is captured'
);

select is(
  (
    select source_prior_revision_id
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a2'
  ),
  '00000000-0000-0000-0000-0000000001a1'::uuid,
  'the event references the revision it superseded'
);

-- ── 6. A reversal outranks the mapping change it performs ────────────────────

update public.observation_normalization_revisions
set is_active = false
where id = '00000000-0000-0000-0000-0000000001a2';

insert into public.observation_normalization_revisions (
  id, extracted_biomarker_id, input_evidence_hash, measurement_definition_key,
  analyte_key, resolver_result, mapping_confidence, mapping_confidence_band,
  verification_status, verification_decided_at, verification_actor_type,
  verification_actor_id, is_active, supersedes_revision_id,
  reversal_of_revision_id, created_by, correction_reason,
  mapping_change_classification, catalog_manifest_version,
  catalog_manifest_digest, resolver_version, normalization_version
)
values (
  '00000000-0000-0000-0000-0000000001a3',
  '00000000-0000-0000-0000-000000000123',
  repeat('d', 64),
  'glucose_serum_fasting',
  'glucose',
  'resolved',
  0.91,
  'high',
  'manually_corrected',
  now(),
  'user',
  '00000000-0000-0000-0000-000000000121',
  true,
  '00000000-0000-0000-0000-0000000001a2',
  '00000000-0000-0000-0000-0000000001a1',
  '00000000-0000-0000-0000-000000000121',
  'Manual correction reverted',
  'review_required',
  '2026-08-10.0',
  repeat('a', 64),
  '8',
  '5'
);

select is(
  (
    select event_kind::text
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a3'
  ),
  'correction_reverted',
  'a reversal is captured as a reversal, not as another correction'
);

-- ── 7. A verification-only change is captured as such ────────────────────────

update public.observation_normalization_revisions
set is_active = false
where id = '00000000-0000-0000-0000-0000000001a3';

insert into public.observation_normalization_revisions (
  id, extracted_biomarker_id, input_evidence_hash, measurement_definition_key,
  analyte_key, resolver_result, mapping_confidence, mapping_confidence_band,
  verification_status, verification_decided_at, verification_actor_type,
  verification_actor_id, is_active, supersedes_revision_id, created_by,
  catalog_manifest_version, catalog_manifest_digest, resolver_version,
  normalization_version
)
values (
  '00000000-0000-0000-0000-0000000001a4',
  '00000000-0000-0000-0000-000000000123',
  repeat('e', 64),
  'glucose_serum_fasting',
  'glucose',
  'resolved',
  0.91,
  'high',
  'user_verified',
  now(),
  'user',
  '00000000-0000-0000-0000-000000000121',
  true,
  '00000000-0000-0000-0000-0000000001a3',
  '00000000-0000-0000-0000-000000000121',
  '2026-08-10.0',
  repeat('a', 64),
  '8',
  '5'
);

select is(
  (
    select event_kind::text
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a4'
  ),
  'verification_changed',
  'an unchanged mapping with a new verification state is a verification change'
);

-- ── 8. Capture is idempotent per revision ────────────────────────────────────

update public.observation_normalization_revisions
set is_active = false
where id = '00000000-0000-0000-0000-0000000001a4';

update public.observation_normalization_revisions
set is_active = true
where id = '00000000-0000-0000-0000-0000000001a4';

select is(
  (
    select count(*)::int
    from public.observation_change_events
    where source_revision_id = '00000000-0000-0000-0000-0000000001a4'
  ),
  1,
  'reactivating a revision does not append a second event'
);

select is(
  (
    select count(*)::int
    from public.observation_change_events
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000000123'
  ),
  4,
  'the extracted row has exactly one event per revision'
);

-- ── 9. Reprocessing supersession is captured ─────────────────────────────────
-- EH-120 owns the lifecycle axis. Keep the legacy extraction event suppressed
-- when the same update records the authoritative record-superseded event.
select set_config('easyhealth.lifecycle_transition', 'on', true);
update public.document_extracted_biomarkers
set record_status = 'superseded',
    is_current = false,
    superseded_at = now(),
    lifecycle_reason_code = 'document_reprocessed',
    lifecycle_request_hash = repeat('c', 64)
where id = '00000000-0000-0000-0000-000000000123';
select set_config('easyhealth.lifecycle_transition', '', true);

select is(
  (
    select count(*)::int
    from public.observation_change_events
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000000123'
      and event_kind = 'record_superseded'
  ),
  1,
  'retiring an extracted row records the authoritative lifecycle replacement'
);

select is(
  (
    select count(*)::int
    from public.observation_change_events
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000000123'
      and event_kind = 'extraction_superseded'
  ),
  0,
  'EH-120 lifecycle capture prevents a duplicate legacy supersession event'
);

-- ── 10. Append-only enforcement ──────────────────────────────────────────────

select throws_ok(
  $$update public.observation_change_events
      set correction_reason = 'rewritten'
      where source_revision_id = '00000000-0000-0000-0000-0000000001a2'$$,
  'observation_change_events_append_only',
  'an audit row cannot be rewritten'
);

select throws_ok(
  $$delete from public.observation_change_events
      where source_revision_id = '00000000-0000-0000-0000-0000000001a2'$$,
  'observation_change_events_append_only',
  'an audit row cannot be deleted while its document exists'
);

-- ── 11. Redaction is enforced, not conventional ──────────────────────────────

select throws_ok(
  $$insert into public.observation_change_events (
      event_kind, profile_id, document_id, extracted_biomarker_id,
      next_input_evidence_hash
    )
    values (
      'observation_accepted',
      '00000000-0000-0000-0000-000000000121',
      '00000000-0000-0000-0000-000000000122',
      '00000000-0000-0000-0000-000000000123',
      'Glucose 90 mg/dL'
    )$$,
  '23514',
  null,
  'a value that is not a 64-hex hash cannot be stored in an evidence column'
);

select throws_ok(
  $$insert into public.observation_change_events (
      event_kind, profile_id, document_id, extracted_biomarker_id,
      actor_type, actor_id
    )
    values (
      'observation_accepted',
      '00000000-0000-0000-0000-000000000121',
      '00000000-0000-0000-0000-000000000122',
      '00000000-0000-0000-0000-000000000123',
      'system',
      '00000000-0000-0000-0000-000000000121'
    )$$,
  '23514',
  null,
  'an automatic change cannot claim a human actor'
);

-- ── 12. The production write path is audited ─────────────────────────────────
--
-- Every section above drives the revision store directly. This one goes
-- through the EH-106/EH-115 writer the application actually calls, which
-- inserts an inactive revision and promotes it in a second statement — the
-- path the capture trigger has to handle without recording a half-bound event.

create function pg_temp.eh121_observation_payload(p_name text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'profile_id', '00000000-0000-0000-0000-000000000121',
    'document_id', '00000000-0000-0000-0000-000000000122',
    'name', p_name,
    'value', 90, 'value_kind', 'numeric', 'value_text', '90', 'unit', 'mg/dL',
    'observed_at', '2026-08-10', 'specimen', 'serum', 'modifier', 'none',
    'raw_name', p_name, 'raw_value_text', '90', 'raw_unit', 'mg/dL',
    'source_page', 1,
    'provenance_schema_version', '1'
  );
$$;

create function pg_temp.eh121_resolution_payload(p_key text, p_hash text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'input_evidence_hash', p_hash,
    'measurement_definition_key', p_key,
    'analyte_key', 'glucose',
    'resolver_result', 'resolved',
    'mapping_confidence', 0.75,
    'mapping_confidence_band', 'medium',
    'resolver_evidence', jsonb_build_array(
      jsonb_build_object('axis', 'unit', 'state', 'compatible')
    ),
    'resolver_decision_trace', jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'resolved',
      'decisionKind', 'single_reviewed_candidate',
      'inputEvidenceHash', p_hash,
      'catalogManifestVersion', '2026-08-10.0',
      'catalogManifestDigest', 'eh121-db-test-digest',
      'resolverVersion', '8',
      'winningCandidateKey', p_key,
      'candidates', jsonb_build_array(jsonb_build_object(
        'candidateKey', p_key, 'maturity', 'reviewed', 'score', 75,
        'accepted', '[]'::jsonb, 'rejected', '[]'::jsonb,
        'missingAxes', '[]'::jsonb, 'conflicts', '[]'::jsonb
      )),
      'missingAxes', '[]'::jsonb,
      'conflicts', '[]'::jsonb
    ),
    'resolver_trace_schema_version', '1',
    'normalized_unit', 'mg/dl', 'unit_dimension', 'mass_concentration',
    'catalog_manifest_version', '2026-08-10.0',
    'catalog_manifest_digest', 'eh121-db-test-digest',
    'resolver_version', '8', 'normalization_version', '5'
  );
$$;

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, raw_name, value_numeric, unit,
  source_page, source_text, processing_version, status
)
values (
  '00000000-0000-0000-0000-000000000124',
  '00000000-0000-0000-0000-000000000122',
  '00000000-0000-0000-0000-000000000121',
  'Writer glucose', 'Writer glucose', 90, 'mg/dL', 1, 'Writer glucose 90 mg/dL',
  'eh121-fixture', 'needs_review'
);

select lives_ok(
  $$select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000124',
      pg_temp.eh121_observation_payload('Writer glucose'),
      pg_temp.eh121_resolution_payload('glucose_serum', repeat('1', 64)),
      'acceptance', '00000000-0000-0000-0000-000000000121', repeat('7', 64),
      null, 'additive', null, null, null, 'eh121-fixture', true
    )$$,
  'the production writer accepts a reviewed resolved row'
);

select is(
  (
    select event_kind::text
    from public.observation_change_events
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000000124'
  ),
  'observation_accepted',
  'the production write path is captured as an acceptance'
);

select ok(
  (
    select event.observation_id is not null
      and event.observation_id = observation.id
    from public.observation_change_events as event
    join public.observations as observation
      on observation.source_extracted_biomarker_id = '00000000-0000-0000-0000-000000000124'
    where event.extracted_biomarker_id = '00000000-0000-0000-0000-000000000124'
  ),
  'the captured event is bound to the observation the writer promoted'
);

select lives_ok(
  $$select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000124',
      pg_temp.eh121_observation_payload('Writer glucose'),
      pg_temp.eh121_resolution_payload('glucose_plasma', repeat('2', 64)),
      'correction', '00000000-0000-0000-0000-000000000121', repeat('8', 64),
      (
        select id from public.observation_normalization_revisions
        where extracted_biomarker_id = '00000000-0000-0000-0000-000000000124'
          and is_active
      ),
      'additive', 'Report states plasma', null,
      (
        select id from public.observation_normalization_revisions
        where extracted_biomarker_id = '00000000-0000-0000-0000-000000000124'
          and is_active
      ),
      'eh121-fixture', true
    )$$,
  'the production writer records a manual correction'
);

select is(
  (
    select prior_measurement_definition_key || ' -> ' || next_measurement_definition_key
      || ' by ' || actor_type
    from public.observation_change_events
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000000124'
      and event_kind = 'mapping_corrected'
  ),
  'glucose_serum -> glucose_plasma by user',
  'the correction written by the production path carries its diff and actor'
);

select is(
  (
    select count(*)::int
    from public.observation_change_events
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000000124'
  ),
  2,
  'the production path appends exactly one event per write'
);

-- ── 13. Erasure still works ──────────────────────────────────────────────────

-- Production deletes a document by purging its derived laboratory lineage
-- first (EH-104 Phase B forbids deleting a revision outside that context), so
-- the guard is exercised on the path that actually runs.
select public.purge_document_derived_laboratory_lineage(
  '00000000-0000-0000-0000-000000000122'
);

select is(
  (
    select count(*)::int
    from public.observation_change_events
    where document_id = '00000000-0000-0000-0000-000000000122'
  ),
  0,
  'purging derived lineage removes its history instead of being blocked by the guard'
);

delete from public.documents
where id = '00000000-0000-0000-0000-000000000122';

-- A document with no normalization revisions can be deleted outright; the
-- guard must let its events cascade away with it.
insert into public.documents (id, profile_id, storage_path, original_filename, status)
values (
  '00000000-0000-0000-0000-000000000132',
  '00000000-0000-0000-0000-000000000121',
  'eh121/doc-cascade',
  'eh121-cascade.pdf',
  'completed'
);

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, raw_name, value_numeric, unit,
  source_page, source_text, processing_version, resolver_result
)
values (
  '00000000-0000-0000-0000-000000000133',
  '00000000-0000-0000-0000-000000000132',
  '00000000-0000-0000-0000-000000000121',
  'Sodium', 'Sodium', 140, 'mmol/L', 1, 'Sodium 140 mmol/L', 'eh121-fixture', 'resolved'
);


delete from public.documents
where id = '00000000-0000-0000-0000-000000000132';

select is(
  (
    select count(*)::int
    from public.observation_change_events
    where document_id = '00000000-0000-0000-0000-000000000132'
  ),
  0,
  'deleting a document cascades its history away without tripping the guard'
);

select * from finish();

rollback;
