begin;

select plan(31);

select ok(
  has_function_privilege(
    'service_role',
    'public.write_observation_normalization_revision_v2(uuid,jsonb,jsonb,text,uuid,text,uuid,text,text,uuid,uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute the EH-106 atomic writer'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.write_observation_normalization_revision_v2(uuid,jsonb,jsonb,text,uuid,text,uuid,text,text,uuid,uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute the EH-106 atomic writer'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.write_observation_normalization_revision_v2(uuid,jsonb,jsonb,text,uuid,text,uuid,text,text,uuid,uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute the EH-106 atomic writer'
);

with function_definition as (
  select lower(pg_get_functiondef(
    'public.write_observation_normalization_revision_v2(uuid,jsonb,jsonb,text,uuid,text,uuid,text,text,uuid,uuid,text,boolean)'::regprocedure
  )) as definition
)
select ok(
  position('promote_observation_normalization_revision_v2' in definition) > 0,
  'atomic writer delegates promotion to the EH-104 v2 primitive'
)
from function_definition;

create function public.eh106_observation_payload(
  p_profile_id uuid,
  p_document_id uuid,
  p_name text default 'EH-106 laboratory result'
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'profile_id', p_profile_id,
    'document_id', p_document_id,
    'name', p_name,
    'value', 90,
    'value_kind', 'numeric',
    'value_text', '90',
    'unit', 'mg/dL',
    'observed_at', '2026-07-20',
    'specimen', 'serum',
    'modifier', 'none',
    'raw_name', p_name,
    'raw_value_text', '90',
    'raw_unit', 'mg/dL',
    'provenance_schema_version', '1'
  );
$$;

create function public.eh106_resolution_payload(
  p_result text,
  p_measurement_definition_key text,
  p_analyte_key text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'input_evidence_hash', 'eh106-test-evidence',
    'measurement_definition_key', p_measurement_definition_key,
    'analyte_key', p_analyte_key,
    'resolver_result', p_result,
    'mapping_confidence', 0.95,
    'mapping_confidence_band', 'high',
    'resolver_evidence', '[]'::jsonb,
    'normalized_unit', 'mg/dl',
    'unit_dimension', 'mass_concentration',
    'catalog_manifest_version', 'eh106-test',
    'catalog_manifest_digest', 'eh106-test-digest',
    'resolver_version', 'eh106-test',
    'normalization_version', 'eh106-test'
  );
$$;

insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000001061', 'eh106-owner@example.test'),
  ('00000000-0000-0000-0000-000000001062', 'eh106-actor-one@example.test'),
  ('00000000-0000-0000-0000-000000001063', 'eh106-actor-two@example.test'),
  ('00000000-0000-0000-0000-000000001064', 'eh106-other-owner@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values
  ('00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'eh106/owner.pdf', 'owner.pdf', 'completed'),
  ('00000000-0000-0000-0000-000000001072', '00000000-0000-0000-0000-000000001064', 'eh106/other.pdf', 'other.pdf', 'completed');

insert into public.document_extracted_biomarkers (id, document_id, profile_id, biomarker_name, status)
values
  ('00000000-0000-0000-0000-000000001081', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Resolved acceptance', 'needs_review'),
  ('00000000-0000-0000-0000-000000001082', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Partial acceptance', 'needs_review'),
  ('00000000-0000-0000-0000-000000001083', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Manual correction', 'needs_review'),
  ('00000000-0000-0000-0000-000000001084', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Unreviewed rejection', 'needs_review'),
  ('00000000-0000-0000-0000-000000001085', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Stale target', 'needs_review'),
  ('00000000-0000-0000-0000-000000001086', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Ownership target', 'needs_review'),
  ('00000000-0000-0000-0000-000000001087', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Idempotent target', 'needs_review'),
  ('00000000-0000-0000-0000-000000001088', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Ambiguous acceptance', 'needs_review'),
  ('00000000-0000-0000-0000-000000001089', '00000000-0000-0000-0000-000000001071', '00000000-0000-0000-0000-000000001061', 'Unmapped acceptance', 'needs_review');

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001081',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071'
      ),
      public.eh106_resolution_payload('resolved', 'glucose_serum', 'glucose'),
      'acceptance',
      '00000000-0000-0000-0000-000000001062',
      repeat('a', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      true
    )
  $$,
  'resolved reviewed acceptance writes and promotes atomically'
);

select is(
  (select verification_status from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001081' and is_active),
  'user_verified',
  'resolved reviewed acceptance is user verified'
);

select is(
  (
    select verification_actor_id
    from public.observation_normalization_revisions
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000001081'
      and is_active
      and verification_actor_type = 'user'
      and verification_decided_at is not null
  ),
  '00000000-0000-0000-0000-000000001062'::uuid,
  'resolved acceptance carries complete user decision metadata'
);

select ok(
  exists (
    select 1
    from public.observations
    where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001081'
      and analyte_key = 'glucose'
      and measurement_definition_key = 'glucose_serum'
      and resolution_status = 'resolved'
      and normalization_revision_id is not null
  ),
  'v2 synchronizes the resolved Registry 2.0 projection'
);

select is(
  (select status from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001081'),
  'accepted',
  'writer updates accepted source status in the same transaction'
);

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001082',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071',
        'Partial acceptance'
      ),
      public.eh106_resolution_payload('partial', null, null),
      'acceptance',
      '00000000-0000-0000-0000-000000001062',
      repeat('b', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      false
    )
  $$,
  'partial raw acceptance writes and promotes atomically'
);

select is(
  (select verification_status from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001082' and is_active),
  'pending',
  'partial acceptance remains pending'
);

select ok(
  exists (
    select 1
    from public.observation_normalization_revisions
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000001082'
      and is_active
      and measurement_definition_key is null
      and verification_decided_at is null
      and verification_actor_type is null
      and verification_actor_id is null
  ),
  'partial acceptance has neither invented identity nor decision metadata'
);

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001088',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071',
        'Ambiguous acceptance'
      ),
      public.eh106_resolution_payload('ambiguous', null, null),
      'acceptance',
      '00000000-0000-0000-0000-000000001062',
      repeat('8', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      false
    )
  $$,
  'ambiguous raw acceptance writes and promotes atomically'
);

select ok(
  exists (
    select 1
    from public.observation_normalization_revisions
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000001088'
      and is_active
      and verification_status = 'pending'
      and measurement_definition_key is null
      and analyte_key is null
      and verification_decided_at is null
      and verification_actor_type is null
      and verification_actor_id is null
  ),
  'ambiguous acceptance remains pending without concrete identity or decision metadata'
);

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001089',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071',
        'Unmapped acceptance'
      ),
      public.eh106_resolution_payload('unmapped', null, null),
      'acceptance',
      '00000000-0000-0000-0000-000000001062',
      repeat('9', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      false
    )
  $$,
  'unmapped raw acceptance writes and promotes atomically'
);

select ok(
  exists (
    select 1
    from public.observation_normalization_revisions
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000001089'
      and is_active
      and verification_status = 'pending'
      and measurement_definition_key is null
      and analyte_key is null
      and verification_decided_at is null
      and verification_actor_type is null
      and verification_actor_id is null
  ),
  'unmapped acceptance remains pending without concrete identity or decision metadata'
);

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001083',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071',
        'Manual correction'
      ),
      public.eh106_resolution_payload('resolved', 'glucose_serum', 'glucose'),
      'correction',
      '00000000-0000-0000-0000-000000001062',
      repeat('c', 64),
      null,
      'review_required',
      'reviewed correction',
      null,
      null,
      'eh106-test',
      true
    )
  $$,
  'reviewed correction writes and promotes atomically'
);

select is(
  (select verification_status from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001083' and is_active),
  'manually_corrected',
  'reviewed correction is manually corrected'
);

select is(
  (
    select verification_actor_id
    from public.observation_normalization_revisions
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000001083'
      and is_active
      and verification_actor_type = 'user'
      and verification_decided_at is not null
  ),
  '00000000-0000-0000-0000-000000001062'::uuid,
  'manual correction carries complete user decision metadata'
);

select throws_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001084',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071',
        'Unreviewed rejection'
      ),
      public.eh106_resolution_payload('resolved', 'glucose_serum', 'glucose'),
      'acceptance',
      '00000000-0000-0000-0000-000000001062',
      repeat('d', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      false
    )
  $$,
  'P0001',
  'unreviewed_measurement_definition',
  'verified writer rejects an unreviewed definition'
);

insert into public.observations (
  id, profile_id, document_id, source_extracted_biomarker_id, name, value, unit, observed_at
)
values (
  '00000000-0000-0000-0000-000000001091',
  '00000000-0000-0000-0000-000000001061',
  '00000000-0000-0000-0000-000000001071',
  '00000000-0000-0000-0000-000000001085',
  'Stale target',
  90,
  'mg/dL',
  '2026-07-20'
);

insert into public.observation_normalization_revisions (
  id, extracted_biomarker_id, observation_id, input_evidence_hash, resolver_result,
  mapping_confidence, catalog_manifest_version, resolver_version, normalization_version,
  verification_status, is_active
)
values (
  '00000000-0000-0000-0000-000000001092',
  '00000000-0000-0000-0000-000000001085',
  '00000000-0000-0000-0000-000000001091',
  'eh106-existing-active',
  'partial',
  0.5,
  'eh106-test',
  'eh106-test',
  'eh106-test',
  'pending',
  true
);

select throws_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001085',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071',
        'Stale target'
      ),
      public.eh106_resolution_payload('resolved', 'glucose_serum', 'glucose'),
      'acceptance',
      '00000000-0000-0000-0000-000000001062',
      repeat('e', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      true
    )
  $$,
  'P0001',
  'stale_revision_conflict',
  'writer preserves the v2 stale CAS failure'
);

select is(
  (select count(*)::bigint from public.observations where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001085'),
  1::bigint,
  'stale writer failure leaves no new source-only observation'
);

select is(
  (select count(*)::bigint from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001085'),
  1::bigint,
  'stale writer failure rolls back its new candidate revision'
);

select throws_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001086',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001064',
        '00000000-0000-0000-0000-000000001072',
        'Ownership target'
      ),
      public.eh106_resolution_payload('resolved', 'glucose_serum', 'glucose'),
      'acceptance',
      '00000000-0000-0000-0000-000000001062',
      repeat('f', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      true
    )
  $$,
  'P0001',
  'observation_source_owner_mismatch',
  'writer preserves the v2 ownership rejection'
);

select is(
  (select count(*)::bigint from public.observations where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001086'),
  0::bigint,
  'ownership failure rolls back the newly created observation'
);

select is(
  (select count(*)::bigint from public.observation_normalization_revisions where extracted_biomarker_id = '00000000-0000-0000-0000-000000001086'),
  0::bigint,
  'ownership failure rolls back the newly created candidate revision'
);

select is(
  (select status from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001086'),
  'needs_review',
  'ownership failure leaves the source review status unchanged'
);

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001087',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071',
        'Idempotent target'
      ),
      public.eh106_resolution_payload('resolved', 'glucose_serum', 'glucose'),
      'acceptance',
      '00000000-0000-0000-0000-000000001062',
      repeat('1', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      true
    )
  $$,
  'first idempotent writer request succeeds'
);

select is(
  (
    select was_reused
    from public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000001087',
      public.eh106_observation_payload(
        '00000000-0000-0000-0000-000000001061',
        '00000000-0000-0000-0000-000000001071',
        'Idempotent target'
      ),
      public.eh106_resolution_payload('resolved', 'glucose_serum', 'glucose'),
      'acceptance',
      '00000000-0000-0000-0000-000000001063',
      repeat('1', 64),
      null,
      'additive',
      null,
      null,
      null,
      'eh106-test',
      true
    )
  ),
  true,
  'matching request reuses the target revision and invokes the v2 no-op'
);

select is(
  (
    select count(*)::bigint
    from public.observations
    where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000001087'
  ),
  1::bigint,
  'idempotent retry retains one same-source observation'
);

select is(
  (
    select promoted_by
    from public.observation_normalization_revisions
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000001087'
      and is_active
  ),
  '00000000-0000-0000-0000-000000001062'::uuid,
  'idempotent v2 no-op preserves the original promotion actor'
);

select * from finish();

rollback;
