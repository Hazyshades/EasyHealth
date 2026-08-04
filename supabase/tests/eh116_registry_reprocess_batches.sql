-- EH-116: Registry 2.0 reprocess batch RPCs, privileges, and append-only guarantees.
--
-- Batch identifiers are captured in a temporary table on creation. `now()` is
-- transaction-scoped, so `requested_at` is identical for every batch created
-- inside this test and cannot be used to disambiguate them.
begin;

select plan(42);

-- ── 1. Function authorization matrix ────────────────────────────────────────

select ok(
  has_function_privilege(
    'service_role',
    'public.registry_reprocess_open_batch(text,uuid,uuid,text[],boolean,text,integer,integer,uuid,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute registry_reprocess_open_batch'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.registry_reprocess_open_batch(text,uuid,uuid,text[],boolean,text,integer,integer,uuid,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute registry_reprocess_open_batch'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.registry_reprocess_open_batch(text,uuid,uuid,text[],boolean,text,integer,integer,uuid,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute registry_reprocess_open_batch'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.registry_reprocess_apply_batch(uuid,text,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute registry_reprocess_apply_batch'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.registry_reprocess_apply_batch(uuid,text,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute registry_reprocess_apply_batch'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.registry_reprocess_apply_batch(uuid,text,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute registry_reprocess_apply_batch'
);

-- ── 2. Fixtures ─────────────────────────────────────────────────────────────

insert into public.profiles (id)
values ('00000000-0000-0000-0000-000000000116')
on conflict (id) do nothing;

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values (
  '00000000-0000-0000-0000-000000000117',
  '00000000-0000-0000-0000-000000000116',
  'eh116/doc',
  'eh116.pdf',
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
  '00000000-0000-0000-0000-000000000118',
  '00000000-0000-0000-0000-000000000117',
  '00000000-0000-0000-0000-000000000116',
  'Glucose', 'Glucose', 90, 'mg/dL', 'mg/dL', '90', 'serum', 1, 'Glucose 90 mg/dL', 0.95,
  'eh116-fixture', '2026-08-03.0', repeat('a', 64), '8', '5', 'resolved'
)
on conflict (id) do nothing;

create temporary table eh116_ids (label text primary key, id uuid) on commit drop;
create temporary table eh116_res (label text primary key, status text) on commit drop;

-- ── 3. Open a batch and append one candidate row ────────────────────────────

do $$
declare
  batch public.registry_reprocess_batches;
begin
  batch := public.registry_reprocess_open_batch(
    'document',
    '00000000-0000-0000-0000-000000000117',
    null,
    array['resolved','partial','ambiguous','unmapped']::text[],
    false,
    null,
    100,
    null,
    '00000000-0000-0000-0000-000000000116',
    'eh116 pgTAP drift fixture',
    '2026-08-03.0',
    repeat('a', 64),
    '8',
    '5',
    '1'
  );
  insert into eh116_ids (label, id) values ('drift', batch.id);

  perform public.registry_reprocess_record_row(
    batch.id,
    '00000000-0000-0000-0000-000000000118',
    '00000000-0000-0000-0000-000000000116',
    '00000000-0000-0000-0000-000000000117',
    null,
    'partial', null, null, 'pending', 'medium', repeat('b', 64),
    'resolved', 'glucose_serum_fasting_mmol_l', 'glucose', 'high', repeat('c', 64),
    'compatibility_preserving',
    jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'resolved',
      'decisionKind', 'single_reviewed_candidate',
      'inputEvidenceHash', repeat('c', 64),
      'catalogManifestVersion', '2026-08-03.0',
      'catalogManifestDigest', repeat('a', 64),
      'resolverVersion', '8',
      'winningCandidateKey', 'glucose_serum_fasting_mmol_l',
      'candidates', '[]'::jsonb,
      'missingAxes', '[]'::jsonb,
      'conflicts', '[]'::jsonb
    ),
    '1',
    'improved_resolution',
    'partial_to_resolved'
  );
end;
$$;

select is(
  (select candidates_total from public.registry_reprocess_batches
   where id = (select id from eh116_ids where label = 'drift')),
  1,
  'candidates_total increments after recording a row'
);

select is(
  (select candidates_improved from public.registry_reprocess_batches
   where id = (select id from eh116_ids where label = 'drift')),
  1,
  'candidates_improved increments for improved_resolution'
);

select is(
  (select apply_state::text from public.registry_reprocess_batch_rows
   where batch_id = (select id from eh116_ids where label = 'drift')),
  'pending',
  'improved_resolution row is pending apply'
);

-- ── 4. Append-only guarantees ───────────────────────────────────────────────

select throws_ok(
  $$
    delete from public.registry_reprocess_batch_rows
    where batch_id = (select id from eh116_ids where label = 'drift')
  $$,
  'registry_reprocess_batch_rows_append_only',
  'direct DELETE on batch rows is rejected'
);

select throws_ok(
  $$
    update public.registry_reprocess_batch_rows
    set diff_reason_code = 'tampered'
    where batch_id = (select id from eh116_ids where label = 'drift')
  $$,
  'registry_reprocess_batch_row_immutable_columns',
  'non-outcome UPDATE on batch rows is rejected'
);

-- ── 5. Digest drift is persisted, not raised ────────────────────────────────

do $$
declare
  result jsonb;
begin
  result := public.registry_reprocess_apply_batch(
    (select id from eh116_ids where label = 'drift'),
    repeat('f', 64),
    '00000000-0000-0000-0000-000000000116'
  );
  insert into eh116_res (label, status) values ('drift_apply', result ->> 'status');
end;
$$;

select is(
  (select status from eh116_res where label = 'drift_apply'),
  'catalog_manifest_drift',
  'apply reports catalog_manifest_drift when the current digest differs'
);

select is(
  (select state::text from public.registry_reprocess_batches
   where id = (select id from eh116_ids where label = 'drift')),
  'aborted',
  'drifted batch is durably marked aborted'
);

select is(
  (select abort_reason from public.registry_reprocess_batches
   where id = (select id from eh116_ids where label = 'drift')),
  'catalog_manifest_drift',
  'abort_reason records catalog_manifest_drift'
);

select is(
  (select count(*)::int from public.registry_reprocess_batch_rows
   where batch_id = (select id from eh116_ids where label = 'drift')
     and apply_state <> 'pending'),
  0,
  'no row is materialized when the digest drifts'
);

-- ── 6. Matching digest transitions the batch and returns pending rows ───────

do $$
declare
  batch public.registry_reprocess_batches;
  result jsonb;
begin
  batch := public.registry_reprocess_open_batch(
    'document',
    '00000000-0000-0000-0000-000000000117',
    null,
    array['resolved','partial','ambiguous','unmapped']::text[],
    false,
    null,
    100,
    null,
    '00000000-0000-0000-0000-000000000116',
    'eh116 pgTAP apply fixture',
    '2026-08-03.0',
    repeat('a', 64),
    '8',
    '5',
    '1'
  );
  insert into eh116_ids (label, id) values ('apply', batch.id);

  perform public.registry_reprocess_record_row(
    batch.id,
    '00000000-0000-0000-0000-000000000118',
    '00000000-0000-0000-0000-000000000116',
    '00000000-0000-0000-0000-000000000117',
    null,
    'partial', null, null, 'pending', 'medium', repeat('d', 64),
    'resolved', 'glucose_serum_fasting_mmol_l', 'glucose', 'high', repeat('e', 64),
    'compatibility_preserving',
    jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'resolved',
      'decisionKind', 'single_reviewed_candidate',
      'inputEvidenceHash', repeat('e', 64),
      'catalogManifestVersion', '2026-08-03.0',
      'catalogManifestDigest', repeat('a', 64),
      'resolverVersion', '8',
      'winningCandidateKey', 'glucose_serum_fasting_mmol_l',
      'candidates', '[]'::jsonb,
      'missingAxes', '[]'::jsonb,
      'conflicts', '[]'::jsonb
    ),
    '1',
    'improved_resolution',
    'partial_to_resolved'
  );

  result := public.registry_reprocess_apply_batch(
    batch.id,
    repeat('a', 64),
    '00000000-0000-0000-0000-000000000116'
  );
  insert into eh116_res (label, status) values ('apply_first', result ->> 'status');
  insert into eh116_res (label, status)
    values ('apply_first_rows', jsonb_array_length(result -> 'rows')::text);
end;
$$;

select is(
  (select status from eh116_res where label = 'apply_first'),
  'ok',
  'apply reports ok when the digest matches'
);

select is(
  (select status from eh116_res where label = 'apply_first_rows'),
  '1',
  'apply returns exactly the pending rows needing materialization'
);

select is(
  (select state::text from public.registry_reprocess_batches
   where id = (select id from eh116_ids where label = 'apply')),
  'apply_in_progress',
  'batch transitions to apply_in_progress on matching digest'
);

-- ── 7. Per-row outcome recording ────────────────────────────────────────────

do $$
declare
  target_row uuid;
begin
  select id into target_row from public.registry_reprocess_batch_rows
  where batch_id = (select id from eh116_ids where label = 'apply')
    and apply_state = 'pending';

  perform public.registry_reprocess_finish_row(target_row, null::uuid, 'writer_smoke_test');
  perform public.registry_reprocess_finish_batch(
    (select id from eh116_ids where label = 'apply')
  );
end;
$$;

select is(
  (select apply_state::text from public.registry_reprocess_batch_rows
   where batch_id = (select id from eh116_ids where label = 'apply')),
  'failed',
  'writer error is recorded as failed apply_state'
);

select is(
  (select writer_error_code from public.registry_reprocess_batch_rows
   where batch_id = (select id from eh116_ids where label = 'apply')),
  'writer_smoke_test',
  'writer_error_code is persisted'
);

select is(
  (select writer_errors from public.registry_reprocess_batches
   where id = (select id from eh116_ids where label = 'apply')),
  1,
  'batch writer_errors counter increments'
);

select is(
  (select state::text from public.registry_reprocess_batches
   where id = (select id from eh116_ids where label = 'apply')),
  'applied_with_errors',
  'finish_batch marks applied_with_errors when writer errors occurred'
);

-- ── 8. Idempotent re-apply ──────────────────────────────────────────────────

do $$
declare
  result jsonb;
begin
  result := public.registry_reprocess_apply_batch(
    (select id from eh116_ids where label = 'apply'),
    repeat('a', 64),
    '00000000-0000-0000-0000-000000000116'
  );
  insert into eh116_res (label, status) values ('apply_again', result ->> 'status');
  insert into eh116_res (label, status)
    values ('apply_again_rows', jsonb_array_length(result -> 'rows')::text);
end;
$$;

select is(
  (select status from eh116_res where label = 'apply_again'),
  'applied_with_errors',
  're-apply reports the recorded terminal state'
);

select is(
  (select status from eh116_res where label = 'apply_again_rows'),
  '0',
  're-apply returns no rows to materialize'
);

select is(
  (select state::text from public.registry_reprocess_batches
   where id = (select id from eh116_ids where label = 'apply')),
  'applied_with_errors',
  're-apply does not regress batch state'
);

-- ── 9. Locked row outcome cannot be rewritten ───────────────────────────────

select throws_ok(
  $$
    select public.registry_reprocess_finish_row(
      (select id from public.registry_reprocess_batch_rows
       where batch_id = (select id from eh116_ids where label = 'apply')),
      null::uuid,
      'second_attempt'
    )
  $$,
  'batch_row_outcome_locked',
  'a settled batch row cannot record a second outcome'
);

-- ── 10. Header constraints ──────────────────────────────────────────────────

select throws_ok(
  $$
    insert into public.registry_reprocess_batches (
      scope_kind, scope_document_id, batch_limit,
      catalog_manifest_version, catalog_manifest_digest,
      resolver_version, normalization_version, compatibility_policy_version
    )
    values (
      'document', null, 10,
      '2026-08-03.0', repeat('a', 64),
      '8', '5', '1'
    )
  $$,
  23514,
  NULL,
  'document scope requires a non-null document id'
);

select throws_ok(
  $$
    insert into public.registry_reprocess_batches (
      scope_kind, scope_document_id, scope_profile_id, batch_limit,
      catalog_manifest_version, catalog_manifest_digest,
      resolver_version, normalization_version, compatibility_policy_version
    )
    values (
      'global',
      '00000000-0000-0000-0000-000000000117',
      null,
      10,
      '2026-08-03.0', repeat('a', 64),
      '8', '5', '1'
    )
  $$,
  23514,
  NULL,
  'global scope forbids a document id'
);

select throws_ok(
  $$
    insert into public.registry_reprocess_batches (
      scope_kind, batch_limit, include_manual_decisions, manual_decision_reason,
      catalog_manifest_version, catalog_manifest_digest,
      resolver_version, normalization_version, compatibility_policy_version
    )
    values (
      'global', 10, true, '',
      '2026-08-03.0', repeat('a', 64),
      '8', '5', '1'
    )
  $$,
  23514,
  NULL,
  'manual-decision override requires a non-empty reason'
);

select throws_ok(
  $$
    insert into public.registry_reprocess_batches (
      scope_kind, batch_limit,
      catalog_manifest_version, catalog_manifest_digest,
      resolver_version, normalization_version, compatibility_policy_version
    )
    values (
      'global', 10,
      '2026-08-03.0', 'not-a-hex-digest',
      '8', '5', '1'
    )
  $$,
  23514,
  NULL,
  'catalog manifest digest must be lowercase hex(64)'
);

select throws_ok(
  $$
    insert into public.registry_reprocess_batches (
      scope_kind, batch_limit, resolver_result_filter,
      catalog_manifest_version, catalog_manifest_digest,
      resolver_version, normalization_version, compatibility_policy_version
    )
    values (
      'global', 10, array['not_an_outcome']::text[],
      '2026-08-03.0', repeat('a', 64),
      '8', '5', '1'
    )
  $$,
  23514,
  NULL,
  'resolver_result_filter only accepts the four resolver outcomes'
);

-- ── 11. Table privileges: anon/authenticated have no access at all ──────────
--
-- Both tables revoke every privilege from public/anon/authenticated and grant
-- only service_role, so an unauthorized role hits a hard permission denied
-- rather than an empty RLS result set.

select ok(
  not has_table_privilege('anon', 'public.registry_reprocess_batches', 'SELECT'),
  'anon cannot select registry_reprocess_batches'
);

select ok(
  not has_table_privilege('anon', 'public.registry_reprocess_batch_rows', 'SELECT'),
  'anon cannot select registry_reprocess_batch_rows'
);

select ok(
  not has_table_privilege('authenticated', 'public.registry_reprocess_batches', 'SELECT'),
  'authenticated cannot select registry_reprocess_batches'
);

select ok(
  not has_table_privilege('authenticated', 'public.registry_reprocess_batch_rows', 'SELECT'),
  'authenticated cannot select registry_reprocess_batch_rows'
);

select ok(
  not has_table_privilege('anon', 'public.registry_reprocess_batches', 'INSERT'),
  'anon cannot insert into registry_reprocess_batches'
);

select ok(
  has_table_privilege('service_role', 'public.registry_reprocess_batches', 'SELECT'),
  'service_role can select registry_reprocess_batches'
);

select ok(
  has_table_privilege('service_role', 'public.registry_reprocess_batch_rows', 'INSERT'),
  'service_role can insert registry_reprocess_batch_rows'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.registry_reprocess_batches'::regclass),
  'row level security is enabled on registry_reprocess_batches'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.registry_reprocess_batch_rows'::regclass),
  'row level security is enabled on registry_reprocess_batch_rows'
);

-- ── 12. Instrumental exclusion is structural ────────────────────────────────

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_extracted_biomarkers'
      and column_name = 'observation_kind'
  ),
  'document_extracted_biomarkers has no observation_kind column'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_instrumental_lineage_check'
  ),
  'instrumental observations cannot reference an extracted biomarker row'
);

select * from finish();
rollback;
