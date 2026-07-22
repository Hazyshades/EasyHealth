begin;

select plan(35);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observation_normalization_revisions'::regclass
      and conname = 'observation_normalization_revisions_verification_status_check'
      and pg_get_constraintdef(oid) like '%auto_verified%'
      and pg_get_constraintdef(oid) not like '%rejected%'
  ),
  'revision verification status allows auto_verified and excludes rejected'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observation_normalization_revisions'::regclass
      and conname = 'observation_normalization_revisions_id_extracted_key'
      and pg_get_constraintdef(oid) like '%UNIQUE (id, extracted_biomarker_id)%'
  ),
  'revision composite uniqueness target exists for Phase B'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.promote_observation_normalization_revision_v2(uuid,uuid,uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute the v2 promotion RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.promote_observation_normalization_revision_v2(uuid,uuid,uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute the v2 promotion RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.promote_observation_normalization_revision_v2(uuid,uuid,uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute the v2 promotion RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.promote_observation_normalization_revision(uuid,uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service_role retains temporary access to the legacy promotion RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.promote_observation_normalization_revision(uuid,uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute the legacy promotion RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.promote_observation_normalization_revision(uuid,uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute the legacy promotion RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.eh104_resolution_verification_preflight()'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute the populated-data preflight'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.eh104_resolution_verification_preflight()'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute the populated-data preflight'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh104_resolution_verification_preflight()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute the populated-data preflight'
);

insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'eh104-primary@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'eh104-actor-one@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'eh104-actor-two@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'eh104-secondary@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'eh104/primary.pdf', 'primary.pdf', 'completed'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004', 'eh104/secondary.pdf', 'secondary.pdf', 'completed');

insert into public.document_extracted_biomarkers (
  id,
  document_id,
  profile_id,
  biomarker_name,
  status
)
values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Primary target', 'needs_review'),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Different source', 'needs_review'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004', 'Other profile source', 'needs_review'),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Legacy invalid source', 'needs_review');

select is(
  (select count(*)::bigint from public.eh104_resolution_verification_preflight()),
  0::bigint,
  'preflight is clean before populated legacy fixtures are introduced'
);

update public.document_extracted_biomarkers
set resolver_result = 'legacy_invalid',
    verification_status = 'legacy_invalid'
where id = '00000000-0000-0000-0000-000000000023';

insert into public.observations (
  id,
  profile_id,
  document_id,
  source_extracted_biomarker_id,
  name,
  value,
  unit,
  observed_at
)
values
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'Primary observation', 1, 'mg/dL', '2026-01-01'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000021', 'Source mismatch observation', 2, 'mg/dL', '2026-01-02'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000022', 'Profile mismatch observation', 3, 'mg/dL', '2026-01-03'),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000023', 'Half-linked observation', 4, 'mg/dL', '2026-01-04');

insert into public.observation_normalization_revisions (
  id,
  extracted_biomarker_id,
  input_evidence_hash,
  analyte_key,
  resolver_result,
  mapping_confidence,
  catalog_manifest_version,
  resolver_version,
  normalization_version,
  verification_status
)
values
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000020', 'eh104-target', 'primary_target', 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'pending'),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000020', 'eh104-stale', 'primary_target', 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'pending'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000022', 'eh104-cross-profile', 'other_target', 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'pending'),
  ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000023', 'eh104-guard', 'legacy_target', 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'pending'),
  ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000023', 'eh104-legacy-invalid', null, 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'user_verified');

create trigger eh104_phase_a_guard_fixture
before insert or update on public.observation_normalization_revisions
for each row
execute function public.eh104_validate_normalization_revision_verification();

select throws_ok(
  $$
    insert into public.observation_normalization_revisions (
      id,
      extracted_biomarker_id,
      input_evidence_hash,
      analyte_key,
      resolver_result,
      mapping_confidence,
      catalog_manifest_version,
      resolver_version,
      normalization_version,
      verification_status,
      verification_decided_at,
      verification_actor_type,
      verification_actor_id
    )
    values (
      '00000000-0000-0000-0000-000000000045',
      '00000000-0000-0000-0000-000000000023',
      'eh104-invalid-pending',
      'legacy_target',
      'partial',
      0.5,
      'eh104',
      'eh104',
      'eh104',
      'pending',
      now(),
      'user',
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'pending verification must not include decision metadata',
  'unattached guard rejects invalid pending INSERT metadata'
);

select throws_ok(
  $$
    update public.observation_normalization_revisions
    set verification_status = 'user_verified'
    where id = '00000000-0000-0000-0000-000000000043'
  $$,
  'P0001',
  'user_verified requires a user decision timestamp and actor id',
  'unattached guard rejects invalid UPDATE actor metadata'
);

select throws_ok(
  $$
    update public.observation_normalization_revisions
    set verification_status = 'user_verified',
        verification_decided_at = now(),
        verification_actor_type = 'user',
        verification_actor_id = '00000000-0000-0000-0000-000000000002'
    where id = '00000000-0000-0000-0000-000000000043'
  $$,
  'P0001',
  'verified normalization revision must be resolved and have a measurement definition',
  'unattached guard rejects verified incomplete UPDATE'
);

drop trigger eh104_phase_a_guard_fixture on public.observation_normalization_revisions;

with function_definition as (
  select regexp_replace(
    lower(pg_get_functiondef(
      'public.promote_observation_normalization_revision_v2(uuid,uuid,uuid,uuid)'::regprocedure
    )),
    E'\\s+',
    ' ',
    'g'
  ) as definition
)
select ok(
  position(
    'from public.document_extracted_biomarkers where id = target_extracted_biomarker_id for update'
    in definition
  ) > 0
  and position(
    'from public.document_extracted_biomarkers where id = target_extracted_biomarker_id for update'
    in definition
  ) < position(
    'from public.observations where id = p_observation_id for update'
    in definition
  )
  and position(
    'from public.observations where id = p_observation_id for update'
    in definition
  ) < position(
    'from public.observation_normalization_revisions as revision where revision.extracted_biomarker_id = extracted.id and (revision.is_active or revision.id = p_revision_id) order by revision.id for update'
    in definition
  ),
  'v2 promotion locks extracted row, observation, then revisions in one stable order'
)
from function_definition;

select ok(
  exists (
    select 1
    from public.eh104_resolution_verification_preflight()
    where finding_code = 'invalid_extracted_resolver_result'
      and subject_id = '00000000-0000-0000-0000-000000000023'
  ),
  'preflight reports invalid extracted resolver result'
);

select ok(
  exists (
    select 1
    from public.eh104_resolution_verification_preflight()
    where finding_code = 'invalid_extracted_verification_status'
      and subject_id = '00000000-0000-0000-0000-000000000023'
  ),
  'preflight reports invalid extracted verification status'
);

select ok(
  exists (
    select 1
    from public.eh104_resolution_verification_preflight()
    where finding_code = 'half_linked_observation'
      and subject_id = '00000000-0000-0000-0000-000000000033'
  ),
  'preflight reports legacy source-only observation'
);

select ok(
  exists (
    select 1
    from public.eh104_resolution_verification_preflight()
    where finding_code = 'verified_incomplete_revision'
      and subject_id = '00000000-0000-0000-0000-000000000044'
  ),
  'preflight reports verified incomplete revision'
);

select ok(
  exists (
    select 1
    from public.eh104_resolution_verification_preflight()
    where finding_code = 'invalid_revision_verification_decision_metadata'
      and subject_id = '00000000-0000-0000-0000-000000000044'
  ),
  'preflight reports missing decision metadata on a verified legacy revision'
);

select lives_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000040',
      '00000000-0000-0000-0000-000000000030',
      null::uuid,
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'v2 promotes the first pending partial revision with a null expected active revision'
);

select is(
  (select is_active from public.observation_normalization_revisions where id = '00000000-0000-0000-0000-000000000040'),
  true,
  'v2 activates the target revision'
);

select is(
  (select normalization_revision_id from public.observations where id = '00000000-0000-0000-0000-000000000030'),
  '00000000-0000-0000-0000-000000000040'::uuid,
  'v2 synchronizes the observation revision projection'
);

select is(
  (select resolution_status from public.observations where id = '00000000-0000-0000-0000-000000000030'),
  'partial'::text,
  'v2 synchronizes the partial resolver outcome'
);

select is(
  (select measurement_definition_key from public.observations where id = '00000000-0000-0000-0000-000000000030'),
  null::text,
  'v2 synchronizes a null definition for an incomplete revision'
);

select lives_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000040',
      '00000000-0000-0000-0000-000000000030',
      null::uuid,
      '00000000-0000-0000-0000-000000000003'
    )
  $$,
  'initial retry with null expected active revision is a strict no-op before CAS'
);

select is(
  (select promoted_by from public.observation_normalization_revisions where id = '00000000-0000-0000-0000-000000000040'),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'strict no-op preserves original promotion metadata'
);

select throws_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000041',
      '00000000-0000-0000-0000-000000000030',
      null::uuid,
      '00000000-0000-0000-0000-000000000003'
    )
  $$,
  'P0001',
  'stale_revision_conflict',
  'v2 rejects a stale expected active revision after locks are acquired'
);

