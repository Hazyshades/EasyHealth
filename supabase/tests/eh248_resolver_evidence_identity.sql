-- EH-248 Change A: prepared-evidence identity, reprocess facts, and
-- historical restore database contracts.
begin;
insert into public.profiles (id, email)
values ('00000000-0000-0000-0000-000000002480', 'eh248-resolver-evidence-identity@example.test');
insert into public.documents (
  id, profile_id, storage_path, original_filename, status
) values (
  '00000000-0000-0000-0000-000000002481',
  '00000000-0000-0000-0000-000000002480',
  'eh248/identity.pdf',
  'eh248-identity.pdf',
  'completed'
);
insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name
) values (
  '00000000-0000-0000-0000-000000002482',
  '00000000-0000-0000-0000-000000002481',
  '00000000-0000-0000-0000-000000002480',
  'EH-248 identity fixture'
);


select plan(24);

select has_column(
  'public',
  'observation_normalization_revisions',
  'input_identity_format_version',
  'normalization revisions carry the nullable identity format version'
);
select is(
  (
    select column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'observation_normalization_revisions'
      and column_name = 'input_identity_format_version'
  ),
  null,
  'legacy revision identity version has no default so NULL history remains representable'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observation_normalization_revisions'::regclass
      and conname = 'observation_normalization_revisions_input_identity_format_version_check'
  ),
  'identity format version is constrained to NULL or v1'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observation_normalization_revisions'::regclass
      and conname = 'observation_normalization_revisions_input_evidence_hash_v1_check'
  ),
  'v1 identity hashes have a lowercase SHA-256 shape constraint'
);
select is(
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_reprocess_batch_rows'
      and column_name in (
        'prior_input_identity_format_version',
        'next_input_identity_format_version',
        'input_change',
        'outcome_change',
        'release_change',
        'create_revision',
        'activate_revision',
        'reprocess_change_facts'
      )
  ),
  8,
  'reprocess rows persist all independent change facts'
);
select is(
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'observation_change_events'
      and column_name in (
        'prior_input_identity_format_version',
        'next_input_identity_format_version',
        'input_change',
        'outcome_change',
        'release_change',
        'create_revision',
        'activate_revision',
        'reprocess_change_facts'
      )
  ),
  8,
  'change history carries the same immutable reprocess facts'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.observation_normalization_revisions'::regclass
      and tgname = 'eh248_validate_revision_input_identity'
      and not tgisinternal
  ),
  'revision identity validation trigger is installed'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.registry_reprocess_batch_rows'::regclass
      and tgname = 'eh248_reprocess_fact_immutability'
      and not tgisinternal
  ),
  'reprocess facts are protected by an append-only trigger'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.observation_change_events'::regclass
      and tgname = 'eh248_enrich_observation_change_event'
      and not tgisinternal
  ),
  'change history enrichment trigger is installed'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.registry_reprocess_record_row_v2(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can record EH-248 reprocess facts'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.registry_reprocess_record_row_v2(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot record EH-248 reprocess facts'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.restore_observation_normalization_revision_v1(uuid,uuid,uuid,uuid,text,text,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can restore a historical normalization revision'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.restore_observation_normalization_revision_v1(uuid,uuid,uuid,uuid,text,text,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot restore a historical normalization revision'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.eh122_reverse_observation_normalization_verification(uuid,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute the EH-122/248 batch historical reversal'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh122_reverse_observation_normalization_verification(uuid,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute the batch historical reversal'
);
select ok(
  position('input_identity_format_version' in pg_get_functiondef(
    'public.eh122_reverse_observation_normalization_verification(uuid,uuid,text,text)'::regprocedure
  )) > 0
  and position('resolver_decision_trace' in pg_get_functiondef(
    'public.eh122_reverse_observation_normalization_verification(uuid,uuid,text,text)'::regprocedure
  )) > 0
  and position('catalog_manifest_version' in pg_get_functiondef(
    'public.eh122_reverse_observation_normalization_verification(uuid,uuid,text,text)'::regprocedure
  )) > 0,
  'batch historical reversal copies identity, trace, and release metadata'
);
select ok(
  position('panel_specimen_policy_conflict' in pg_get_functiondef(
    'public.eh115_validate_resolver_decision_trace(jsonb,text)'::regprocedure
  )) > 0,
  'panel-policy conflict traces are accepted by the persisted trace validator'
);
select throws_ok(
  $$
    select *
    from public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000002482'::uuid,
      '{}'::jsonb,
      '{}'::jsonb,
      'acceptance',
      '00000000-0000-0000-0000-000000002480'::uuid,
      repeat('a', 64),
      null::jsonb,
      null::uuid,
      'additive',
      null,
      null,
      null,
      null,
      false
    )
  $$,
  'invalid_input_identity_format_version',
  'regular writer rejects a missing identity format version'
);
select throws_ok(
  $$
    select *
    from public.eh120_write_automatic_verification_v2(
      '00000000-0000-0000-0000-000000002482'::uuid,
      '{}'::jsonb,
      jsonb_build_object('input_identity_format_version', '2'),
      repeat('b', 64),
      null::uuid,
      null,
      false,
      false,
      null::jsonb
    )
  $$,
  'invalid_input_identity_format_version',
  'automatic writer rejects an unsupported identity format version'
);
select throws_ok(
  $$
    insert into public.observation_normalization_revisions (
      extracted_biomarker_id,
      input_evidence_hash,
      resolver_result,
      mapping_confidence,
      catalog_manifest_version,
      resolver_version,
      normalization_version,
      verification_status,
      input_identity_format_version
    ) values (
      '00000000-0000-0000-0000-000000002482',
      repeat('a', 64),
      'unmapped',
      0,
      'eh248',
      'eh248',
      'eh248',
      'pending',
      '2'
    )
  $$,
  'invalid_input_identity_format_version',
  'revision insert rejects an unsupported identity format'
);
select throws_ok(
  $$
    insert into public.observation_normalization_revisions (
      extracted_biomarker_id,
      input_evidence_hash,
      resolver_result,
      mapping_confidence,
      catalog_manifest_version,
      resolver_version,
      normalization_version,
      verification_status,
      input_identity_format_version,
      writer_request_hash
    ) values (
      '00000000-0000-0000-0000-000000002482',
      'not-a-sha256-hash',
      'unmapped',
      0,
      'eh248',
      'eh248',
      'eh248',
      'pending',
      '1',
      repeat('b', 64)
    )
  $$,
  'invalid_input_evidence_hash',
  'v1 revision insert rejects a non-SHA-256 input hash'
);
select ok(
  to_regprocedure('public.registry_reprocess_record_row_v2(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,jsonb)') is not null,
  'EH-248 reprocess recorder signature is present'
);
select ok(
  to_regprocedure('public.restore_observation_normalization_revision_v1(uuid,uuid,uuid,uuid,text,text,jsonb)') is not null,
  'EH-248 historical restore signature is present'
);
select ok(
  exists (
    select 1
    from pg_description description
    join pg_proc procedure on procedure.oid = description.objoid
    where procedure.oid = 'public.restore_observation_normalization_revision_v1(uuid,uuid,uuid,uuid,text,text,jsonb)'::regprocedure
      and description.description like 'EH-248%'
  ),
  'historical restore RPC is documented as an EH-248 path'
);

select * from finish();
rollback;
