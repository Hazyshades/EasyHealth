-- Guest-mode lifecycle, consent, retention, and abuse-control primitives.
-- Guest operation rows intentionally do not reference profiles so the
-- operational tombstone survives final product-data and Auth deletion.

alter table public.profiles
  add column if not exists account_type text not null default 'standard',
  add column if not exists guest_last_activity_at timestamptz,
  add column if not exists guest_expires_at timestamptz,
  add column if not exists guest_consent_version text,
  add column if not exists guest_consent_accepted_at timestamptz,
  add column if not exists guest_converted_at timestamptz,
  add column if not exists guest_deletion_state text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;
alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('standard', 'guest'));

alter table public.profiles
  drop constraint if exists profiles_guest_deletion_state_check;
alter table public.profiles
  add constraint profiles_guest_deletion_state_check
  check (guest_deletion_state in ('active', 'deleting', 'completed'));

create index if not exists profiles_guest_retention_idx
  on public.profiles (guest_expires_at, id)
  where account_type = 'guest' and guest_deletion_state = 'active';

create index if not exists profiles_guest_activity_idx
  on public.profiles (guest_last_activity_at desc, id)
  where account_type = 'guest';

create table if not exists public.guest_profile_deletion_operations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  reason text not null default 'explicit',
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'retryable_error', 'completed')
  ),
  lease_token uuid,
  lease_expires_at timestamptz,
  worker_id text,
  retry_count integer not null default 0 check (retry_count >= 0),
  next_retry_at timestamptz not null default now(),
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[a-z0-9_:-]{1,80}$'
  ),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  receipt_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_profile_deletion_terminal_consistency check (
    (status = 'completed') = (completed_at is not null)
  )
);

create unique index if not exists guest_profile_deletion_operations_profile_unique
  on public.guest_profile_deletion_operations (profile_id);
create index if not exists guest_profile_deletion_operations_claim_idx
  on public.guest_profile_deletion_operations (
    status,
    next_retry_at,
    lease_expires_at,
    requested_at
  );

alter table public.guest_profile_deletion_operations enable row level security;
revoke all on public.guest_profile_deletion_operations from public, anon, authenticated;
grant select on public.guest_profile_deletion_operations to service_role;

create table if not exists public.guest_creation_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.guest_creation_rate_limits enable row level security;
revoke all on public.guest_creation_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.guest_creation_rate_limits to service_role;

create table if not exists public.guest_resource_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_day date not null,
  resource text not null,
  amount bigint not null default 0 check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, usage_day, resource)
);

alter table public.guest_resource_usage enable row level security;
revoke all on public.guest_resource_usage from public, anon, authenticated;
grant select, insert, update, delete on public.guest_resource_usage to service_role;

