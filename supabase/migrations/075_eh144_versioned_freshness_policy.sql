-- EH-144: version the technical freshness policy used by Health Profile assessments.
-- Source medical dates remain immutable; this only stamps assessment provenance.

alter table public.health_profile_assessment_versions
  add column if not exists freshness_policy_version text not null default 'eh-144.v1';

alter table public.health_profile_assessment_versions
  drop constraint if exists health_profile_assessment_versions_freshness_policy_version_check;

alter table public.health_profile_assessment_versions
  add constraint health_profile_assessment_versions_freshness_policy_version_check
  check (freshness_policy_version ~ '^eh-144[.]v[0-9]+$');

drop function if exists public.complete_assessment_recalculation_job(uuid, text, jsonb, uuid[]);

create or replace function public.complete_assessment_recalculation_job(
  p_job_id uuid,
  p_input_hash text,
  p_payload jsonb,
  p_source_document_ids uuid[],
  p_freshness_policy_version text default 'eh-144.v1'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  job public.assessment_recalculation_jobs%rowtype;
  version_id uuid;
begin
  select * into job
  from public.assessment_recalculation_jobs
  where id = p_job_id
  for update;

  if not found or job.status <> 'processing' or job.lease_expires_at < now() then
    raise exception using message = 'assessment_job_not_claimed';
  end if;

  if p_input_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_payload) <> 'object'
     or p_freshness_policy_version !~ '^eh-144[.]v[0-9]+$'
     or (
       p_payload ? 'freshness_policy_version'
       and p_payload ->> 'freshness_policy_version' <> p_freshness_policy_version
     ) then
    raise exception using message = 'invalid_assessment_snapshot';
  end if;

  insert into public.health_profile_assessment_versions (
    profile_id,
    input_hash,
    payload,
    source_document_ids,
    freshness_policy_version
  )
  values (
    job.profile_id,
    p_input_hash,
    p_payload,
    coalesce(p_source_document_ids, '{}'),
    p_freshness_policy_version
  )
  on conflict (profile_id, input_hash) do nothing
  returning id into version_id;

  if version_id is null then
    select id into version_id
    from public.health_profile_assessment_versions
    where profile_id = job.profile_id and input_hash = p_input_hash;
  end if;

  insert into public.health_profile_assessment_event_receipts (dependency_event_id, assessment_version_id)
  select event.id, version_id
  from public.assessment_dependency_events event
  left join public.health_profile_assessment_event_receipts receipt
    on receipt.dependency_event_id = event.id
  where event.profile_id = job.profile_id
    and receipt.dependency_event_id is null
    and event.created_at <= job.started_at
  on conflict do nothing;

  update public.assessment_recalculation_jobs
  set status = case
        when exists (
          select 1
          from public.assessment_dependency_events event
          left join public.health_profile_assessment_event_receipts receipt
            on receipt.dependency_event_id = event.id
          where event.profile_id = job.profile_id
            and receipt.dependency_event_id is null
        ) then 'queued'::public.assessment_recalculation_status
        else 'succeeded'::public.assessment_recalculation_status
      end,
      completed_at = now(),
      lease_expires_at = null,
      updated_at = now()
  where id = job.id;

  return version_id;
end;
$$;

grant execute on function public.complete_assessment_recalculation_job(uuid, text, jsonb, uuid[], text)
  to service_role;

notify pgrst, 'reload schema';
