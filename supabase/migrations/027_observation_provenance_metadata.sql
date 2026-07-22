-- EH-103 observation provenance metadata (launch foundation).
--
-- Adds the immutable raw-evidence, source-lineage, resolution-status, nullable
-- semantic-link, and processing-release snapshot contract to document-derived
-- observations, and aligns the revision release columns to the EH-102 launch
-- catalog terminology so there is a single convention across both tables.
-- Development data is disposable; this runs from an empty database.

-- ── normalize release identifiers to catalog terminology ──
-- Applies to both the revision store and the denormalized extracted-row snapshot.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'observation_normalization_revisions'
      and column_name = 'registry_version'
  ) then
    alter table public.observation_normalization_revisions
      rename column registry_version to catalog_manifest_version;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'observation_normalization_revisions'
      and column_name = 'registry_manifest_digest'
  ) then
    alter table public.observation_normalization_revisions
      rename column registry_manifest_digest to catalog_manifest_digest;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'observation_normalization_revisions'
      and column_name = 'normalization_schema_version'
  ) then
    alter table public.observation_normalization_revisions
      rename column normalization_schema_version to normalization_version;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_extracted_biomarkers'
      and column_name = 'registry_version'
  ) then
    alter table public.document_extracted_biomarkers
      rename column registry_version to catalog_manifest_version;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_extracted_biomarkers'
      and column_name = 'registry_manifest_digest'
  ) then
    alter table public.document_extracted_biomarkers
      rename column registry_manifest_digest to catalog_manifest_digest;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_extracted_biomarkers'
      and column_name = 'normalization_schema_version'
  ) then
    alter table public.document_extracted_biomarkers
      rename column normalization_schema_version to normalization_version;
  end if;
end $$;

-- Source extraction lineage for the revision (processing version that produced the row).
alter table public.observation_normalization_revisions
  add column if not exists extraction_version text;

-- Denormalized extraction-version snapshot on the extracted row (optional).
alter table public.document_extracted_biomarkers
  add column if not exists extraction_version text;

-- ── observations: immutable raw evidence + processing release snapshots ──
-- Raw label is already stored as raw_name; raw_value_text / raw_reference_text /
-- raw_unit preserve the printed source representation independently of parsed fields.
-- catalog_manifest_version / catalog_manifest_digest identify the EH-102 launch
-- catalog release that participated; resolver_version and normalization_version are
-- the resolver and normalization schema that participated. All are nullable so
-- non-document-derived observations (e.g. instrumental) are not forced to carry them.
alter table public.observations
  add column if not exists raw_value_text text,
  add column if not exists raw_reference_text text,
  add column if not exists raw_unit text,
  add column if not exists extraction_version text,
  add column if not exists provenance_schema_version text not null default '1',
  add column if not exists catalog_manifest_version text,
  add column if not exists catalog_manifest_digest text,
  add column if not exists resolver_version text,
  add column if not exists normalization_version text;

comment on column public.observations.raw_value_text is
  'Exact printed value text (thresholds, decimal commas, qualitative terms) preserved from source.';
comment on column public.observations.raw_reference_text is
  'Exact printed reference-range text from source.';
comment on column public.observations.raw_unit is
  'Nullable printed unit; unitless qualitative results store null.';
comment on column public.observations.catalog_manifest_version is
  'EH-102 launch catalog manifest version that participated in resolution.';
comment on column public.observations.catalog_manifest_digest is
  'EH-102 launch catalog manifest digest (sha256) that participated in resolution.';
comment on column public.observations.provenance_schema_version is
  'Assigned by the persistence layer; not copied from extraction.';

-- ── write-once enforcement on immutable provenance ──
-- Raw/source/version provenance cannot change after creation. Equal retries are
-- permitted (NEW equals OLD); the guard only blocks a change once a value has been
-- written (OLD is not null), so first population of disposable development rows is
-- still allowed.
create or replace function public.enforce_observation_provenance_write_once()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' then
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

drop trigger if exists observation_provenance_write_once on public.observations;
create trigger observation_provenance_write_once
  before update on public.observations
  for each row
  execute function public.enforce_observation_provenance_write_once();
