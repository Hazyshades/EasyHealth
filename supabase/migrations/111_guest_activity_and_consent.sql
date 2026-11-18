-- Record meaningful guest product mutations without extending retention on reads.
-- Recheck the consent version inside the conversion transaction.

alter table public.profiles
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_version text;

alter table public.assistant_reindex_jobs
  add column if not exists execution_started_at timestamptz;

-- Privacy consent is intentionally not inferred from the existing Terms fields.
-- Missing privacy evidence remains null and forces an explicit re-consent.
create table if not exists public.guest_upload_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_day date not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  status text not null default 'reserved' check (
    status in ('reserved', 'consumed', 'released')
  ),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  document_id uuid,
  intent_id uuid
);

create index if not exists guest_upload_quota_reservations_profile_idx
  on public.guest_upload_quota_reservations (profile_id, usage_day, status);

create index if not exists guest_upload_quota_reservations_pending_idx
  on public.guest_upload_quota_reservations (created_at)
  where status = 'reserved';

alter table public.guest_upload_quota_reservations enable row level security;
revoke all on public.guest_upload_quota_reservations from public, anon, authenticated;
grant select, insert, update, delete on public.guest_upload_quota_reservations to service_role;

create or replace function public.reject_guest_profile_writes_after_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_guest_deletion_state text;
  v_guest_expires_at timestamptz;
  v_profile_id uuid;
