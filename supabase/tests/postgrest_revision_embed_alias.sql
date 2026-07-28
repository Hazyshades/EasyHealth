begin;

select plan(8);

-- ── constraint parity ────────────────────────────────────────────────────────

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_normalization_revision_same_source_fk'
  ),
  'authoritative composite same-source FK exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_normalization_revision_fk'
  ),
  'temporary old-name compatibility alias exists'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_normalization_revision_fk'
  ),
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_normalization_revision_same_source_fk'
  ),
  'alias definition is byte-identical to the authoritative composite FK'
);

select ok(
  (
    select pg_get_constraintdef(oid) ilike '%match full%'
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_normalization_revision_fk'
  ),
  'alias preserves MATCH FULL'
);

select ok(
  (
    select condeferrable and condeferred
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_normalization_revision_fk'
  ),
  'alias is DEFERRABLE INITIALLY DEFERRED'
);

select ok(
  (
    select obj_description(oid, 'pg_constraint') ilike '%temporary%alias%'
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_normalization_revision_fk'
  ),
  'alias carries the temporary-compatibility comment for the follow-up drop change'
);

-- ── seed ─────────────────────────────────────────────────────────────────────

insert into public.profiles (id, email)
values ('10000000-0000-0000-0000-000000000001', 'postgrest-alias@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values (
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000001',
  'postgrest-alias/doc.pdf',
  'doc.pdf',
  'completed'
);

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, status, resolver_result
)
values
  ('10000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Alias target', 'accepted', 'resolved'),
  ('10000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Alias mismatch source', 'accepted', 'resolved');

insert into public.observation_normalization_revisions (
  id, extracted_biomarker_id, input_evidence_hash, analyte_key,
  measurement_definition_key, resolver_result, mapping_confidence,
  catalog_manifest_version, resolver_version, normalization_version,
  verification_status
)
values (
  '10000000-0000-0000-0000-000000000040',
  '10000000-0000-0000-0000-000000000020',
  'postgrest-alias-target',
  'alias_target',
  'glucose_serum',
  'resolved',
  0.9,
  'alias',
  'alias',
  'alias',
  'pending'
);

-- ── behavior: both constraints validate the same-source pair ─────────────────

select lives_ok(
  $$
    do $body$
    begin
      insert into public.observations (
        id, profile_id, document_id,
        source_extracted_biomarker_id, normalization_revision_id,
        name, value, unit, observed_at, observation_kind
      )
      values (
        '10000000-0000-0000-0000-000000000030',
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000010',
        '10000000-0000-0000-0000-000000000020',
        '10000000-0000-0000-0000-000000000040',
        'Alias observation', 1, 'mg/dL', '2026-01-01', 'lab'
      );
      execute 'set constraints observations_normalization_revision_fk, observations_normalization_revision_same_source_fk immediate';
    end
    $body$;
  $$,
  'a valid same-source pair satisfies both the alias and the authoritative FK'
);

select throws_ok(
  $$
    do $body$
    begin
      insert into public.observations (
        id, profile_id, document_id,
        source_extracted_biomarker_id, normalization_revision_id,
        name, value, unit, observed_at, observation_kind
      )
      values (
        '10000000-0000-0000-0000-000000000031',
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000010',
        '10000000-0000-0000-0000-000000000021',
        '10000000-0000-0000-0000-000000000040',
        'Alias mismatch observation', 2, 'mg/dL', '2026-01-02', 'lab'
      );
      execute 'set constraints observations_normalization_revision_fk, observations_normalization_revision_same_source_fk immediate';
    end
    $body$;
  $$,
  '23503',
  null,
  'a cross-source revision pair is rejected under the dual-constraint bridge'
);

select * from finish();

rollback;
