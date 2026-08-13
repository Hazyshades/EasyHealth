-- EH-122: durable batch-operation metadata and append-only verification reversal.
begin;

select plan(19);

select ok(has_table_privilege('service_role', 'public.batch_verification_operations', 'SELECT'), 'service_role can read batch operations');
select ok(has_table_privilege('service_role', 'public.batch_verification_operations', 'INSERT'), 'service_role can create batch operations');
select ok(has_table_privilege('service_role', 'public.batch_verification_operations', 'UPDATE'), 'service_role can complete or reverse batch operations');
select ok(not has_table_privilege('authenticated', 'public.batch_verification_operations', 'SELECT'), 'authenticated cannot read batch operations');
select ok((select relrowsecurity from pg_class where oid = 'public.batch_verification_operations'::regclass), 'batch operations enforce RLS');
select ok(
  (select count(*)::int from information_schema.columns where table_schema = 'public' and table_name in ('batch_verification_operations', 'batch_verification_operation_rows') and column_name in ('raw_name', 'raw_value_text', 'raw_reference_text', 'raw_unit', 'source_text', 'bounding_box', 'resolver_evidence', 'resolver_decision_trace')) = 0,
  'batch metadata contains no copied document evidence or resolver trace'
);
select ok(
  has_function_privilege('service_role', 'public.write_observation_normalization_revision_v2_legacy(uuid,jsonb,jsonb,text,uuid,text,jsonb,uuid,text,text,uuid,uuid,text,boolean)'::regprocedure, 'EXECUTE'),
  'service_role can execute the canonical extended writer'
);
select ok(
  not has_function_privilege('authenticated', 'public.reverse_observation_normalization_verification_v2(uuid,uuid,text,text)'::regprocedure, 'EXECUTE'),
  'authenticated cannot execute the verification reversal primitive'
);

insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000001221', 'eh122-owner@example.test'),
  ('00000000-0000-0000-0000-000000001222', 'eh122-reviewer@example.test')
on conflict (id) do nothing;

insert into public.documents (id, profile_id, storage_path, original_filename, status, observed_at)
values ('00000000-0000-0000-0000-000000001223', '00000000-0000-0000-0000-000000001221', 'eh122/test.pdf', 'eh122.pdf', 'completed', '2026-08-12')
on conflict (id) do nothing;

insert into public.document_extracted_biomarkers (id, document_id, profile_id, biomarker_name, status)
values ('00000000-0000-0000-0000-000000001224', '00000000-0000-0000-0000-000000001223', '00000000-0000-0000-0000-000000001221', 'EH-122 glucose', 'needs_review')
on conflict (id) do nothing;

create function public.eh122_observation_payload() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'profile_id', '00000000-0000-0000-0000-000000001221',
    'document_id', '00000000-0000-0000-0000-000000001223',
    'name', 'EH-122 glucose', 'value', 90, 'value_kind', 'numeric',
    'value_text', '90', 'unit', 'mg/dL', 'observed_at', '2026-08-12',
    'specimen', 'serum', 'modifier', 'none', 'raw_name', 'EH-122 glucose',
    'raw_value_text', '90', 'raw_unit', 'mg/dL', 'source_page', 1,
    'source_text', 'EH-122 glucose 90 mg/dL', 'provenance_schema_version', '2'
  );
$$;

create function public.eh122_resolution_payload() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'input_evidence_hash', repeat('a', 64),
    'measurement_definition_key', 'glucose_serum_fasting', 'analyte_key', 'glucose',
    'resolver_result', 'resolved', 'mapping_confidence', 0.95, 'mapping_confidence_band', 'high',
    'resolver_evidence', jsonb_build_object('candidates', '[]'::jsonb),
    'resolver_decision_trace', jsonb_build_object(
      'schemaVersion', '2', 'compatibilityPolicyVersion', 'eh122-test',
      'selectedCandidateKey', 'glucose_serum_fasting', 'outcome', 'resolved',
      'candidates', jsonb_build_array(jsonb_build_object(
        'candidateKey', 'glucose_serum_fasting', 'maturity', 'reviewed', 'score', 1,
        'accepted', '[]'::jsonb, 'rejected', '[]'::jsonb, 'missingAxes', '[]'::jsonb, 'conflicts', '[]'::jsonb
      )), 'missingAxes', '[]'::jsonb, 'conflicts', '[]'::jsonb
    ),
    'resolver_trace_schema_version', '2', 'normalized_unit', 'mg/dl', 'unit_dimension', 'mass_concentration',
    'catalog_manifest_version', 'eh122-test', 'catalog_manifest_digest', repeat('b', 64),
    'resolver_version', 'eh122-test', 'normalization_version', 'eh122-test'
  );
