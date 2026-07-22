-- EH-102 pre-launch hard cutover: one Registry 2.0 observation identity.

alter table public.document_extracted_biomarkers
  add column if not exists analyte_key text,
  add column if not exists resolution_status text;

alter table public.observations
  alter column biomarker_key drop not null,
  add column if not exists analyte_key text,
  add column if not exists resolution_status text,
  add column if not exists source_extracted_biomarker_id uuid references public.document_extracted_biomarkers(id) on delete set null;

alter table public.observation_normalization_revisions
  add column if not exists analyte_key text;

-- Development data is disposable: remove the former Registry v1 identity rather
-- than carrying it as a nullable compatibility field into launch.
alter table public.observations
  drop column if exists biomarker_key;

alter table public.observation_normalization_revisions
  drop column if exists canonical_biomarker_key;

alter table public.observation_normalization_revisions
  drop constraint if exists observation_normalization_revisions_resolver_result_check;

alter table public.observation_normalization_revisions
  add constraint observation_normalization_revisions_resolver_result_check
  check (resolver_result in ('resolved', 'ambiguous', 'partial', 'unmapped'));

alter table public.observations
  drop constraint if exists observations_resolution_status_check;

alter table public.observations
  add constraint observations_resolution_status_check
  check (resolution_status is null or resolution_status in ('resolved', 'ambiguous', 'partial', 'unmapped'));

alter table public.observations
  drop constraint if exists observations_identity_unique;

drop index if exists public.observations_profile_key_specimen;
drop index if exists public.observations_profile_key_date;

create unique index if not exists observations_source_extracted_biomarker_unique
  on public.observations (source_extracted_biomarker_id)
  where source_extracted_biomarker_id is not null;

create index if not exists observations_profile_registry_v2_identity
  on public.observations (profile_id, measurement_definition_key, observed_at)
  where measurement_definition_key is not null;

create index if not exists observations_profile_analyte_identity
  on public.observations (profile_id, analyte_key, observed_at)
  where analyte_key is not null;
