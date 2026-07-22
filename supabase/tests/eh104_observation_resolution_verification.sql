begin;

select plan(42);

-- ── schema / grants ──────────────────────────────────────────────────────────

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
    from pg_trigger
    where tgrelid = 'public.observation_normalization_revisions'::regclass
      and tgname = 'eh104_normalization_revision_verification_guard'
      and not tgisinternal
  ),
  'Phase B attaches the revision verification guard trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.document_extracted_biomarkers'::regclass
      and conname = 'document_extracted_biomarkers_resolver_result_check'
      and pg_get_constraintdef(oid) like '%partial%'
  ),
  'extracted resolver_result is constrained to the four-value domain or null'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_normalization_revision_same_source_fk'
      and pg_get_constraintdef(oid) ilike '%match full%'
  ),
  'laboratory observation revision pair uses MATCH FULL composite FK'
);

select ok(
  to_regprocedure('public.promote_observation_normalization_revision(uuid,uuid,uuid)') is null,
  'legacy promotion RPC is dropped'
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
    'public.purge_document_derived_laboratory_lineage(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute laboratory lineage purge'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.purge_document_derived_laboratory_lineage(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute laboratory lineage purge'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.purge_document_derived_laboratory_lineage(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute laboratory lineage purge'
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

-- ── seed ─────────────────────────────────────────────────────────────────────

insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'eh104-primary@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'eh104-actor-one@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'eh104-actor-two@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'eh104-secondary@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'eh104/primary.pdf', 'primary.pdf', 'completed'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004', 'eh104/secondary.pdf', 'secondary.pdf', 'completed'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'eh104/purge.pdf', 'purge.pdf', 'completed');

insert into public.document_extracted_biomarkers (
  id,
  document_id,
  profile_id,
  biomarker_name,
  status,
  resolver_result
)
values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Primary target', 'needs_review', 'partial'),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Different source', 'needs_review', null),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004', 'Other profile source', 'needs_review', null),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Guard source', 'needs_review', 'partial'),
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Purge source', 'accepted', 'resolved');

select is(
  (select count(*)::bigint from public.eh104_resolution_verification_preflight()),
  0::bigint,
  'preflight is clean on valid seed data'
);

select throws_ok(
  $$
    update public.document_extracted_biomarkers
    set resolver_result = 'legacy_invalid'
    where id = '00000000-0000-0000-0000-000000000023'
  $$,
  '23514',
  null,
  'extracted resolver_result rejects unsupported values'
);

-- Source-only laboratory rows are allowed only until commit (deferred MATCH FULL).
insert into public.observations (
  id,
  profile_id,
  document_id,
  source_extracted_biomarker_id,
  name,
  value,
  unit,
  observed_at,
  observation_kind
)
values
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'Primary observation', 1, 'mg/dL', '2026-01-01', 'lab'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000021', 'Source mismatch observation', 2, 'mg/dL', '2026-01-02', 'lab'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000022', 'Profile mismatch observation', 3, 'mg/dL', '2026-01-03', 'lab'),
  ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000024', 'Purge observation', 5, 'mg/dL', '2026-01-05', 'lab'),
  ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000001', null, null, 'Standalone both-null observation', 6, 'mg/dL', '2026-01-06', 'lab');

insert into public.observation_normalization_revisions (
  id,
  extracted_biomarker_id,
  input_evidence_hash,
  analyte_key,
  measurement_definition_key,
  resolver_result,
  mapping_confidence,
  catalog_manifest_version,
  resolver_version,
  normalization_version,
  verification_status
)
values
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000020', 'eh104-target', 'primary_target', null, 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'pending'),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000020', 'eh104-stale', 'primary_target', null, 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'pending'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000022', 'eh104-cross-profile', 'other_target', null, 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'pending'),
  ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000023', 'eh104-guard', 'legacy_target', null, 'partial', 0.5, 'eh104', 'eh104', 'eh104', 'pending'),
  ('00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000024', 'eh104-purge', 'purge_target', 'glucose_serum', 'resolved', 0.9, 'eh104', 'eh104', 'eh104', 'pending');

-- ── attached guards ──────────────────────────────────────────────────────────

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
  'attached guard rejects invalid pending INSERT metadata'
);

select throws_ok(
  $$
    update public.observation_normalization_revisions
    set verification_status = 'user_verified'
    where id = '00000000-0000-0000-0000-000000000043'
  $$,
  'P0001',
  'user_verified requires a user decision timestamp and actor id',
  'attached guard rejects invalid UPDATE actor metadata'
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
  'attached guard rejects verified incomplete UPDATE'
);

