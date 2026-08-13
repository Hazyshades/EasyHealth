-- EH-123: CASE state branches must resolve to the assessment enum.
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
notify pgrst, 'reload schema';