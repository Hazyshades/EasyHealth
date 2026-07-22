-- EH-104 Phase B: enforce resolver/verification guards, same-source MATCH FULL
-- lineage, append-only revisions, controlled laboratory purge, and remove the
-- legacy promotion RPC.
--
-- Prerequisite: eh104_resolution_verification_preflight() is clean (or an
-- explicitly disposable environment was reset). This migration does not repair
-- semantic data. NOT VALID is not used.

-- ── 1. Write-once bypass only inside controlled purge ────────────────────────
create or replace function public.enforce_observation_provenance_write_once()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    -- Controlled purge may clear the laboratory lineage pair together.
    if current_setting('easyhealth.purge_lineage', true) = 'on'
      and new.source_extracted_biomarker_id is null
      and new.normalization_revision_id is null
      and (
        old.source_extracted_biomarker_id is not null
        or old.normalization_revision_id is not null
      )
      and new.raw_name is not distinct from old.raw_name
      and new.raw_value_text is not distinct from old.raw_value_text
      and new.raw_reference_text is not distinct from old.raw_reference_text
      and new.raw_unit is not distinct from old.raw_unit
      and new.source_page is not distinct from old.source_page
      and new.source_text is not distinct from old.source_text
      and new.bounding_box is not distinct from old.bounding_box
      and new.confidence is not distinct from old.confidence
      and new.extraction_version is not distinct from old.extraction_version
      and new.provenance_schema_version is not distinct from old.provenance_schema_version
      and new.catalog_manifest_version is not distinct from old.catalog_manifest_version
      and new.catalog_manifest_digest is not distinct from old.catalog_manifest_digest
      and new.resolver_version is not distinct from old.resolver_version
      and new.normalization_version is not distinct from old.normalization_version
    then
      return new;
    end if;

    if (old.raw_name is not null and new.raw_name is distinct from old.raw_name)
      or (old.raw_value_text is not null and new.raw_value_text is distinct from old.raw_value_text)
      or (old.raw_reference_text is not null and new.raw_reference_text is distinct from old.raw_reference_text)
      or (old.raw_unit is not null and new.raw_unit is distinct from old.raw_unit)
      or (old.source_page is not null and new.source_page is distinct from old.source_page)
      or (old.source_text is not null and new.source_text is distinct from old.source_text)
      or (old.bounding_box is not null and new.bounding_box is distinct from old.bounding_box)
      or (old.confidence is not null and new.confidence is distinct from old.confidence)
      or (old.source_extracted_biomarker_id is not null and new.source_extracted_biomarker_id is distinct from old.source_extracted_biomarker_id)
      or (old.extraction_version is not null and new.extraction_version is distinct from old.extraction_version)
      or (old.provenance_schema_version is not null and new.provenance_schema_version is distinct from old.provenance_schema_version)
      or (old.catalog_manifest_version is not null and new.catalog_manifest_version is distinct from old.catalog_manifest_version)
      or (old.catalog_manifest_digest is not null and new.catalog_manifest_digest is distinct from old.catalog_manifest_digest)
      or (old.resolver_version is not null and new.resolver_version is distinct from old.resolver_version)
      or (old.normalization_version is not null and new.normalization_version is distinct from old.normalization_version)
    then
      raise exception 'Observation provenance is write-once; raw, source, and version fields cannot be mutated after creation.';
    end if;
  end if;
  return new;
end;
$$;

-- ── 2. Attach revision verification guards ───────────────────────────────────
drop trigger if exists eh104_normalization_revision_verification_guard
  on public.observation_normalization_revisions;

create trigger eh104_normalization_revision_verification_guard
before insert or update on public.observation_normalization_revisions
for each row
execute function public.eh104_validate_normalization_revision_verification();

comment on function public.eh104_validate_normalization_revision_verification() is
  'EH-104 Phase B runtime trigger: verification actor/timestamp matrix and verified-cross-axis rule.';

-- ── 3. Final extracted resolver_result domain ────────────────────────────────
alter table public.document_extracted_biomarkers
  drop constraint if exists document_extracted_biomarkers_resolver_result_check;

alter table public.document_extracted_biomarkers
  add constraint document_extracted_biomarkers_resolver_result_check
  check (
    resolver_result is null
    or resolver_result in ('resolved', 'partial', 'ambiguous', 'unmapped')
  );

-- ── 4. Same-source composite FK with MATCH FULL (deferred for atomic writer) ─
-- The EH-106 writer inserts a source-only laboratory observation, then creates
-- the revision and promotes within one transaction. DEFERRABLE INITIALLY
-- DEFERRED allows that interim half-link only until commit; at rest half-links
-- are rejected.

alter table public.observations
  drop constraint if exists observations_normalization_revision_fk;

-- Prevent ON DELETE SET NULL on the source extraction from creating half-links.
alter table public.observations
  drop constraint if exists observations_source_extracted_biomarker_id_fkey;

