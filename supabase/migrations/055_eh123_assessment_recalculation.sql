-- EH-123: durable invalidation and versioned Health Profile recalculation.

create type public.assessment_recalculation_status as enum (
  'queued', 'processing', 'retryable_failed', 'failed', 'succeeded'
);

create table public.assessment_dependency_events (
  id uuid primary key default gen_random_uuid(),
  source_change_event_id uuid not null unique references public.observation_change_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  event_kind public.observation_change_event_kind not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.assessment_recalculation_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  output_kind text not null check (output_kind = 'health_profile'),
  status public.assessment_recalculation_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  lease_expires_at timestamptz,
  last_error_code text,
  last_error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, output_kind)
);

create table public.health_profile_assessment_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  source_document_ids uuid[] not null default '{}',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (profile_id, input_hash)
);

create table public.health_profile_assessment_event_receipts (
  dependency_event_id uuid primary key references public.assessment_dependency_events(id) on delete cascade,
  assessment_version_id uuid not null references public.health_profile_assessment_versions(id) on delete restrict,
  consumed_at timestamptz not null default now()
);

alter table public.profile_health_synthesis drop constraint if exists profile_health_synthesis_pkey;
alter table public.profile_health_synthesis add column if not exists id uuid default gen_random_uuid();
alter table public.profile_health_synthesis add primary key (id);
alter table public.profile_health_synthesis add constraint profile_health_synthesis_profile_input_unique unique (profile_id, input_hash);

