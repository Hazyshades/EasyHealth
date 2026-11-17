-- Record meaningful guest product mutations without extending retention on reads.
-- Recheck the consent version inside the conversion transaction.

create or replace function public.reject_guest_profile_writes_after_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_guest_deletion_state text;
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

  perform public.touch_guest_profile_activity(p_profile_id, clock_timestamp());
  return query select true, v_used, p_limit;
end;
$$;

revoke all on function public.reserve_guest_resource(uuid, text, bigint, bigint, date)
  from public, anon, authenticated;
grant execute on function public.reserve_guest_resource(uuid, text, bigint, bigint, date)
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
  v_current_consent_version constant text := 'guest-2026-06-29';
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
    or v_profile.guest_consent_version is distinct from v_current_consent_version
    or btrim(coalesce(p_consent_version, '')) <> v_current_consent_version
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
