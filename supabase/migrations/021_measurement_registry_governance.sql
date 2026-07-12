-- Registry 2.1 governance metadata. This extends the append-only revision
-- store introduced in 020; raw extraction evidence and active observations stay intact.

alter table public.document_extracted_biomarkers
  add column if not exists normalized_unit text,
  add column if not exists unit_dimension text,
  add column if not exists mapping_confidence_band text,
  add column if not exists resolver_evidence jsonb,
  add column if not exists registry_manifest_digest text;

alter table public.observation_normalization_revisions
  add column if not exists mapping_confidence_band text,
  add column if not exists resolver_evidence jsonb not null default '[]'::jsonb,
  add column if not exists registry_manifest_digest text,
  add column if not exists mapping_change_classification text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists correction_reason text,
  add column if not exists reversal_of_revision_id uuid references public.observation_normalization_revisions(id) on delete set null;

alter table public.document_extracted_biomarkers
  drop constraint if exists document_extracted_biomarkers_mapping_confidence_band_check;

alter table public.document_extracted_biomarkers
  add constraint document_extracted_biomarkers_mapping_confidence_band_check
  check (mapping_confidence_band is null or mapping_confidence_band in ('high', 'medium', 'low'));

alter table public.observation_normalization_revisions
  drop constraint if exists observation_normalization_revisions_mapping_confidence_band_check;

alter table public.observation_normalization_revisions
  add constraint observation_normalization_revisions_mapping_confidence_band_check
  check (mapping_confidence_band is null or mapping_confidence_band in ('high', 'medium', 'low'));

alter table public.observation_normalization_revisions
  drop constraint if exists observation_normalization_revisions_mapping_change_classification_check;

alter table public.observation_normalization_revisions
  add constraint observation_normalization_revisions_mapping_change_classification_check
  check (
    mapping_change_classification is null
    or mapping_change_classification in ('additive', 'compatibility_preserving', 'review_required', 'breaking')
  );

create index if not exists normalization_revisions_active_manual_idx
  on public.observation_normalization_revisions (extracted_biomarker_id, verification_status)
  where is_active and verification_status in ('user_verified', 'manually_corrected');

alter table public.observation_normalization_revisions enable row level security;

drop policy if exists "service_all_observation_normalization_revisions" on public.observation_normalization_revisions;
create policy "service_all_observation_normalization_revisions"
  on public.observation_normalization_revisions
  for all to service_role using (true) with check (true);

create or replace function public.promote_observation_normalization_revision(
  p_revision_id uuid,
  p_observation_id uuid,
  p_actor_id uuid default null
)
returns public.observation_normalization_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.observation_normalization_revisions;
begin
  select * into target
  from public.observation_normalization_revisions
  where id = p_revision_id
  for update;

  if target.id is null then
    raise exception 'Normalization revision % was not found', p_revision_id;
  end if;

  update public.observation_normalization_revisions
  set is_active = false
  where extracted_biomarker_id = target.extracted_biomarker_id
    and is_active = true
    and id <> target.id;

  update public.observation_normalization_revisions
  set is_active = true,
      observation_id = p_observation_id,
      promoted_at = now(),
      promoted_by = p_actor_id
  where id = target.id
  returning * into target;

  update public.observations
  set measurement_definition_key = target.measurement_definition_key,
      normalization_revision_id = target.id
  where id = p_observation_id;

  return target;
end;
$$;
