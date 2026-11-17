-- Freeze guest-owned product writes after deletion acceptance.
-- Operational job/deletion tables are excluded because the purge worker must
-- advance those records while the guest profile is deleting.

create or replace function public.reject_guest_profile_writes_after_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_guest_deletion_state text;
  v_profile_id uuid := new.profile_id;
begin
  if current_setting('eh104.deletion_purge', true) = 'on'
    or current_setting('eh104.tombstone', true) = 'on'
    or current_setting('easyhealth.purge_lineage', true) = 'on' then
    return new;
  end if;
  if v_profile_id is null then
    return new;
  end if;

  select account_type, guest_deletion_state
  into v_account_type, v_guest_deletion_state
  from public.profiles
  where id = v_profile_id
  for share;

  if not found then
    raise exception using message = 'profile_not_found';
  end if;
  if v_account_type = 'guest' and v_guest_deletion_state <> 'active' then
    raise exception using message = 'guest_profile_deletion_requested';
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
       before insert or update on public.%I
       for each row
       execute function public.reject_guest_profile_writes_after_deletion()',
      v_table
    );
  end loop;
end;
$$;

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

revoke all on function public.reserve_guest_resource(uuid, text, bigint, bigint, date)
  from public, anon, authenticated;
grant execute on function public.reserve_guest_resource(uuid, text, bigint, bigint, date)
  to service_role;
revoke all on function public.request_guest_profile_deletion(uuid, text)
  from public, anon, authenticated;
grant execute on function public.request_guest_profile_deletion(uuid, text)
  to service_role;
