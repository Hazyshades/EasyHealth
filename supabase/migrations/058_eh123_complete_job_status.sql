-- EH-123: resolve completion state CASE branches to the enum.
create or replace function public.complete_assessment_recalculation_job(p_job_id uuid, p_input_hash text, p_payload jsonb, p_source_document_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare job public.assessment_recalculation_jobs%rowtype; version_id uuid;
begin
  select * into job from public.assessment_recalculation_jobs where id = p_job_id for update;
  if not found or job.status <> 'processing' or job.lease_expires_at < now() then raise exception using message = 'assessment_job_not_claimed'; end if;
  if p_input_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_payload) <> 'object' then raise exception using message = 'invalid_assessment_snapshot'; end if;
  insert into public.health_profile_assessment_versions (profile_id, input_hash, payload, source_document_ids) values (job.profile_id, p_input_hash, p_payload, coalesce(p_source_document_ids, '{}')) on conflict (profile_id, input_hash) do nothing returning id into version_id;
  if version_id is null then select id into version_id from public.health_profile_assessment_versions where profile_id = job.profile_id and input_hash = p_input_hash; end if;
  insert into public.health_profile_assessment_event_receipts (dependency_event_id, assessment_version_id)
  select event.id, version_id from public.assessment_dependency_events event left join public.health_profile_assessment_event_receipts receipt on receipt.dependency_event_id = event.id
  where event.profile_id = job.profile_id and receipt.dependency_event_id is null and event.created_at <= job.started_at on conflict do nothing;
  update public.assessment_recalculation_jobs set status = case when exists (select 1 from public.assessment_dependency_events event left join public.health_profile_assessment_event_receipts receipt on receipt.dependency_event_id = event.id where event.profile_id = job.profile_id and receipt.dependency_event_id is null) then 'queued'::public.assessment_recalculation_status else 'succeeded'::public.assessment_recalculation_status end, completed_at = now(), lease_expires_at = null, updated_at = now() where id = job.id;
  return version_id;
end;
$$;
notify pgrst, 'reload schema';