-- Serialize guest conversion eligibility with TTL activity and deletion work.

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
    and guest_expires_at is not null
    and guest_expires_at > p_now
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

create or replace function public.complete_guest_conversion(
  p_profile_id uuid,
  p_email text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
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
    or v_profile.guest_consent_version is null
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

revoke all on function public.complete_guest_conversion(uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_guest_conversion(uuid, text)
  to service_role;
