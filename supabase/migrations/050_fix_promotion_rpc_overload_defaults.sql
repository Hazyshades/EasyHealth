-- Remove optional parameters from the five-argument promotion overload.
--
-- Migration 047 introduced both the legacy four-argument RPC and the
-- measurement-payload five-argument RPC, but defaults on the five-argument
-- overload made a four-argument call ambiguous. That ambiguity blocks the
-- existing EH-104 promotion contract and any legacy caller using the stable
-- four-argument signature.
--
-- The original five-argument implementation is renamed and kept intact.
-- An exact five-argument compatibility wrapper retains the public RPC name,
-- so four-argument and five-argument calls resolve to distinct signatures.

alter function public.promote_observation_normalization_revision_v2(
  uuid, uuid, uuid, uuid, jsonb
) rename to promote_observation_normalization_revision_v2_with_payload;

create function public.promote_observation_normalization_revision_v2(
  p_revision_id uuid,
  p_observation_id uuid,
  p_expected_active_revision_id uuid,
  p_actor_id uuid,
  p_observation_payload jsonb
)
returns public.observation_normalization_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  promoted public.observation_normalization_revisions;
begin
  select *
  into promoted
  from public.promote_observation_normalization_revision_v2_with_payload(
    p_revision_id,
    p_observation_id,
    p_expected_active_revision_id,
    p_actor_id,
    p_observation_payload
  );
  return promoted;
end;
$$;

revoke all on function public.promote_observation_normalization_revision_v2(
  uuid, uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.promote_observation_normalization_revision_v2(
  uuid, uuid, uuid, uuid, jsonb
) to service_role;
