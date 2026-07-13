-- Versioned measurement-resolution metadata. The registry remains code-based.

alter table public.document_extracted_biomarkers
  add column if not exists raw_unit text,
  add column if not exists raw_value_text text,
  add column if not exists raw_reference_range text,
  add column if not exists section_context text,
  add column if not exists measurement_definition_key text,
  add column if not exists resolver_result text,
  add column if not exists mapping_confidence numeric,
  add column if not exists registry_version text,
  add column if not exists resolver_version text,
  add column if not exists normalization_schema_version text,
  add column if not exists verification_status text;

alter table public.observations
  add column if not exists measurement_definition_key text,
  add column if not exists normalization_revision_id uuid;

create table if not exists public.observation_normalization_revisions (
  id uuid primary key default gen_random_uuid(),
  extracted_biomarker_id uuid not null references public.document_extracted_biomarkers(id) on delete cascade,
  observation_id uuid references public.observations(id) on delete set null,
  input_evidence_hash text not null,
  measurement_definition_key text,
  canonical_biomarker_key text,
  resolver_result text not null check (resolver_result in ('resolved', 'ambiguous', 'unmapped')),
  mapping_confidence numeric not null check (mapping_confidence >= 0 and mapping_confidence <= 1),
  registry_version text not null,
  resolver_version text not null,
  normalization_schema_version text not null,
  verification_status text not null check (verification_status in ('pending', 'user_verified', 'manually_corrected')),
  is_active boolean not null default false,
  supersedes_revision_id uuid references public.observation_normalization_revisions(id) on delete set null,
  promoted_at timestamptz,
  promoted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists normalization_revisions_extracted_idx
  on public.observation_normalization_revisions (extracted_biomarker_id, created_at desc);

create unique index if not exists normalization_revisions_one_active_per_extracted
  on public.observation_normalization_revisions (extracted_biomarker_id)
  where is_active;

alter table public.observations
  add constraint observations_normalization_revision_fk
  foreign key (normalization_revision_id)
  references public.observation_normalization_revisions(id)
  on delete set null;

comment on table public.observation_normalization_revisions is
  'Append-only resolver and verification decisions; registry stays in application code.';
