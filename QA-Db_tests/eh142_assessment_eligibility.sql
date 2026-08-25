begin;

select plan(8);

insert into public.profiles (id) values
  ('00000000-0000-4000-8000-000000001421'),
  ('00000000-0000-4000-8000-000000001422'),
  ('00000000-0000-4000-8000-000000001423');

insert into public.observations (
  id,
  profile_id,
  name,
  value,
  unit,
  observed_at,
  observation_kind,
  value_kind
) values
  (
    '00000000-0000-4000-8000-000000001424',
    '00000000-0000-4000-8000-000000001421',
    'EH-142 queued fixture',
    1,
    'unit',
    '2026-08-23',
    'lab',
    'numeric'
  ),
  (
    '00000000-0000-4000-8000-000000001425',
    '00000000-0000-4000-8000-000000001422',
    'EH-142 processing fixture',
    1,
    'unit',
    '2026-08-23',
    'lab',
    'numeric'
  );

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
) values
  (
    '00000000-0000-4000-8000-000000001421',
    'health_profile',
    'failed',
    3,
    '2026-08-20T00:00:00Z',
    null,
    null,
    'old_failure',
    'Old failure',
    '2026-08-20T00:01:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000001422',
    'health_profile',
    'processing',
    2,
    '2026-08-19T00:00:00Z',
    '2026-08-19T00:01:00Z',
    '2099-01-01T00:00:00Z',
    null,
    null,
    null
  )
on conflict (profile_id, output_kind) do update
set
  status = excluded.status,
  attempts = excluded.attempts,
  queued_at = excluded.queued_at,
  started_at = excluded.started_at,
  lease_expires_at = excluded.lease_expires_at,
  last_error_code = excluded.last_error_code,
  last_error_message = excluded.last_error_message,
  completed_at = excluded.completed_at;

insert into public.profile_health_synthesis_state (profile_id, stale, invalidated_at) values
  ('00000000-0000-4000-8000-000000001421', false, null),
  ('00000000-0000-4000-8000-000000001422', false, null)
on conflict (profile_id) do update
set stale = excluded.stale, invalidated_at = excluded.invalidated_at;

insert into public.health_profile_assessment_versions (
  profile_id,
  input_hash,
  payload,
  source_document_ids
) values (
  '00000000-0000-4000-8000-000000001421',
  repeat('a', 64),
  '{"records_used_count":1}'::jsonb,
  '{}'
);
-- The local test database runs all migrations before this fixture is loaded.
-- Re-run the migration's idempotent data projection here so the contract
-- assertions exercise the EH-142 policy against the synthetic rows below.
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


select is(
  (
    select status::text || ':' || attempts::text
    from public.assessment_recalculation_jobs
    where profile_id = '00000000-0000-4000-8000-000000001421'
  ),
  'queued:0',
  'EH-142 requeues a failed laboratory profile and resets its retry budget'
);
select is(
  (
    select coalesce(last_error_code, '') || ':' || coalesce(last_error_message, '') || ':' || coalesce(completed_at::text, '')
    from public.assessment_recalculation_jobs
    where profile_id = '00000000-0000-4000-8000-000000001421'
  ),
  '::',
  'EH-142 clears stale job failure state before recalculation'
);
select ok(
  (select stale from public.profile_health_synthesis_state where profile_id = '00000000-0000-4000-8000-000000001421'),
  'EH-142 marks the requeued profile synthesis stale'
);
select is(
  (
    select count(*)::int
    from public.health_profile_assessment_versions
    where profile_id = '00000000-0000-4000-8000-000000001421'
  ),
  1,
  'EH-142 does not rewrite immutable assessment history'
);
select is(
  (
    select status::text || ':' || attempts::text
    from public.assessment_recalculation_jobs
    where profile_id = '00000000-0000-4000-8000-000000001422'
  ),
  'processing:2',
  'EH-142 preserves an in-flight assessment job'
);
select is(
  (
    select queued_at
    from public.assessment_recalculation_jobs
    where profile_id = '00000000-0000-4000-8000-000000001422'
  ),
  '2026-08-19T00:00:00Z'::timestamptz,
  'EH-142 leaves the in-flight job schedule unchanged'
);
select ok(
  (select stale from public.profile_health_synthesis_state where profile_id = '00000000-0000-4000-8000-000000001422'),
  'EH-142 marks an in-flight profile synthesis stale'
);
select is(
  (
    select count(*)::int
    from public.assessment_recalculation_jobs
    where profile_id = '00000000-0000-4000-8000-000000001423'
  ),
  0,
  'EH-142 does not create assessment work for a profile without laboratory observations'
);

select * from finish();
rollback;