alter table public.observations
  drop constraint if exists observations_source_extracted_biomarker_fkey;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint as con
    join pg_class as rel on rel.oid = con.conrelid
    join pg_namespace as nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'observations'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) ilike '%source_extracted_biomarker_id%'
      and pg_get_constraintdef(con.oid) ilike '%document_extracted_biomarkers%'
  loop
    execute format(
      'alter table public.observations drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

alter table public.observations
  add constraint observations_source_extracted_biomarker_fkey
  foreign key (source_extracted_biomarker_id)
  references public.document_extracted_biomarkers(id)
  on delete restrict;

alter table public.observations
  add constraint observations_normalization_revision_same_source_fk
  foreign key (normalization_revision_id, source_extracted_biomarker_id)
  references public.observation_normalization_revisions (id, extracted_biomarker_id)
  match full
  on delete no action
  deferrable initially deferred;

-- ── 5. Append-only revisions outside controlled purge ────────────────────────
create or replace function public.eh104_reject_direct_revision_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('easyhealth.purge_lineage', true) = 'on' then
    return old;
  end if;
  raise exception using message = 'normalization_revision_delete_forbidden';
end;
$$;

drop trigger if exists eh104_normalization_revision_append_only
  on public.observation_normalization_revisions;

create trigger eh104_normalization_revision_append_only
before delete on public.observation_normalization_revisions
for each row
execute function public.eh104_reject_direct_revision_delete();

revoke delete on table public.observation_normalization_revisions
  from anon, authenticated;

-- ── 6. Controlled laboratory lineage purge ───────────────────────────────────
create or replace function public.purge_document_derived_laboratory_lineage(
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_observations integer := 0;
  cleared_observations integer := 0;
  deleted_extracted integer := 0;
begin
  if p_document_id is null then
    raise exception using message = 'document_id_required';
  end if;

  perform set_config('easyhealth.purge_lineage', 'on', true);

  -- Lock laboratory observations that still carry document-derived lineage.
  perform 1
  from public.observations as observation
  where observation.document_id = p_document_id
    and observation.observation_kind = 'lab'
    and (
      observation.source_extracted_biomarker_id is not null
      or observation.normalization_revision_id is not null
    )
  order by observation.id
  for update;

  get diagnostics locked_observations = row_count;

  update public.observations as observation
  set
    normalization_revision_id = null,
    source_extracted_biomarker_id = null,
    measurement_definition_key = null,
    analyte_key = null,
    resolution_status = null
  where observation.document_id = p_document_id
    and observation.observation_kind = 'lab'
    and (
      observation.source_extracted_biomarker_id is not null
      or observation.normalization_revision_id is not null
    );

  get diagnostics cleared_observations = row_count;

  -- Lock extracted rows then delete; revision delete trigger allows purge context.
  perform 1
  from public.document_extracted_biomarkers as extracted
  where extracted.document_id = p_document_id
  order by extracted.id
  for update;

  with deleted as (
    delete from public.document_extracted_biomarkers as extracted
    where extracted.document_id = p_document_id
    returning extracted.id
  )
  select count(*)::integer into deleted_extracted from deleted;

  -- Safety: never leave a half-linked laboratory observation for this document.
  if exists (
    select 1
    from public.observations as observation
    where observation.document_id = p_document_id
      and observation.observation_kind = 'lab'
      and (observation.source_extracted_biomarker_id is null)
        <> (observation.normalization_revision_id is null)
  ) then
    raise exception using message = 'laboratory_lineage_half_link_after_purge';
  end if;

  return jsonb_build_object(
    'document_id', p_document_id,
    'locked_observations', locked_observations,
    'cleared_observations', cleared_observations,
    'deleted_extracted_biomarkers', deleted_extracted
  );
end;
$$;

comment on function public.purge_document_derived_laboratory_lineage(uuid) is
  'EH-104 Phase B service-only purge: clear laboratory lineage pairs then delete extracted biomarker audit rows for a document.';

revoke all on function public.purge_document_derived_laboratory_lineage(uuid)
  from public, anon, authenticated;
grant execute on function public.purge_document_derived_laboratory_lineage(uuid)
  to service_role;

-- Disposable-only full laboratory lineage reset (no semantic repair).
create or replace function public.eh104_phase_b_reset_document_derived_laboratory_lineage(
  p_confirm_disposable_reset boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  document_row record;
  document_count integer := 0;
  total_cleared integer := 0;
  total_deleted integer := 0;
  purge_result jsonb;
begin
  -- Process env flags are enforced by the CLI before this argument is set true.
  if p_confirm_disposable_reset is not true then
    raise exception using message = 'phase_b_reset_not_allowed';
  end if;

  for document_row in
    select distinct document_id as id
    from (
      select document_id from public.document_extracted_biomarkers
      union
      select document_id
      from public.observations
      where observation_kind = 'lab'
        and document_id is not null
        and (
          source_extracted_biomarker_id is not null
          or normalization_revision_id is not null
        )
    ) as documents
    where document_id is not null
    order by document_id
  loop
    purge_result := public.purge_document_derived_laboratory_lineage(document_row.id);
    document_count := document_count + 1;
    total_cleared := total_cleared + coalesce((purge_result ->> 'cleared_observations')::integer, 0);
    total_deleted := total_deleted + coalesce((purge_result ->> 'deleted_extracted_biomarkers')::integer, 0);
  end loop;

  return jsonb_build_object(
    'documents_purged', document_count,
    'cleared_observations', total_cleared,
    'deleted_extracted_biomarkers', total_deleted
  );
end;
$$;

comment on function public.eh104_phase_b_reset_document_derived_laboratory_lineage(boolean) is
  'Disposable-only EH-104 Phase B reset. Requires p_confirm_disposable_reset=true after process env checks.';

revoke all on function public.eh104_phase_b_reset_document_derived_laboratory_lineage(boolean)
  from public, anon, authenticated;
grant execute on function public.eh104_phase_b_reset_document_derived_laboratory_lineage(boolean)
  to service_role;

-- ── 7. Drop legacy promotion RPC ─────────────────────────────────────────────
drop function if exists public.promote_observation_normalization_revision(uuid, uuid, uuid);
