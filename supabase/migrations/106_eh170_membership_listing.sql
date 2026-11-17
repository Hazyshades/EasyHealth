-- EH-170: membership management reads remain scoped to the named clinician or clinic admin.

create or replace function public.eh170_list_clinician_memberships(
  p_actor_profile_id uuid
)
returns table (
  membership_id uuid,
  clinic_id uuid,
  clinic_name text,
  clinician_profile_id uuid,
  clinician_name text,
  role text,
  status text,
  invited_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    memberships.id,
    memberships.clinic_id,
    clinics.name,
    memberships.clinician_profile_id,
    coalesce(nullif(btrim(clinicians.display_name), ''), nullif(btrim(clinicians.email), ''), 'Clinician'),
    memberships.role,
    memberships.status,
    memberships.invited_at,
    memberships.accepted_at,
    memberships.revoked_at
  from public.clinic_memberships as memberships
  join public.clinics on clinics.id = memberships.clinic_id
  join public.profiles as clinicians on clinicians.id = memberships.clinician_profile_id
  where memberships.clinician_profile_id = p_actor_profile_id
     or exists (
       select 1
       from public.clinic_memberships as actor_memberships
       where actor_memberships.clinic_id = memberships.clinic_id
         and actor_memberships.clinician_profile_id = p_actor_profile_id
         and actor_memberships.status = 'active'
         and actor_memberships.role in ('owner', 'admin')
     )
  order by memberships.invited_at desc;
$$;

revoke all on function public.eh170_list_clinician_memberships(uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_list_clinician_memberships(uuid)
  to service_role;

notify pgrst, 'reload schema';