select throws_ok(
  $$
    insert into public.observation_normalization_revisions (
      id,
      extracted_biomarker_id,
      input_evidence_hash,
      analyte_key,
      measurement_definition_key,
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
      '00000000-0000-0000-0000-000000000048',
      '00000000-0000-0000-0000-000000000023',
      'eh104-verified-incomplete',
      null,
      null,
      'partial',
      0.5,
      'eh104',
      'eh104',
      'eh104',
      'user_verified',
      now(),
      'user',
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'verified normalization revision must be resolved and have a measurement definition',
  'attached guard rejects verified incomplete INSERT'
);

select throws_ok(
  $$
    delete from public.observation_normalization_revisions
    where id = '00000000-0000-0000-0000-000000000043'
  $$,
  'P0001',
  'normalization_revision_delete_forbidden',
  'direct revision delete is denied outside purge'
);

-- Half-link at rest: nested constraint check, then roll back only that attempt.
select throws_ok(
  $$
    do $body$
    begin
      insert into public.observations (
        id,
        profile_id,
        document_id,
        source_extracted_biomarker_id,
        name,
        value,
        unit,
        observed_at,
        observation_kind
      )
      values (
        '00000000-0000-0000-0000-000000000033',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000023',
        'Half-linked observation',
        4,
        'mg/dL',
        '2026-01-04',
        'lab'
      );
      execute 'set constraints observations_normalization_revision_same_source_fk immediate';
    end
    $body$;
  $$,
  '23503',
  null,
  'MATCH FULL rejects source-only laboratory half-link at constraint check'
);

select is(
  (
    select count(*)::bigint
    from public.observations
    where id = '00000000-0000-0000-0000-000000000035'
      and source_extracted_biomarker_id is null
      and normalization_revision_id is null
  ),
  1::bigint,
  'both-null laboratory lineage pair remains valid'
);

-- ── v2 promotion contracts ───────────────────────────────────────────────────

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

select lives_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000040',
      '00000000-0000-0000-0000-000000000030',
      null::uuid,
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'v2 promotes a same-source laboratory observation'
);

select is(
  (
    select normalization_revision_id
    from public.observations
    where id = '00000000-0000-0000-0000-000000000030'
  ),
  '00000000-0000-0000-0000-000000000040'::uuid,
  'promotion writes the composite same-source pair'
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
  'complete first-activation retry is a no-op before CAS'
);

select throws_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000041',
      '00000000-0000-0000-0000-000000000030',
      null::uuid,
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'stale_revision_conflict',
  'stale expected active revision fails'
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
  'source mismatch is rejected'
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
  'profile/document ownership mismatch is rejected'
);

-- Remove intentional source-only rows used only for promotion negative tests so
-- deferred MATCH FULL checks later in the transaction stay focused.
delete from public.observations
where id in (
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000032'
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

-- Restore the intentional divergence fixture so later preflight checks residual
-- integrity from purge/writer paths only.
update public.observations
set resolution_status = 'partial'
where id = '00000000-0000-0000-0000-000000000030';

-- ── purge ────────────────────────────────────────────────────────────────────

-- Complete the purge document pair before purge so MATCH FULL is satisfied.
select lives_ok(
  $$
    select public.promote_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000047',
      '00000000-0000-0000-0000-000000000034',
      null::uuid,
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'purge fixture observation promotes cleanly'
);

select lives_ok(
  $$
    select public.purge_document_derived_laboratory_lineage(
      '00000000-0000-0000-0000-000000000012'
    )
  $$,
  'controlled purge succeeds for a document with laboratory lineage'
);

select is(
  (
    select count(*)::bigint
    from public.observations
    where id = '00000000-0000-0000-0000-000000000034'
      and source_extracted_biomarker_id is null
      and normalization_revision_id is null
  ),
  1::bigint,
  'purge leaves a full null laboratory lineage pair'
);

select is(
  (
    select count(*)::bigint
    from public.document_extracted_biomarkers
    where document_id = '00000000-0000-0000-0000-000000000012'
  ),
  0::bigint,
  'purge deletes document-derived extracted biomarker rows'
);

select is(
  (
    select count(*)::bigint
    from public.observation_normalization_revisions
    where id = '00000000-0000-0000-0000-000000000047'
  ),
  0::bigint,
  'purge removes cascaded normalization revisions under purge context'
);

select throws_ok(
  $$
    select public.eh104_phase_b_reset_document_derived_laboratory_lineage(false)
  $$,
  'P0001',
  'phase_b_reset_not_allowed',
  'disposable reset refuses without explicit confirmation'
);

-- ── EH-106 writer still works under Phase B ──────────────────────────────────

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000000021',
      jsonb_build_object(
        'profile_id', '00000000-0000-0000-0000-000000000001',
        'document_id', '00000000-0000-0000-0000-000000000010',
        'name', 'EH-104 Phase B writer row',
        'value', 21,
        'value_kind', 'numeric',
        'value_text', '21',
        'unit', 'U/L',
        'observed_at', '2026-07-22',
        'specimen', 'serum',
        'modifier', 'none',
        'raw_name', 'ALT',
        'raw_value_text', '21',
        'raw_unit', 'U/L',
        'provenance_schema_version', '1'
      ),
      jsonb_build_object(
        'input_evidence_hash', 'eh104-phase-b-writer',
        'measurement_definition_key', 'alt_serum',
        'analyte_key', 'alt',
        'resolver_result', 'resolved',
        'mapping_confidence', 0.95,
        'mapping_confidence_band', 'high',
        'resolver_evidence', '[]'::jsonb,
        'normalized_unit', 'U/L',
        'unit_dimension', 'enzyme_activity',
        'catalog_manifest_version', 'eh104',
        'catalog_manifest_digest', 'eh104',
        'resolver_version', 'eh104',
        'normalization_version', 'eh104'
      ),
      'acceptance',
      '00000000-0000-0000-0000-000000000002',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      null::uuid,
      'additive',
      null::text,
      null::uuid,
      null::uuid,
      'test',
      true
    )
  $$,
  'EH-106 atomic writer succeeds on a clean Phase B database'
);

select is(
  (
    select count(*)::bigint
    from public.observations
    where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000000021'
      and normalization_revision_id is not null
      and resolution_status = 'resolved'
  ),
  1::bigint,
  'atomic writer leaves a full same-source laboratory pair'
);

select is(
  (select count(*)::bigint from public.eh104_resolution_verification_preflight()),
  0::bigint,
  'preflight remains clean after successful writer and purge paths'
);

select * from finish();

rollback;