select is(
  (select is_active from public.observation_normalization_revisions where id = '00000000-0000-0000-0000-000000000041'),
  false,
  'stale CAS rollback leaves the inactive candidate unchanged'
);

select throws_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000040',
      '00000000-0000-0000-0000-000000000031',
      '00000000-0000-0000-0000-000000000040',
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'observation_source_mismatch',
  'v2 rejects target and observation with different extracted sources'
);

select throws_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000042',
      '00000000-0000-0000-0000-000000000032',
      null::uuid,
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'observation_source_owner_mismatch',
  'v2 rejects cross-profile or cross-document ownership'
);

select throws_ok(
  $$
    insert into public.observation_normalization_revisions (
      id,
      extracted_biomarker_id,
      input_evidence_hash,
      analyte_key,
      resolver_result,
      mapping_confidence,
      catalog_manifest_version,
      resolver_version,
      normalization_version,
      verification_status,
      is_active
    )
    values (
      '00000000-0000-0000-0000-000000000046',
      '00000000-0000-0000-0000-000000000020',
      'eh104-second-active',
      'primary_target',
      'partial',
      0.5,
      'eh104',
      'eh104',
      'eh104',
      'pending',
      true
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "normalization_revisions_one_active_per_extracted"',
  'partial unique index remains the final active-revision database defense'
);

update public.observations
set resolution_status = 'resolved'
where id = '00000000-0000-0000-0000-000000000030';

select throws_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000040',
      '00000000-0000-0000-0000-000000000030',
      '00000000-0000-0000-0000-000000000040',
      '00000000-0000-0000-0000-000000000003'
    )
  $$,
  'P0001',
  'active_revision_projection_mismatch',
  'v2 does not silently repair an active divergent projection'
);

select is(
  (select resolution_status from public.observations where id = '00000000-0000-0000-0000-000000000030'),
  'resolved'::text,
  'projection-mismatch failure rolls back without an implicit repair'
);

select * from finish();

rollback;
