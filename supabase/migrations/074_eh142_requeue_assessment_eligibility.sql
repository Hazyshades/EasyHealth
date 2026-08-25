-- EH-142: recalculate durable Health Profile assessments under strict input eligibility.
with affected_profiles as (
  select distinct profile_id
  from public.observations
  where observation_kind = 'lab'
)
insert into public.assessment_recalculation_jobs (
  profile_id,
  output_kind,
  status,
  attempts,
  queued_at,
  started_at,
  lease_expires_at,
  last_error_code,
  last_error_message,
  completed_at
)
select
  profile_id,
  'health_profile',
  'queued'::public.assessment_recalculation_status,
  0,
  now(),
  null,
  null,
  null,
  null,
  null
from affected_profiles
on conflict (profile_id, output_kind) do update
set
  status = 'queued'::public.assessment_recalculation_status,
  attempts = 0,
  queued_at = excluded.queued_at,
  started_at = null,
  lease_expires_at = null,
  last_error_code = null,
  last_error_message = null,
  completed_at = null,
  updated_at = now()
where public.assessment_recalculation_jobs.status <> 'processing'::public.assessment_recalculation_status;

insert into public.profile_health_synthesis_state (
  profile_id,
  stale,
  invalidated_at
)
select
  profile_id,
  true,
  now()
from (
  select distinct profile_id
  from public.observations
  where observation_kind = 'lab'
) as affected_profiles
on conflict (profile_id) do update
set
  stale = true,
  invalidated_at = excluded.invalidated_at,
  updated_at = now();
