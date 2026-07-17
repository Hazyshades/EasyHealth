export type ReclaimableJob = {
  id: string;
  document_id: string;
  profile_id: string;
  attempts: number;
  max_attempts: number;
  started_at: string | null;
};

export type StaleJobActions = {
  list(cutoffIso: string): Promise<ReclaimableJob[]>;
  requeue(job: ReclaimableJob, message: string): Promise<void>;
  fail(job: ReclaimableJob, message: string): Promise<void>;
};

export type ReclaimSummary = {
  requeued: number;
  failed: number;
};

export async function reclaimStaleJobs(
  actions: StaleJobActions,
  options: { now: Date; staleAfterMs: number },
): Promise<ReclaimSummary> {
  const cutoffIso = new Date(
    options.now.getTime() - options.staleAfterMs,
  ).toISOString();
  const jobs = await actions.list(cutoffIso);
  const timeoutMinutes = Math.max(1, Math.round(options.staleAfterMs / 60_000));
  const summary: ReclaimSummary = { requeued: 0, failed: 0 };

  for (const job of jobs) {
    const message = `Document processing timed out after ${timeoutMinutes} minutes`;
    if (job.attempts < job.max_attempts) {
      await actions.requeue(job, `${message}; queued for retry`);
      summary.requeued += 1;
    } else {
      await actions.fail(job, message);
      summary.failed += 1;
    }
  }

  return summary;
}