$$;

select lives_ok(
  $$ select public.write_observation_normalization_revision_v2_legacy(
    '00000000-0000-0000-0000-000000001224', public.eh122_observation_payload(), public.eh122_resolution_payload(),
    'acceptance', '00000000-0000-0000-0000-000000001222', repeat('c', 64),
    null, null, 'additive', null, null, null, 'eh122-test', true
  ) $$,
  'initial resolved acceptance creates the active user-verified revision'
);

insert into public.batch_verification_operations (id, profile_id, document_id, operation_id, request_hash, aggregate_status)
values ('00000000-0000-0000-0000-000000001225', '00000000-0000-0000-0000-000000001221', '00000000-0000-0000-0000-000000001223', '00000000-0000-0000-0000-000000001226', repeat('d', 64), 'completed');

select throws_ok(
  $$ insert into public.batch_verification_operations (profile_id, document_id, operation_id, request_hash, aggregate_status) values ('00000000-0000-0000-0000-000000001221', '00000000-0000-0000-0000-000000001223', '00000000-0000-0000-0000-000000001226', repeat('e', 64), 'completed') $$,
  '23505', null, 'an operation id cannot bind a different request for one profile'
);

insert into public.batch_verification_operation_rows (operation_id, extracted_biomarker_id, resulting_revision_id, request_hash, outcome_code)
select '00000000-0000-0000-0000-000000001225', '00000000-0000-0000-0000-000000001224', id, repeat('f', 64), 'verified'
from public.observation_normalization_revisions
where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224' and is_active;

select lives_ok(
  $$ select public.write_observation_normalization_revision_v2_legacy(
    '00000000-0000-0000-0000-000000001224', '{}'::jsonb, '{}'::jsonb,
    'verification_reversal', '00000000-0000-0000-0000-000000001222', repeat('1', 64),
    null,
    (select id from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224' and is_active),
    'additive', 'Synthetic EH-122 undo',
    (select id from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224' and is_active),
    (select id from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224' and is_active),
    'eh122-test', true
  ) $$,
  'the canonical writer creates and promotes a pending reversal successor'
);

select is(
  (select verification_status from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224' and is_active),
  'pending', 'the active successor is pending rather than silently verified'
);
select is(
  (select status from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001224'),
  'needs_review', 'the source row returns to review'
);
select is(
  (select count(*)::int from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224'),
  2, 'reversal appends exactly one successor revision'
);
select is(
  (select count(*)::int from public.observation_change_events where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224'),
  2, 'both verification and reversal are captured by the EH-121 ledger'
);
select is(
  (select verification_status from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224' and not is_active),
  'user_verified', 'the original verification revision remains immutable'
);
select lives_ok(
  $$ select public.reverse_observation_normalization_verification_v2(
    (select reversal_of_revision_id from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224' and is_active),
    '00000000-0000-0000-0000-000000001222', 'Synthetic EH-122 undo', repeat('1', 64)
  ) $$,
  'a replay returns the recorded reversal without another mutation'
);
select is(
  (select count(*)::int from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001224'),
  2, 'reversal replay remains append-only and idempotent'
);
select throws_ok(
  $$ select public.reverse_observation_normalization_verification_v2('00000000-0000-0000-0000-000000001224', '00000000-0000-0000-0000-000000001222', '', repeat('2', 64)) $$,
  'P0001', 'verification_reversal_requires_reason', 'a reversal must carry an audit reason'
);

select * from finish();
rollback;