create or replace function public.touch_guest_profile_activity(
  p_profile_id uuid,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.profiles
  set guest_last_activity_at = greatest(coalesce(guest_last_activity_at, p_now), p_now),
      guest_expires_at = greatest(
        coalesce(guest_expires_at, p_now + interval '30 days'),
        p_now + case
          when guest_expires_at is not null
            and guest_last_activity_at is not null
            and guest_expires_at > guest_last_activity_at
            then guest_expires_at - guest_last_activity_at
          else interval '30 days'
        end
      )
  where id = p_profile_id
    and account_type = 'guest'
    and guest_deletion_state = 'active'
    and guest_converted_at is null
    and (
      guest_last_activity_at is null
      or guest_last_activity_at <= p_now - interval '5 minutes'
    );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.touch_guest_profile_activity(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.touch_guest_profile_activity(uuid, timestamptz)
  to service_role;

create or replace function public.request_guest_profile_deletion(
  p_profile_id uuid,
  p_reason text default 'explicit'
)
returns table (
  operation_id uuid,
  operation_status text,
  requested_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_operation public.guest_profile_deletion_operations%rowtype;
  v_reason text := case when p_reason = 'ttl' then 'ttl' else 'explicit' end;
begin
  select * into v_operation
  from public.guest_profile_deletion_operations
  where profile_id = p_profile_id
  for update;

  if v_operation.id is not null then
    return query select
      v_operation.id,
      v_operation.status,
      v_operation.requested_at,
      v_operation.completed_at;
    return;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if v_operation.id is not null then
    return query select
      v_operation.id,
      v_operation.status,
      v_operation.requested_at,
      v_operation.completed_at;
    return;
  end if;

  if v_profile.id is null or v_profile.account_type <> 'guest' then
    raise exception using message = 'guest_profile_not_found';
  end if;
  if v_profile.guest_deletion_state = 'completed' then
    raise exception using message = 'guest_profile_already_deleted';
  end if;
  if v_profile.guest_converted_at is not null or v_profile.account_type <> 'guest' then
    raise exception using message = 'guest_profile_converted';
  end if;
  if v_reason = 'ttl'
    and (
      v_profile.guest_expires_at is null
      or v_profile.guest_expires_at > now()
    ) then
    raise exception using message = 'guest_profile_not_expired';
  end if;

  insert into public.guest_profile_deletion_operations (profile_id, reason)
  values (p_profile_id, v_reason)
  returning * into v_operation;

  update public.profiles
  set guest_deletion_state = 'deleting',
      guest_expires_at = now()
  where id = p_profile_id;

  update public.document_processing_jobs
  set status = 'failed',
      error = 'guest_profile_deletion_requested',
      finished_at = now()
  where profile_id = p_profile_id
    and status = 'queued';

  update public.document_processing_attempts
  set cancellation_requested = true,
      cancellation_requested_at = now()
  where profile_id = p_profile_id
    and state = 'active';

  return query select
    v_operation.id,
    v_operation.status,
    v_operation.requested_at,
    v_operation.completed_at;
end;
$$;

revoke all on function public.request_guest_profile_deletion(uuid, text)
  from public, anon, authenticated;
grant execute on function public.request_guest_profile_deletion(uuid, text)
  to service_role;

create or replace function public.claim_guest_profile_deletion_operation(
  p_worker_id text
)
returns table (
  operation_id uuid,
  profile_id uuid,
  reason text,
  operation_status text,
  lease_token uuid,
  lease_expires_at timestamptz,
  retry_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.guest_profile_deletion_operations%rowtype;
  v_token uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '5 minutes';
begin
  select operation.* into v_operation
  from public.guest_profile_deletion_operations as operation
  where operation.status in ('queued', 'processing', 'retryable_error')
    and operation.next_retry_at <= now()
    and (operation.lease_expires_at is null or operation.lease_expires_at <= now())
  order by operation.requested_at, operation.id
  for update skip locked
  limit 1;

  if v_operation.id is null then
    return;
  end if;

  update public.guest_profile_deletion_operations
  set status = 'processing',
      lease_token = v_token,
      lease_expires_at = v_expires,
      worker_id = left(coalesce(p_worker_id, 'guest-cleanup'), 200),
      updated_at = now()
  where id = v_operation.id;

  return query select
    v_operation.id,
    v_operation.profile_id,
    v_operation.reason,
    'processing'::text,
    v_token,
    v_expires,
    v_operation.retry_count;
end;
$$;

revoke all on function public.claim_guest_profile_deletion_operation(text)
  from public, anon, authenticated;
grant execute on function public.claim_guest_profile_deletion_operation(text)
  to service_role;

create or replace function public.heartbeat_guest_profile_deletion_operation(
  p_operation_id uuid,
  p_lease_token uuid,
  p_extend_seconds integer default 300
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
  if p_extend_seconds < 30 or p_extend_seconds > 900 then
    raise exception using message = 'invalid_guest_deletion_lease_extension';
  end if;

  update public.guest_profile_deletion_operations
  set lease_expires_at = now() + make_interval(secs => p_extend_seconds),
      updated_at = now()
  where id = p_operation_id
    and lease_token = p_lease_token
    and lease_expires_at > now()
    and status <> 'completed'
  returning lease_expires_at into v_expires;

  if v_expires is null then
    raise exception using message = 'guest_deletion_lease_invalid';
  end if;
  return v_expires;
end;
$$;

revoke all on function public.heartbeat_guest_profile_deletion_operation(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.heartbeat_guest_profile_deletion_operation(uuid, uuid, integer)
  to service_role;

create or replace function public.transition_guest_profile_deletion_operation(
  p_operation_id uuid,
  p_lease_token uuid,
  p_next_status text,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.guest_profile_deletion_operations%rowtype;
begin
  if p_next_status not in ('processing', 'retryable_error') then
    raise exception using message = 'invalid_guest_deletion_operation_transition';
  end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9_:-]{1,80}$' then
    raise exception using message = 'invalid_guest_deletion_error_code';
  end if;

  select * into v_operation
  from public.guest_profile_deletion_operations
  where id = p_operation_id
  for update;
  if v_operation.id is null then
    raise exception using message = 'guest_deletion_operation_not_found';
  end if;
  if v_operation.lease_token is distinct from p_lease_token
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= now() then
    raise exception using message = 'guest_deletion_lease_invalid';
  end if;

  update public.guest_profile_deletion_operations
  set status = p_next_status,
      last_error_code = case when p_next_status = 'retryable_error' then p_error_code else null end,
      retry_count = case when p_next_status = 'retryable_error' then retry_count + 1 else retry_count end,
      next_retry_at = case
        when p_next_status = 'retryable_error'
          then now() + make_interval(secs => least(3600, greatest(15, (retry_count + 1) * 30)))
        else now()
      end,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where id = p_operation_id;
end;
$$;

revoke all on function public.transition_guest_profile_deletion_operation(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.transition_guest_profile_deletion_operation(uuid, uuid, text, text)
  to service_role;

create or replace function public.reserve_guest_creation(
  p_key_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 3600
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.guest_creation_rate_limits%rowtype;
  v_now timestamptz := now();
  v_retry integer := 0;
begin
  if p_key_hash is null or length(p_key_hash) < 16
    or p_limit < 1 or p_limit > 100
    or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception using message = 'invalid_guest_creation_limit';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));
  select * into v_row
  from public.guest_creation_rate_limits
  where key_hash = p_key_hash
  for update;

  if v_row.key_hash is null
    or v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    insert into public.guest_creation_rate_limits (
      key_hash, window_started_at, attempts, blocked_until, updated_at
    )
    values (p_key_hash, v_now, 1, null, v_now)
    on conflict (key_hash) do update
    set window_started_at = excluded.window_started_at,
        attempts = 1,
        blocked_until = null,
        updated_at = excluded.updated_at;
    return query select true, 0;
    return;
  end if;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer);
    return query select false, v_retry;
    return;
  end if;

  if v_row.attempts >= p_limit then
    update public.guest_creation_rate_limits
    set blocked_until = v_row.window_started_at + make_interval(secs => p_window_seconds),
        updated_at = v_now
    where key_hash = p_key_hash;
    v_retry := greatest(1, ceil(extract(epoch from (v_row.window_started_at + make_interval(secs => p_window_seconds) - v_now)))::integer);
    return query select false, v_retry;
    return;
  end if;

  update public.guest_creation_rate_limits
  set attempts = attempts + 1, updated_at = v_now
  where key_hash = p_key_hash;
  return query select true, 0;
end;
$$;

revoke all on function public.reserve_guest_creation(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_guest_creation(text, integer, integer)
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

  select account_type = 'guest' and guest_deletion_state = 'active'
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

  return query select true, v_used, p_limit;
end;
$$;

revoke all on function public.reserve_guest_resource(uuid, text, bigint, bigint, date)
  from public, anon, authenticated;
grant execute on function public.reserve_guest_resource(uuid, text, bigint, bigint, date)
  to service_role;

create or replace function public.finalize_guest_profile_purge(
  p_operation_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.guest_profile_deletion_operations%rowtype;
  v_profile_id uuid;
  v_now timestamptz := now();
begin
  select * into v_operation
  from public.guest_profile_deletion_operations
  where id = p_operation_id
  for update;
  if v_operation.id is null then
    raise exception using message = 'guest_deletion_operation_not_found';
  end if;
  if v_operation.status <> 'processing'
    or v_operation.lease_token is distinct from p_lease_token
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= v_now then
    raise exception using message = 'guest_deletion_lease_invalid';
  end if;
  v_profile_id := v_operation.profile_id;

  if exists (select 1 from public.documents where profile_id = v_profile_id) then
    raise exception using message = 'guest_deletion_documents_remain';
  end if;
  if exists (
    select 1
    from public.document_deletion_operations
    where profile_id = v_profile_id
      and status <> 'completed'
  ) then
    raise exception using message = 'guest_deletion_document_operations_remain';
  end if;

  -- Profile-scoped reprocessing batches use RESTRICT and must be removed
  -- explicitly before the profile row can be deleted.
  perform set_config('easyhealth.purge_lineage', 'on', true);
  perform set_config('eh104.deletion_purge', 'on', true);
  perform set_config('easyhealth.eh116_allow_batch_row_delete', 'on', true);

  delete from public.registry_reprocess_batch_rows where profile_id = v_profile_id;
  delete from public.registry_reprocess_batches where scope_profile_id = v_profile_id;

  delete from public.profiles where id = v_profile_id and account_type = 'guest';
  if not found then
    raise exception using message = 'guest_deletion_profile_missing';
  end if;

  update public.guest_profile_deletion_operations
  set status = 'completed',
      completed_at = v_now,
      lease_token = null,
      lease_expires_at = null,
      updated_at = v_now
  where id = p_operation_id;

  perform set_config('easyhealth.purge_lineage', 'off', true);
  perform set_config('eh104.deletion_purge', 'off', true);
  perform set_config('easyhealth.eh116_allow_batch_row_delete', 'off', true);
end;
$$;

revoke all on function public.finalize_guest_profile_purge(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_guest_profile_purge(uuid, uuid)
  to service_role;

create index if not exists guest_profile_deletion_receipt_expiry_idx
  on public.guest_profile_deletion_operations (receipt_expires_at, id)
  where status = 'completed';

notify pgrst, 'reload schema';
