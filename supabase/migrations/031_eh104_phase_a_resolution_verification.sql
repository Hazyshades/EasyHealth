-- EH-104 Phase A: backward-compatible resolver/verification foundation.
--
-- This migration intentionally does not add MATCH FULL, decision/cross-axis
-- triggers, purge enforcement, or remove the legacy promotion RPC. Those
-- changes require the EH-106 writer cutover and belong to Phase B.

alter table public.observation_normalization_revisions
  add column if not exists verification_decided_at timestamptz,
  add column if not exists verification_actor_type text,
  add column if not exists verification_actor_id uuid references public.profiles(id) on delete set null;

alter table public.observation_normalization_revisions
  alter column verification_status set default 'pending';

alter table public.observation_normalization_revisions
  drop constraint if exists observation_normalization_revisions_verification_status_check;

alter table public.observation_normalization_revisions
  add constraint observation_normalization_revisions_verification_status_check
  check (verification_status in ('pending', 'auto_verified', 'user_verified', 'manually_corrected'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observation_normalization_revisions'::regclass
      and conname = 'observation_normalization_revisions_id_extracted_key'
  ) then
    alter table public.observation_normalization_revisions
      add constraint observation_normalization_revisions_id_extracted_key
      unique (id, extracted_biomarker_id);
  end if;
end;
$$;

create or replace function public.eh104_validate_normalization_revision_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verification_status = 'pending' then
    if new.verification_decided_at is not null
      or new.verification_actor_type is not null
      or new.verification_actor_id is not null then
      raise exception 'pending verification must not include decision metadata';
    end if;
  elsif new.verification_status = 'auto_verified' then
    if new.verification_decided_at is null
      or new.verification_actor_type is distinct from 'system'
      or new.verification_actor_id is not null then
      raise exception 'auto_verified requires a system decision timestamp and no actor id';
    end if;
  elsif new.verification_status in ('user_verified', 'manually_corrected') then
    if new.verification_decided_at is null
      or new.verification_actor_type is distinct from 'user'
      or new.verification_actor_id is null then
      raise exception '% requires a user decision timestamp and actor id', new.verification_status;
    end if;
  else
    raise exception 'unsupported verification status: %', new.verification_status;
  end if;

  if new.verification_status in ('auto_verified', 'user_verified', 'manually_corrected')
    and (new.resolver_result is distinct from 'resolved' or new.measurement_definition_key is null) then
    raise exception 'verified normalization revision must be resolved and have a measurement definition';
  end if;

  return new;
end;
$$;

comment on function public.eh104_validate_normalization_revision_verification() is
  'EH-104 Phase B trigger function. Phase A deliberately does not attach it before EH-106 writer cutover.';

create or replace function public.eh104_resolution_verification_preflight()
returns table (
  finding_code text,
  subject_type text,
  subject_id uuid,
  details jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    'invalid_revision_verification_status'::text,
    'normalization_revision'::text,
    revision.id,
    jsonb_build_object('verification_status', revision.verification_status)
  from public.observation_normalization_revisions as revision
  where revision.verification_status is null
    or revision.verification_status not in ('pending', 'auto_verified', 'user_verified', 'manually_corrected')

  union all

  select
    'invalid_extracted_resolver_result'::text,
    'extracted_biomarker'::text,
    extracted.id,
    jsonb_build_object('resolver_result', extracted.resolver_result)
  from public.document_extracted_biomarkers as extracted
  where extracted.resolver_result is not null
    and extracted.resolver_result not in ('resolved', 'partial', 'ambiguous', 'unmapped')

  union all

  select
    'invalid_extracted_verification_status'::text,
    'extracted_biomarker'::text,
    extracted.id,
    jsonb_build_object('verification_status', extracted.verification_status)
  from public.document_extracted_biomarkers as extracted
  where extracted.verification_status is not null
    and extracted.verification_status not in ('pending', 'auto_verified', 'user_verified', 'manually_corrected')

  union all

  select
    'verified_incomplete_revision'::text,
    'normalization_revision'::text,
    revision.id,
    jsonb_build_object(
      'verification_status', revision.verification_status,
      'resolver_result', revision.resolver_result,
      'measurement_definition_key', revision.measurement_definition_key
    )
  from public.observation_normalization_revisions as revision
  where revision.verification_status in ('auto_verified', 'user_verified', 'manually_corrected')
    and (
      revision.resolver_result is distinct from 'resolved'
      or revision.measurement_definition_key is null
    )

  union all

  select
    'half_linked_observation'::text,
    'observation'::text,
    observation.id,
    jsonb_build_object(
      'source_extracted_biomarker_id', observation.source_extracted_biomarker_id,
      'normalization_revision_id', observation.normalization_revision_id
    )
  from public.observations as observation
  where (observation.source_extracted_biomarker_id is null)
      <> (observation.normalization_revision_id is null)

  union all

  select
    'revision_source_mismatch'::text,
    'observation'::text,
    observation.id,
    jsonb_build_object(
      'source_extracted_biomarker_id', observation.source_extracted_biomarker_id,
      'revision_extracted_biomarker_id', revision.extracted_biomarker_id,
      'normalization_revision_id', revision.id
    )
  from public.observations as observation
  join public.observation_normalization_revisions as revision
    on revision.id = observation.normalization_revision_id
  where observation.source_extracted_biomarker_id is distinct from revision.extracted_biomarker_id

  union all

  select
    'observation_source_owner_mismatch'::text,
    'observation'::text,
    observation.id,
    jsonb_build_object(
      'observation_profile_id', observation.profile_id,
      'source_profile_id', extracted.profile_id,
      'observation_document_id', observation.document_id,
      'source_document_id', extracted.document_id
    )
  from public.observations as observation
  join public.observation_normalization_revisions as revision
    on revision.id = observation.normalization_revision_id
  join public.document_extracted_biomarkers as extracted
    on extracted.id = revision.extracted_biomarker_id
  where observation.profile_id is distinct from extracted.profile_id
     or observation.document_id is distinct from extracted.document_id

  union all

  select
    'multiple_active_revisions'::text,
    'extracted_biomarker'::text,
    active_revision.extracted_biomarker_id,
    jsonb_build_object('active_revision_ids', jsonb_agg(active_revision.id order by active_revision.id))
  from public.observation_normalization_revisions as active_revision
  where active_revision.is_active
  group by active_revision.extracted_biomarker_id
  having count(*) > 1

  union all

  select
    'divergent_observation_projection'::text,
    'observation'::text,
    observation.id,
    jsonb_build_object(
      'normalization_revision_id', revision.id,
      'observation_measurement_definition_key', observation.measurement_definition_key,
      'revision_measurement_definition_key', revision.measurement_definition_key,
      'observation_resolution_status', observation.resolution_status,
      'revision_resolver_result', revision.resolver_result
    )
  from public.observations as observation
  join public.observation_normalization_revisions as revision
    on revision.id = observation.normalization_revision_id
   and revision.is_active
  where observation.measurement_definition_key is distinct from revision.measurement_definition_key
    or observation.resolution_status is distinct from revision.resolver_result;

  return query
  select
    'invalid_revision_verification_decision_metadata'::text,
    'normalization_revision'::text,
    revision.id,
    jsonb_build_object(
      'verification_status', revision.verification_status,
      'verification_decided_at', revision.verification_decided_at,
      'verification_actor_type', revision.verification_actor_type,
      'verification_actor_id', revision.verification_actor_id
    )
  from public.observation_normalization_revisions as revision
  where (revision.verification_status = 'pending' and (
      revision.verification_decided_at is not null
      or revision.verification_actor_type is not null
      or revision.verification_actor_id is not null
    ))
    or (revision.verification_status = 'auto_verified' and (
      revision.verification_decided_at is null
      or revision.verification_actor_type is distinct from 'system'
      or revision.verification_actor_id is not null
    ))
    or (revision.verification_status in ('user_verified', 'manually_corrected') and (
      revision.verification_decided_at is null
      or revision.verification_actor_type is distinct from 'user'
      or revision.verification_actor_id is null
    ));

  if to_regclass('public.measurement_resolution_shadow_events') is not null then
    return query execute $shadow$
      select
        'invalid_shadow_resolver_result'::text,
        'shadow_event'::text,
        shadow_event.id,
        jsonb_build_object('resolver_result', shadow_event.resolver_result)
      from public.measurement_resolution_shadow_events as shadow_event
      where shadow_event.resolver_result is not null
        and shadow_event.resolver_result not in ('resolved', 'partial', 'ambiguous', 'unmapped')
    $shadow$;
  end if;
end;
$$;

create or replace function public.promote_observation_normalization_revision_v2(
  p_revision_id uuid,
  p_observation_id uuid,
  p_expected_active_revision_id uuid,
  p_actor_id uuid default null
)
returns public.observation_normalization_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_extracted_biomarker_id uuid;
  extracted public.document_extracted_biomarkers;
  target public.observation_normalization_revisions;
  active_revision public.observation_normalization_revisions;
  observation public.observations;
  affected_observations integer;
begin
  select revision.extracted_biomarker_id
  into target_extracted_biomarker_id
  from public.observation_normalization_revisions as revision
  where revision.id = p_revision_id;

  if target_extracted_biomarker_id is null then
    raise exception using message = 'normalization_revision_not_found';
  end if;

  select *
  into extracted
  from public.document_extracted_biomarkers
  where id = target_extracted_biomarker_id
  for update;

  if extracted.id is null then
    raise exception using message = 'extracted_biomarker_not_found';
  end if;

  select *
  into observation
  from public.observations
  where id = p_observation_id
  for update;

  if observation.id is null then
    raise exception using message = 'observation_not_found';
  end if;

  perform 1
  from public.observation_normalization_revisions as revision
  where revision.extracted_biomarker_id = extracted.id
    and (revision.is_active or revision.id = p_revision_id)
  order by revision.id
  for update;

  select *
  into target
  from public.observation_normalization_revisions
  where id = p_revision_id;

  if target.id is null then
    raise exception using message = 'normalization_revision_not_found';
  end if;

  if target.extracted_biomarker_id is distinct from extracted.id then
    raise exception using message = 'revision_extracted_biomarker_mismatch';
  end if;

  if observation.source_extracted_biomarker_id is distinct from extracted.id then
    raise exception using message = 'observation_source_mismatch';
  end if;

  if observation.profile_id is distinct from extracted.profile_id
    or observation.document_id is distinct from extracted.document_id then
    raise exception using message = 'observation_source_owner_mismatch';
  end if;

  if target.observation_id is not null
    and target.observation_id is distinct from observation.id then
    raise exception using message = 'revision_observation_binding_conflict';
  end if;

  select *
  into active_revision
  from public.observation_normalization_revisions
  where extracted_biomarker_id = extracted.id
    and is_active;

  if target.is_active
    and target.observation_id = observation.id
    and observation.normalization_revision_id = target.id
    and observation.source_extracted_biomarker_id = target.extracted_biomarker_id
    and observation.measurement_definition_key is not distinct from target.measurement_definition_key
    and observation.resolution_status is not distinct from target.resolver_result then
    return target;
  end if;

  if target.is_active then
    raise exception using message = 'active_revision_projection_mismatch';
  end if;

  if active_revision.id is distinct from p_expected_active_revision_id then
    raise exception using message = 'stale_revision_conflict';
  end if;

  update public.observation_normalization_revisions
  set is_active = false
  where extracted_biomarker_id = extracted.id
    and is_active
    and id <> target.id;

  update public.observation_normalization_revisions
  set is_active = true,
      observation_id = observation.id,
      promoted_at = now(),
      promoted_by = p_actor_id
  where id = target.id
  returning * into target;

  update public.observations
  set measurement_definition_key = target.measurement_definition_key,
      normalization_revision_id = target.id,
      resolution_status = target.resolver_result
  where id = observation.id;

  get diagnostics affected_observations = row_count;
  if affected_observations <> 1 then
    raise exception using message = 'observation_projection_update_failed';
  end if;

  return target;
end;
$$;

revoke all on function public.promote_observation_normalization_revision(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.promote_observation_normalization_revision(uuid, uuid, uuid)
  to service_role;

revoke all on function public.promote_observation_normalization_revision_v2(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.promote_observation_normalization_revision_v2(uuid, uuid, uuid, uuid)
  to service_role;

revoke all on function public.eh104_resolution_verification_preflight()
  from public, anon, authenticated;
grant execute on function public.eh104_resolution_verification_preflight()
  to service_role;