begin
  if current_setting('eh104.deletion_purge', true) = 'on'
    or current_setting('eh104.tombstone', true) = 'on'
    or current_setting('easyhealth.purge_lineage', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_profile_id := case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;
  if v_profile_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select account_type, guest_deletion_state, guest_expires_at
  into v_account_type, v_guest_deletion_state, v_guest_expires_at
  from public.profiles
  where id = v_profile_id
  for share;

  if not found then
    raise exception using message = 'profile_not_found';
  end if;
  if v_account_type = 'guest' and v_guest_deletion_state <> 'active' then
    raise exception using message = 'guest_profile_deletion_requested';
  end if;
  if v_account_type = 'guest'
    and (
      v_guest_expires_at is null
      or v_guest_expires_at <= clock_timestamp()
    ) then
    raise exception using message = 'guest_profile_expired';
  end if;

  perform public.touch_guest_profile_activity(v_profile_id, clock_timestamp());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.reject_guest_profile_writes_after_deletion()
  from public, anon, authenticated;

DO $$
declare
  v_table text;
  v_excluded text[] := array[
    'assessment_recalculation_jobs',
    'assistant_reindex_jobs',
    'document_deletion_operations',
    'document_processing_attempts',
    'document_processing_jobs',
    'document_storage_upload_tickets',
    'document_storage_write_intents',
    'guest_profile_deletion_operations',
    'guest_resource_usage',
    'guest_upload_quota_reservations',
    'registry_reprocess_batch_rows'
  ];
begin
  for v_table in
    select distinct c.table_name
    from information_schema.columns as c
    join information_schema.tables as t
      on t.table_schema = c.table_schema
      and t.table_name = c.table_name
      and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name = 'profile_id'
      and c.table_name <> all(v_excluded)
  loop
    execute format(
      'drop trigger if exists guest_profile_write_fence on public.%I',
      v_table
    );
    execute format(
      'create trigger guest_profile_write_fence
       before insert or update or delete on public.%I
       for each row
       execute function public.reject_guest_profile_writes_after_deletion()',
      v_table
    );
  end loop;
end;
$$;
create or replace function public.fence_guest_assessment_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_guest_deletion_state text;
  v_guest_expires_at timestamptz;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'INSERT' then
    select account_type, guest_deletion_state, guest_expires_at
    into v_account_type, v_guest_deletion_state, v_guest_expires_at
    from public.profiles
    where id = new.profile_id
    for share;
  else
    select account_type, guest_deletion_state, guest_expires_at
    into v_account_type, v_guest_deletion_state, v_guest_expires_at
    from public.profiles
    where id = new.profile_id;
  end if;

  if v_account_type = 'guest'
    and (
      v_guest_deletion_state is distinct from 'active'
      or v_guest_expires_at is null
      or v_guest_expires_at <= clock_timestamp()
    ) then
    new.status := 'failed'::public.assessment_recalculation_status;
    new.lease_expires_at := null;
    new.completed_at := null;
    new.last_error_code := case
      when v_guest_deletion_state is distinct from 'active'
        then 'guest_profile_deletion_requested'
      else 'guest_profile_expired'
    end;
    new.last_error_message := case
      when v_guest_deletion_state is distinct from 'active'
        then 'Guest profile deletion requested'
      else 'Guest profile expired'
    end;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.fence_guest_assessment_jobs()
  from public, anon, authenticated;
drop trigger if exists guest_assessment_job_fence
  on public.assessment_recalculation_jobs;
create trigger guest_assessment_job_fence
before insert or update on public.assessment_recalculation_jobs
for each row
execute function public.fence_guest_assessment_jobs();

update public.assessment_recalculation_jobs as job
set status = 'failed'::public.assessment_recalculation_status,
    lease_expires_at = null,
    completed_at = null,
    last_error_code = case
      when profile.guest_deletion_state is distinct from 'active'
        then 'guest_profile_deletion_requested'
      else 'guest_profile_expired'
    end,
    last_error_message = case
      when profile.guest_deletion_state is distinct from 'active'
        then 'Guest profile deletion requested'
      else 'Guest profile expired'
    end,
    updated_at = now()
from public.profiles as profile
where profile.id = job.profile_id
  and profile.account_type = 'guest'
  and (
    profile.guest_deletion_state is distinct from 'active'
    or profile.guest_expires_at is null
    or profile.guest_expires_at <= clock_timestamp()
  )
  and job.status <> 'failed'::public.assessment_recalculation_status;
update public.assistant_reindex_jobs as job
set status = 'stale',
    finished_at = now(),
    execution_started_at = null,
    error_code = case
      when profile.guest_deletion_state is distinct from 'active'
        then 'guest_profile_deletion_requested'
      else 'guest_profile_expired'
    end,
    updated_at = now()
from public.profiles as profile
where profile.id = job.profile_id
  and profile.account_type = 'guest'
  and (
    profile.guest_deletion_state is distinct from 'active'
    or profile.guest_expires_at is null
    or profile.guest_expires_at <= clock_timestamp()
  )
  and job.status in ('queued', 'processing')
  and (
    job.execution_started_at is null
    or job.execution_started_at < now() - interval '10 minutes'
  );

create or replace function public.claim_assistant_reindex_job()
returns table (
  id uuid,
  profile_id uuid,
  document_id uuid,
  requested_content_sha256 text,
  requested_write_generation bigint
)
language sql
security definer
set search_path = public
as $$
  with next_job as (
    select job.id
    from public.assistant_reindex_jobs as job
    join public.profiles as profile
      on profile.id = job.profile_id
    where job.status = 'queued'
      and job.attempts < job.max_attempts
      and not (
        profile.account_type = 'guest'
        and (
          profile.guest_deletion_state is distinct from 'active'
          or profile.guest_expires_at is null
          or profile.guest_expires_at <= clock_timestamp()
        )
      )
    order by job.created_at, job.id
    for update of job skip locked
    limit 1
  )
  update public.assistant_reindex_jobs as job
  set status = 'processing',
      attempts = job.attempts + 1,
      claimed_at = now(),
      updated_at = now()
  from next_job
  where job.id = next_job.id
  returning
    job.id,
    job.profile_id,
    job.document_id,
    job.requested_content_sha256,
    job.requested_write_generation;
$$;

revoke all on function public.claim_assistant_reindex_job()
  from public, anon, authenticated;
grant execute on function public.claim_assistant_reindex_job()
  to service_role;
create or replace function public.begin_assistant_reindex_execution(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_account_type text;
  v_guest_deletion_state text;
  v_guest_expires_at timestamptz;
  v_status text;
  v_execution_started_at timestamptz;
begin
  select profile_id
  into v_profile_id
  from public.assistant_reindex_jobs
  where id = p_job_id;
  if not found then
    return false;
  end if;

  select account_type, guest_deletion_state, guest_expires_at
  into v_account_type, v_guest_deletion_state, v_guest_expires_at
  from public.profiles
  where id = v_profile_id
  for update;
  if not found
    or (
      v_account_type = 'guest'
      and (
        v_guest_deletion_state is distinct from 'active'
        or v_guest_expires_at is null
        or v_guest_expires_at <= clock_timestamp()
      )
    ) then
    return false;
  end if;

  select status, execution_started_at
  into v_status, v_execution_started_at
  from public.assistant_reindex_jobs
  where id = p_job_id
  for update;
  if not found
    or v_status <> 'processing'
    or v_execution_started_at is not null then
    return false;
  end if;

  update public.assistant_reindex_jobs
  set execution_started_at = clock_timestamp(),
      updated_at = now()
  where id = p_job_id;
  return true;
end;
$$;

create or replace function public.renew_assistant_reindex_execution(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_account_type text;
  v_guest_deletion_state text;
  v_guest_expires_at timestamptz;
  v_status text;
  v_execution_started_at timestamptz;
begin
  select profile_id
  into v_profile_id
  from public.assistant_reindex_jobs
  where id = p_job_id;
  if not found then
    return false;
  end if;

  select account_type, guest_deletion_state, guest_expires_at
  into v_account_type, v_guest_deletion_state, v_guest_expires_at
  from public.profiles
  where id = v_profile_id
  for update;
  if not found
    or (
      v_account_type = 'guest'
      and (
        v_guest_deletion_state is distinct from 'active'
        or v_guest_expires_at is null
        or v_guest_expires_at <= clock_timestamp()
      )
    ) then
    return false;
  end if;

  select status, execution_started_at
  into v_status, v_execution_started_at
  from public.assistant_reindex_jobs
  where id = p_job_id
  for update;
  if not found
    or v_status <> 'processing'
    or v_execution_started_at is null then
    return false;
  end if;

  update public.assistant_reindex_jobs
  set execution_started_at = clock_timestamp(),
      updated_at = now()
  where id = p_job_id;
  return true;
end;
$$;

create or replace function public.finish_assistant_reindex_execution(p_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.assistant_reindex_jobs
  set execution_started_at = null,
      updated_at = now()
  where id = p_job_id;
$$;

revoke all on function public.begin_assistant_reindex_execution(uuid)
  from public, anon, authenticated;
revoke all on function public.renew_assistant_reindex_execution(uuid)
  from public, anon, authenticated;
revoke all on function public.finish_assistant_reindex_execution(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_assistant_reindex_execution(uuid)
  to service_role;
grant execute on function public.renew_assistant_reindex_execution(uuid)
  to service_role;
grant execute on function public.finish_assistant_reindex_execution(uuid)
  to service_role;
create or replace function public.mark_assistant_reindex_job_stale(p_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.assistant_reindex_jobs
  set status = 'stale',
      finished_at = now(),
      execution_started_at = null,
      updated_at = now(),
      error_code = 'assistant_reindex_source_stale'
  where id = p_job_id
    and status = 'processing';
$$;

create or replace function public.fail_assistant_reindex_job(
  p_job_id uuid,
  p_error_code text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.assistant_reindex_jobs
  set status = case
        when attempts >= max_attempts then 'failed' else 'queued'
      end,
      finished_at = case
        when attempts >= max_attempts then now() else null
      end,
      execution_started_at = null,
      updated_at = now(),
      error_code = case
        when p_error_code in (
          'assistant_reindex_source_unavailable',
          'assistant_reindex_source_stale',
          'assistant_embedding_provider_unavailable',
          'assistant_embedding_count_mismatch'
        ) then p_error_code
        else 'assistant_reindex_failed'
      end
  where id = p_job_id
    and status = 'processing';
$$;

revoke all on function public.mark_assistant_reindex_job_stale(uuid)
  from public, anon, authenticated;
revoke all on function public.fail_assistant_reindex_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_assistant_reindex_job_stale(uuid)
  to service_role;
grant execute on function public.fail_assistant_reindex_job(uuid, text)
  to service_role;

create or replace function public.complete_assistant_reindex_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_profile public.profiles%rowtype;
begin
  select profile_id
  into v_profile_id
  from public.assistant_reindex_jobs
  where id = p_job_id;
  if not found then
    return;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_profile_id
  for update;
  if not found then
    return;
  end if;
  if v_profile.account_type = 'guest'
    and (
      v_profile.guest_deletion_state is distinct from 'active'
      or v_profile.guest_expires_at is null
      or v_profile.guest_expires_at <= clock_timestamp()
    ) then
    return;
  end if;

  update public.assistant_reindex_jobs
  set status = 'completed',
      finished_at = now(),
      execution_started_at = null,
      error_code = null,
      updated_at = now()
  where id = p_job_id
    and status = 'processing';
end;
$$;

revoke all on function public.complete_assistant_reindex_job(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_assistant_reindex_job(uuid)
  to service_role;

create or replace function public.reconcile_assistant_reindex_jobs(
  p_before timestamptz default now() - interval '10 minutes',
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reconciled integer := 0;
  v_cutoff timestamptz := coalesce(p_before, now() - interval '10 minutes');
  v_candidate record;
  v_job public.assistant_reindex_jobs%rowtype;
  v_profile public.profiles%rowtype;
begin
  if coalesce(p_limit, 0) < 1 then
    raise exception using message = 'invalid_assistant_reindex_reconciliation_limit';
  end if;

  for v_candidate in
    select id, profile_id
    from public.assistant_reindex_jobs
    where status = 'processing'
      and claimed_at is not null
      and claimed_at < v_cutoff
      and (
        execution_started_at is null
        or execution_started_at < v_cutoff
      )
    order by claimed_at, id
    limit p_limit
  loop
    select *
    into v_profile
    from public.profiles
    where id = v_candidate.profile_id
    for update;
    if not found then
      continue;
    end if;

    select *
    into v_job
    from public.assistant_reindex_jobs
    where id = v_candidate.id
      and status = 'processing'
      and claimed_at is not null
      and claimed_at < v_cutoff
      and (
        execution_started_at is null
        or execution_started_at < v_cutoff
      )
    for update;
    if not found then
      continue;
    end if;

    update public.assistant_reindex_jobs
    set status = case
          when v_job.attempts >= v_job.max_attempts then 'failed'
          else 'stale'
        end,
        finished_at = now(),
        execution_started_at = null,
        updated_at = now(),
        error_code = 'assistant_reindex_lease_expired'
    where id = v_job.id;

    if v_job.attempts < v_job.max_attempts
      and (
        v_profile.account_type <> 'guest'
        or (
          v_profile.guest_deletion_state = 'active'
          and v_profile.guest_expires_at is not null
          and v_profile.guest_expires_at > clock_timestamp()
        )
      ) then
      insert into public.assistant_reindex_jobs (
        profile_id,
        document_id,
        requested_content_sha256,
        requested_write_generation,
        status,
        attempts,
        max_attempts,
        error_code
      )
      values (
        v_job.profile_id,
        v_job.document_id,
        v_job.requested_content_sha256,
        v_job.requested_write_generation,
        'queued',
        v_job.attempts,
        v_job.max_attempts,
        'assistant_reindex_lease_expired'
      );
    end if;

    v_reconciled := v_reconciled + 1;
  end loop;

  return v_reconciled;
end;
$$;

revoke all on function public.reconcile_assistant_reindex_jobs(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_assistant_reindex_jobs(timestamptz, integer)
  to service_role;





create or replace function public.guard_guest_assistant_reindex_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type = 'guest'
    and old.guest_deletion_state is distinct from 'deleting'
    and new.guest_deletion_state = 'deleting' then
    update public.assistant_reindex_jobs
    set status = 'stale',
        finished_at = now(),
        execution_started_at = null,
        error_code = 'guest_profile_deletion_requested',
        updated_at = now()
    where profile_id = new.id
      and status in ('queued', 'processing')
      and (
        execution_started_at is null
        or execution_started_at < now() - interval '10 minutes'
      );

    if exists (
      select 1
      from public.assistant_reindex_jobs
      where profile_id = new.id
        and status = 'processing'
        and execution_started_at is not null
    ) then
      raise exception using message = 'guest_reindex_in_flight';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_guest_assistant_reindex_deletion()
  from public, anon, authenticated;
drop trigger if exists guest_assistant_reindex_deletion_guard
  on public.profiles;
create trigger guest_assistant_reindex_deletion_guard
before update of guest_deletion_state on public.profiles
for each row
execute function public.guard_guest_assistant_reindex_deletion();

drop trigger if exists guest_assistant_reindex_insert_fence
  on public.assistant_reindex_jobs;
create trigger guest_assistant_reindex_insert_fence
before insert on public.assistant_reindex_jobs
for each row
execute function public.reject_guest_profile_writes_after_deletion();


drop trigger if exists guest_assessment_recalculation_cancel
  on public.profiles;
drop function if exists public.cancel_guest_background_jobs_after_deletion();

create or replace function public.cancel_guest_assessment_jobs_for_deletion(
  p_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled integer;
begin
  update public.assessment_recalculation_jobs
  set status = 'failed'::public.assessment_recalculation_status,
      lease_expires_at = null,
      completed_at = null,
      last_error_code = 'guest_profile_deletion_requested',
      last_error_message = 'Guest profile deletion requested',
      updated_at = now()
  where profile_id = p_profile_id
    and status in (
      'queued'::public.assessment_recalculation_status,
      'processing'::public.assessment_recalculation_status,
      'retryable_failed'::public.assessment_recalculation_status
    );
  get diagnostics v_cancelled = row_count;
  return v_cancelled;
end;
$$;

revoke all on function public.cancel_guest_assessment_jobs_for_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_guest_assessment_jobs_for_deletion(uuid)
  to service_role;

create or replace function public.cancel_guest_assessment_jobs_after_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.guest_deletion_state is distinct from 'deleting'
    and new.guest_deletion_state = 'deleting' then
    perform public.cancel_guest_assessment_jobs_for_deletion(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.cancel_guest_assessment_jobs_after_deletion()
  from public, anon, authenticated;
drop trigger if exists guest_assessment_recalculation_cancel
  on public.profiles;
create trigger guest_assessment_recalculation_cancel
before update of guest_deletion_state on public.profiles
for each row
execute function public.cancel_guest_assessment_jobs_after_deletion();

create or replace function public.complete_assessment_recalculation_job(
  p_job_id uuid,
  p_input_hash text,
  p_payload jsonb,
  p_source_document_ids uuid[],
  p_freshness_policy_version text default 'eh-144.v1'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_profile public.profiles%rowtype;
  job public.assessment_recalculation_jobs%rowtype;
  version_id uuid;
begin
  select profile_id
  into v_profile_id
  from public.assessment_recalculation_jobs
  where id = p_job_id;

  if not found then
    raise exception using message = 'assessment_job_not_claimed';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_profile_id
  for update;

  if not found then
    raise exception using message = 'assessment_job_not_claimed';
  end if;

  select *
  into job
  from public.assessment_recalculation_jobs
  where id = p_job_id
  for update;

  if not found or job.status <> 'processing' or job.lease_expires_at < now() then
    raise exception using message = 'assessment_job_not_claimed';
  end if;

  if v_profile.account_type = 'guest'
    and (
      v_profile.guest_deletion_state is distinct from 'active'
      or v_profile.guest_expires_at is null
      or v_profile.guest_expires_at <= clock_timestamp()
    ) then
    if v_profile.guest_deletion_state is distinct from 'active' then
      raise exception using message = 'guest_profile_deletion_requested';
    end if;
    raise exception using message = 'guest_profile_expired';
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


create or replace function public.claim_assessment_recalculation_job()
returns table (job_id uuid, profile_id uuid, attempts integer, max_attempts integer, started_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.assessment_recalculation_jobs%rowtype;
begin
  select candidate.*
  into job
  from public.assessment_recalculation_jobs as candidate
  join public.profiles as profile
    on profile.id = candidate.profile_id
  where candidate.status in (
    'queued'::public.assessment_recalculation_status,
    'retryable_failed'::public.assessment_recalculation_status
  )
    and not (
      profile.account_type = 'guest'
      and (
        profile.guest_deletion_state is distinct from 'active'
        or profile.guest_expires_at is null
        or profile.guest_expires_at <= clock_timestamp()
      )
    )
  order by candidate.queued_at, candidate.created_at
  for update of candidate skip locked
  limit 1;
  if not found then
    return;
  end if;

  update public.assessment_recalculation_jobs
  set status = 'processing'::public.assessment_recalculation_status,
      attempts = assessment_recalculation_jobs.attempts + 1,
      started_at = now(),
      lease_expires_at = now() + interval '5 minutes',
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
  where id = job.id
  returning
    assessment_recalculation_jobs.id,
    assessment_recalculation_jobs.profile_id,
    assessment_recalculation_jobs.attempts,
    assessment_recalculation_jobs.max_attempts,
    assessment_recalculation_jobs.started_at
  into job_id, profile_id, attempts, max_attempts, started_at;
  return next;
end;
$$;

revoke all on function public.claim_assessment_recalculation_job()
  from public, anon, authenticated;
grant execute on function public.claim_assessment_recalculation_job()
  to service_role;


create or replace function public.reserve_guest_resource(
  p_profile_id uuid,
  p_resource text,
  p_amount bigint,
  p_limit bigint,
  p_usage_day date default current_date
)
returns table (allowed boolean, used_amount bigint, limit_amount bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used bigint;
  v_guest boolean;
begin
  if p_amount < 1 or p_limit < 1 or length(trim(p_resource)) < 1 then
    raise exception using message = 'invalid_guest_resource_limit';
  end if;

  select account_type = 'guest'
    and guest_deletion_state = 'active'
    and guest_expires_at > clock_timestamp()
  into v_guest
  from public.profiles
  where id = p_profile_id
  for update;
  if coalesce(v_guest, false) is false then
    raise exception using message = 'guest_resource_profile_unavailable';
  end if;

  insert into public.guest_resource_usage (profile_id, usage_day, resource, amount)
  values (p_profile_id, p_usage_day, p_resource, p_amount)
  on conflict (profile_id, usage_day, resource) do update
  set amount = public.guest_resource_usage.amount + excluded.amount,
      updated_at = now()
  returning amount into v_used;

  if v_used > p_limit then
    update public.guest_resource_usage
    set amount = amount - p_amount, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = p_resource;
    return query select false, v_used - p_amount, p_limit;
    return;
  end if;

  perform public.touch_guest_profile_activity(p_profile_id, clock_timestamp());
  return query select true, v_used, p_limit;
end;
$$;

revoke all on function public.reserve_guest_resource(uuid, text, bigint, bigint, date)
  from public, anon, authenticated;
grant execute on function public.reserve_guest_resource(uuid, text, bigint, bigint, date)
  to service_role;
drop function if exists public.reserve_guest_upload(uuid, bigint, bigint, bigint, bigint, date);
create or replace function public.reserve_guest_upload(
  p_profile_id uuid,
  p_file_size_bytes bigint,
  p_upload_count_limit bigint,
  p_upload_bytes_limit bigint,
  p_processing_count_limit bigint,
  p_usage_day date default current_date
)
returns table (
  allowed boolean,
  resource text,
  used_amount bigint,
  limit_amount bigint,
  reservation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload_count bigint;
  v_upload_bytes bigint;
  v_processing_count bigint;
  v_reservation_id uuid;
  v_guest boolean;
begin
  if p_file_size_bytes < 1
    or p_upload_count_limit < 1
    or p_upload_bytes_limit < 1
    or p_processing_count_limit < 1 then
    raise exception using message = 'invalid_guest_upload_limit';
  end if;

  select account_type = 'guest'
    and guest_deletion_state = 'active'
    and guest_expires_at > clock_timestamp()
  into v_guest
  from public.profiles
  where id = p_profile_id
  for update;
  if coalesce(v_guest, false) is false then
    raise exception using message = 'guest_resource_profile_unavailable';
  end if;

  insert into public.guest_resource_usage (profile_id, usage_day, resource, amount)
  values (p_profile_id, p_usage_day, 'upload_count', 1)
  on conflict (profile_id, usage_day, resource) do update
  set amount = public.guest_resource_usage.amount + excluded.amount,
      updated_at = now()
  returning amount into v_upload_count;

  insert into public.guest_resource_usage (profile_id, usage_day, resource, amount)
  values (p_profile_id, p_usage_day, 'upload_bytes', p_file_size_bytes)
  on conflict (profile_id, usage_day, resource) do update
  set amount = public.guest_resource_usage.amount + excluded.amount,
      updated_at = now()
  returning amount into v_upload_bytes;

  insert into public.guest_resource_usage (profile_id, usage_day, resource, amount)
  values (p_profile_id, p_usage_day, 'processing_count', 1)
  on conflict (profile_id, usage_day, resource) do update
  set amount = public.guest_resource_usage.amount + excluded.amount,
      updated_at = now()
  returning amount into v_processing_count;

  if v_upload_count > p_upload_count_limit then
    update public.guest_resource_usage
    set amount = amount - 1, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'upload_count';
    update public.guest_resource_usage
    set amount = amount - p_file_size_bytes, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'upload_bytes';
    update public.guest_resource_usage
    set amount = amount - 1, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'processing_count';
    return query select
      false,
      'upload_count'::text,
      v_upload_count - 1,
      p_upload_count_limit,
      null::uuid;
    return;
  end if;

  if v_upload_bytes > p_upload_bytes_limit then
    update public.guest_resource_usage
    set amount = amount - 1, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'upload_count';
    update public.guest_resource_usage
    set amount = amount - p_file_size_bytes, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'upload_bytes';
    update public.guest_resource_usage
    set amount = amount - 1, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'processing_count';
    return query select
      false,
      'upload_bytes'::text,
      v_upload_bytes - p_file_size_bytes,
      p_upload_bytes_limit,
      null::uuid;
    return;
  end if;

  if v_processing_count > p_processing_count_limit then
    update public.guest_resource_usage
    set amount = amount - 1, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'upload_count';
    update public.guest_resource_usage
    set amount = amount - p_file_size_bytes, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'upload_bytes';
    update public.guest_resource_usage
    set amount = amount - 1, updated_at = now()
    where profile_id = p_profile_id
      and usage_day = p_usage_day
      and resource = 'processing_count';
    return query select
      false,
      'processing_count'::text,
      v_processing_count - 1,
      p_processing_count_limit,
      null::uuid;
    return;
  end if;

  insert into public.guest_upload_quota_reservations (
    profile_id,
    usage_day,
    file_size_bytes
  )
  values (p_profile_id, p_usage_day, p_file_size_bytes)
  returning id into v_reservation_id;

  perform public.touch_guest_profile_activity(p_profile_id, clock_timestamp());
  return query select
    true,
    null::text,
    greatest(v_upload_count, v_upload_bytes, v_processing_count),
    greatest(p_upload_count_limit, p_upload_bytes_limit, p_processing_count_limit),
    v_reservation_id;
end;
$$;

revoke all on function public.reserve_guest_upload(uuid, bigint, bigint, bigint, bigint, date)
  from public, anon, authenticated;
grant execute on function public.reserve_guest_upload(uuid, bigint, bigint, bigint, bigint, date)
  to service_role;

create or replace function public.attach_guest_upload_quota_reservation(
  p_reservation_id uuid,
  p_document_id uuid,
  p_intent_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_document_id uuid;
  v_intent_id uuid;
begin
  if p_document_id is null or p_intent_id is null then
    raise exception using message = 'invalid_guest_upload_reservation_attachment';
  end if;

  select status, document_id, intent_id
  into v_status, v_document_id, v_intent_id
  from public.guest_upload_quota_reservations
  where id = p_reservation_id
  for update;

  if not found or v_status <> 'reserved' then
    return false;
  end if;
  if v_document_id is not null or v_intent_id is not null then
    return coalesce(
      v_document_id = p_document_id and v_intent_id = p_intent_id,
      false
    );
  end if;

  update public.guest_upload_quota_reservations
  set document_id = p_document_id,
      intent_id = p_intent_id
  where id = p_reservation_id
    and status = 'reserved';
  return true;
end;
$$;

revoke all on function public.attach_guest_upload_quota_reservation(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.attach_guest_upload_quota_reservation(uuid, uuid, uuid)
  to service_role;

drop function if exists public.release_guest_upload(uuid, bigint, date);

create or replace function public.release_guest_upload(
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.guest_upload_quota_reservations%rowtype;
begin
  select *
  into v_reservation
  from public.guest_upload_quota_reservations
  where id = p_reservation_id
  for update;

  if not found then
    return false;
  end if;
  if v_reservation.status <> 'reserved' then
    return true;
  end if;

  update public.guest_resource_usage
  set amount = greatest(amount - 1, 0), updated_at = now()
  where profile_id = v_reservation.profile_id
    and usage_day = v_reservation.usage_day
    and resource in ('upload_count', 'processing_count');

  update public.guest_resource_usage
  set amount = greatest(amount - v_reservation.file_size_bytes, 0),
      updated_at = now()
  where profile_id = v_reservation.profile_id
    and usage_day = v_reservation.usage_day
    and resource = 'upload_bytes';

  update public.guest_upload_quota_reservations
  set status = 'released',
      released_at = now()
  where id = p_reservation_id
    and status = 'reserved';

  return true;
end;
$$;

revoke all on function public.release_guest_upload(uuid)
  from public, anon, authenticated;
grant execute on function public.release_guest_upload(uuid)
  to service_role;

create or replace function public.finalize_guest_upload(
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status
  into v_status
  from public.guest_upload_quota_reservations
  where id = p_reservation_id
  for update;

  if not found then
    return false;
  end if;
  if v_status = 'released' then
    return false;
  end if;
  if v_status = 'reserved' then
    update public.guest_upload_quota_reservations
    set status = 'consumed',
        consumed_at = now()
    where id = p_reservation_id;
  end if;
  return true;
end;
$$;

revoke all on function public.finalize_guest_upload(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_guest_upload(uuid)
  to service_role;

create or replace function public.reconcile_guest_upload_quota_reservations(
  p_before timestamptz default now() - interval '10 minutes',
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.guest_upload_quota_reservations%rowtype;
  v_reconciled integer := 0;
begin
  if coalesce(p_limit, 0) < 1 then
    raise exception using message = 'invalid_guest_upload_reconciliation_limit';
  end if;

  for v_reservation in
    select *
    from public.guest_upload_quota_reservations
    where status = 'reserved'
      and created_at < p_before
    order by created_at
    limit p_limit
    for update skip locked
  loop
    if v_reservation.document_id is not null
      and (
        exists (
          select 1
          from public.documents
          where id = v_reservation.document_id
            and upload_state = 'complete'
        )
        or exists (
          select 1
          from public.document_storage_write_intents
          where id = v_reservation.intent_id
            and state = 'completed'
        )
      ) then
      perform public.finalize_guest_upload(v_reservation.id);
    else
      perform public.release_guest_upload(v_reservation.id);
    end if;
    v_reconciled := v_reconciled + 1;
  end loop;

  return v_reconciled;
end;
$$;


revoke all on function public.reconcile_guest_upload_quota_reservations(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_guest_upload_quota_reservations(timestamptz, integer)
  to service_role;

drop function if exists public.complete_guest_conversion(uuid, text);

create function public.complete_guest_conversion(
  p_profile_id uuid,
  p_email text,
  p_consent_version text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
  v_current_guest_consent_version constant text := 'guest-2026-06-29';
  v_current_terms_version constant text := '2026-06-29';
begin
  select *
  into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found
    or v_profile.account_type <> 'guest'
    or v_profile.guest_deletion_state <> 'active'
    or v_profile.guest_converted_at is not null
    or v_profile.guest_expires_at is null
    or v_profile.guest_expires_at <= v_now
    or nullif(btrim(v_profile.first_name), '') is null
    or btrim(coalesce(p_consent_version, '')) <> v_current_guest_consent_version
    or v_profile.guest_consent_version is distinct from v_current_guest_consent_version
    or v_profile.terms_version is distinct from v_current_terms_version
    or v_profile.privacy_version is distinct from v_current_terms_version
    or v_profile.privacy_consent_at is null
    or v_profile.guest_consent_accepted_at is null then
    return false;
  end if;

  update public.profiles
  set account_type = 'standard',
      guest_converted_at = v_now,
      guest_expires_at = null,
      guest_deletion_state = 'active',
      email = nullif(btrim(p_email), '')
  where id = p_profile_id;

  return true;
end;
$$;

revoke all on function public.complete_guest_conversion(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_guest_conversion(uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';