create table public.profile_health_synthesis_state (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  current_synthesis_id uuid references public.profile_health_synthesis(id) on delete set null,
  stale boolean not null default false,
  invalidated_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.profile_health_synthesis_state (profile_id, current_synthesis_id, stale)
select profile_id, id, false from public.profile_health_synthesis
on conflict (profile_id) do nothing;

create or replace function public.eh123_reject_append_only_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'update' then raise exception using message = 'eh123_append_only'; end if;
  if not exists (select 1 from public.profiles where id = old.profile_id) then return old; end if;
  raise exception using message = 'eh123_append_only';
end;
$$;

create trigger assessment_dependency_events_append_only before update or delete on public.assessment_dependency_events
for each row execute function public.eh123_reject_append_only_mutation();
create trigger health_profile_assessment_versions_append_only before update or delete on public.health_profile_assessment_versions
for each row execute function public.eh123_reject_append_only_mutation();

create or replace function public.eh123_capture_assessment_dependency()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origin <> 'capture' then return null; end if;
  insert into public.assessment_dependency_events (source_change_event_id, profile_id, document_id, event_kind, occurred_at)
  values (new.id, new.profile_id, new.document_id, new.event_kind, new.occurred_at)
  on conflict (source_change_event_id) do nothing;
  insert into public.assessment_recalculation_jobs (profile_id, output_kind, status, queued_at)
  values (new.profile_id, 'health_profile', 'queued', now())
  on conflict (profile_id, output_kind) do update
    set status = case when assessment_recalculation_jobs.status = 'processing' then 'processing'::public.assessment_recalculation_status else 'queued'::public.assessment_recalculation_status end,
        queued_at = now(), updated_at = now();
  insert into public.profile_health_synthesis_state (profile_id, stale, invalidated_at)
  values (new.profile_id, true, now())
  on conflict (profile_id) do update set stale = true, invalidated_at = excluded.invalidated_at, updated_at = now();
  return null;
end;
$$;
create trigger eh123_capture_assessment_dependency after insert on public.observation_change_events
for each row execute function public.eh123_capture_assessment_dependency();

insert into public.assessment_recalculation_jobs (profile_id, output_kind)
select distinct profile_id, 'health_profile' from public.observations where observation_kind = 'lab'
on conflict (profile_id, output_kind) do nothing;

create or replace function public.claim_assessment_recalculation_job()
returns table (job_id uuid, profile_id uuid, attempts integer, max_attempts integer, started_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare job public.assessment_recalculation_jobs%rowtype;
begin
  select * into job from public.assessment_recalculation_jobs
  where status in ('queued', 'retryable_failed') order by queued_at, created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.assessment_recalculation_jobs set status = 'processing', attempts = attempts + 1,
    started_at = now(), lease_expires_at = now() + interval '5 minutes', last_error_code = null,
    last_error_message = null, updated_at = now() where id = job.id
  returning id, assessment_recalculation_jobs.profile_id, assessment_recalculation_jobs.attempts,
    assessment_recalculation_jobs.max_attempts, assessment_recalculation_jobs.started_at
  into job_id, profile_id, attempts, max_attempts, started_at;
  return next;
end;
$$;

create or replace function public.complete_assessment_recalculation_job(p_job_id uuid, p_input_hash text, p_payload jsonb, p_source_document_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare job public.assessment_recalculation_jobs%rowtype; version_id uuid;
begin
  select * into job from public.assessment_recalculation_jobs where id = p_job_id for update;
  if not found or job.status <> 'processing' or job.lease_expires_at < now() then raise exception using message = 'assessment_job_not_claimed'; end if;
  if p_input_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_payload) <> 'object' then raise exception using message = 'invalid_assessment_snapshot'; end if;
  insert into public.health_profile_assessment_versions (profile_id, input_hash, payload, source_document_ids)
  values (job.profile_id, p_input_hash, p_payload, coalesce(p_source_document_ids, '{}'))
  on conflict (profile_id, input_hash) do nothing returning id into version_id;
  if version_id is null then select id into version_id from public.health_profile_assessment_versions where profile_id = job.profile_id and input_hash = p_input_hash; end if;
  insert into public.health_profile_assessment_event_receipts (dependency_event_id, assessment_version_id)
  select event.id, version_id from public.assessment_dependency_events event
  left join public.health_profile_assessment_event_receipts receipt on receipt.dependency_event_id = event.id
  where event.profile_id = job.profile_id and receipt.dependency_event_id is null and event.created_at <= job.started_at
  on conflict do nothing;
  update public.assessment_recalculation_jobs set status = case when exists (
    select 1 from public.assessment_dependency_events event left join public.health_profile_assessment_event_receipts receipt on receipt.dependency_event_id = event.id
    where event.profile_id = job.profile_id and receipt.dependency_event_id is null
  ) then 'queued'::public.assessment_recalculation_status else 'succeeded'::public.assessment_recalculation_status end, completed_at = now(), lease_expires_at = null, updated_at = now() where id = job.id;
  return version_id;
end;
$$;

create or replace function public.fail_assessment_recalculation_job(p_job_id uuid, p_error_code text, p_error_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.assessment_recalculation_jobs set status = case when attempts >= max_attempts then 'failed'::public.assessment_recalculation_status else 'retryable_failed'::public.assessment_recalculation_status end,
    lease_expires_at = null, last_error_code = left(coalesce(p_error_code, 'assessment_recalculation_failed'), 80),
    last_error_message = left(coalesce(p_error_message, 'Assessment recalculation failed'), 500), updated_at = now()
  where id = p_job_id and status = 'processing';
end;
$$;

create or replace function public.reclaim_stale_assessment_recalculation_jobs()
returns integer language plpgsql security definer set search_path = public as $$
declare count_reclaimed integer;
begin
  with reclaimed as (
    update public.assessment_recalculation_jobs set status = case when attempts >= max_attempts then 'failed'::public.assessment_recalculation_status else 'retryable_failed'::public.assessment_recalculation_status end,
      lease_expires_at = null, last_error_code = 'assessment_job_lease_expired', last_error_message = 'Assessment recalculation timed out', updated_at = now()
    where status = 'processing' and lease_expires_at < now() returning 1
  ) select count(*) into count_reclaimed from reclaimed;
  return count_reclaimed;
end;
$$;

create or replace function public.retry_assessment_recalculation_job(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.assessment_recalculation_jobs set status = 'queued', attempts = 0, queued_at = now(), lease_expires_at = null,
    last_error_code = null, last_error_message = null, updated_at = now()
  where profile_id = p_profile_id and output_kind = 'health_profile' and status in ('failed', 'retryable_failed');
end;
$$;

alter table public.assessment_dependency_events enable row level security;
alter table public.assessment_recalculation_jobs enable row level security;
alter table public.health_profile_assessment_versions enable row level security;
alter table public.health_profile_assessment_event_receipts enable row level security;
alter table public.profile_health_synthesis_state enable row level security;

revoke all on public.assessment_dependency_events, public.assessment_recalculation_jobs, public.health_profile_assessment_versions, public.health_profile_assessment_event_receipts, public.profile_health_synthesis_state from public, anon, authenticated;
grant select, insert on public.assessment_dependency_events, public.health_profile_assessment_versions, public.health_profile_assessment_event_receipts to service_role;
grant select, insert, update on public.assessment_recalculation_jobs, public.profile_health_synthesis_state to service_role;
grant execute on function public.claim_assessment_recalculation_job(), public.complete_assessment_recalculation_job(uuid, text, jsonb, uuid[]), public.fail_assessment_recalculation_job(uuid, text, text), public.reclaim_stale_assessment_recalculation_jobs(), public.retry_assessment_recalculation_job(uuid) to service_role;

notify pgrst, 'reload schema';