-- EH-123: avoid RETURNS TABLE variable shadowing in the claim RPC.
create or replace function public.claim_assessment_recalculation_job()
returns table (job_id uuid, profile_id uuid, attempts integer, max_attempts integer, started_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare job public.assessment_recalculation_jobs%rowtype;
begin
  select * into job from public.assessment_recalculation_jobs
  where status in ('queued', 'retryable_failed') order by queued_at, created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.assessment_recalculation_jobs set status = 'processing',
    attempts = assessment_recalculation_jobs.attempts + 1, started_at = now(),
    lease_expires_at = now() + interval '5 minutes', last_error_code = null,
    last_error_message = null, updated_at = now() where id = job.id
  returning assessment_recalculation_jobs.id, assessment_recalculation_jobs.profile_id,
    assessment_recalculation_jobs.attempts, assessment_recalculation_jobs.max_attempts,
    assessment_recalculation_jobs.started_at into job_id, profile_id, attempts, max_attempts, started_at;
  return next;
end;
$$;
notify pgrst, 'reload schema';