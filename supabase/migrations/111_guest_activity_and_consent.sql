-- Record meaningful guest product mutations without extending retention on reads.
-- Recheck the consent version inside the conversion transaction.

alter table public.profiles
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_version text;

update public.profiles
set privacy_consent_at = coalesce(privacy_consent_at, terms_accepted_at),
    privacy_version = coalesce(privacy_version, terms_version)
where (privacy_consent_at is null or privacy_version is null)
  and terms_accepted_at is not null
  and terms_version is not null;

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
  limit_amount bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload_count bigint;
  v_upload_bytes bigint;
  v_processing_count bigint;
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
      p_upload_count_limit;
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
      p_upload_bytes_limit;
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
      p_processing_count_limit;
    return;
  end if;

  perform public.touch_guest_profile_activity(p_profile_id, clock_timestamp());
  return query select
    true,
    null::text,
    greatest(v_upload_count, v_upload_bytes, v_processing_count),
    greatest(p_upload_count_limit, p_upload_bytes_limit, p_processing_count_limit);
end;
$$;

revoke all on function public.reserve_guest_upload(uuid, bigint, bigint, bigint, bigint, date)
  from public, anon, authenticated;
grant execute on function public.reserve_guest_upload(uuid, bigint, bigint, bigint, bigint, date)
  to service_role;

create or replace function public.release_guest_upload(
  p_profile_id uuid,
  p_file_size_bytes bigint,
  p_usage_day date default current_date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_file_size_bytes < 1 then
    raise exception using message = 'invalid_guest_upload_size';
  end if;

  perform 1
  from public.profiles
  where id = p_profile_id
  for update;
  if not found then
    return false;
  end if;

  update public.guest_resource_usage
  set amount = greatest(amount - 1, 0), updated_at = now()
  where profile_id = p_profile_id
    and usage_day = p_usage_day
    and resource in ('upload_count', 'processing_count');

  update public.guest_resource_usage
  set amount = greatest(amount - p_file_size_bytes, 0), updated_at = now()
  where profile_id = p_profile_id
    and usage_day = p_usage_day
    and resource = 'upload_bytes';

  return true;
end;
$$;

revoke all on function public.release_guest_upload(uuid, bigint, date)
  from public, anon, authenticated;
grant execute on function public.release_guest_upload(uuid, bigint, date)
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
    or v_profile.guest_consent_version is distinct from v_current_guest_consent_version
    or btrim(coalesce(p_consent_version, '')) <> v_current_guest_consent_version
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
