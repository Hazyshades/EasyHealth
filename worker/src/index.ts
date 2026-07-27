import { workerEnv } from "./env.js";
import { ensureWorkerAiReady } from "./ai.js";
import { failJob, runPipeline } from "./pipeline.js";
import { supabase } from "./supabase.js";
import {
  reclaimStaleJobs,
  type ReclaimableJob,
} from "./job-reliability.js";

type JobRow = {
  id: string;
  document_id: string;
  profile_id: string;
  attempts: number;
  max_attempts: number;
  processing_attempt_id: string;
};

type ClaimedJobRow = {
  job_id: string;
  document_id: string;
  profile_id: string;
  attempts: number;
  max_attempts: number;
  processing_attempt_id: string;
  attempt_number: number;
  captured_write_generation: number;
};

type StaleJobQueryRow = {
  id: string;
  document_id: string;
  profile_id: string;
  attempts: number;
  max_attempts: number;
  started_at: string | null;
  document_processing_attempts: Array<{ id: string; state: string }> | null;
};

async function claimJob(): Promise<JobRow | null> {
  const { data: jobs, error } = await supabase
    .from("document_processing_jobs")
    .select("id, document_id, profile_id, attempts, max_attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("Poll error:", error.message);
    return null;
  }

  // Untyped supabase client: assert the selected candidate shape once.
  const candidates = (jobs ?? []) as Array<{ id: string }>;
  for (const job of candidates) {
    // Atomic claim: one transaction locks the document and job, creates the
    // retained processing attempt, and returns its identity. Losing a race
    // returns no row instead of an error.
    const { data, error: claimError } = await supabase.rpc(
      "claim_document_processing_job",
      { p_job_id: job.id },
    );

    if (claimError) {
      console.error("Job claim error:", claimError.message);
      continue;
    }
    const rows = (Array.isArray(data) ? data : [data]) as Array<
      ClaimedJobRow | null | undefined
    >;
    const claimed = rows[0];
    if (!claimed?.processing_attempt_id) continue;

    return {
      id: claimed.job_id,
      document_id: claimed.document_id,
      profile_id: claimed.profile_id,
      attempts: claimed.attempts,
      max_attempts: claimed.max_attempts,
      processing_attempt_id: claimed.processing_attempt_id,
    };
  }

  return null;
}

async function processJob(job: JobRow) {
  console.log(`Processing job ${job.id} for document ${job.document_id}`);
  try {
    const outcome = await runPipeline(job);
    if (outcome === "failed") {
      console.error(`Job ${job.id} failed (see document processing_error)`);
      return;
    }
    console.log(`Completed job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    console.error(`Job ${job.id} failed:`, message);

    if (job.attempts >= job.max_attempts) {
      await failJob(job, message);
    } else {
      const { error: requeueError } = await supabase.rpc(
        "requeue_document_processing_attempt",
        {
          p_attempt_id: job.processing_attempt_id,
          p_message: message,
        },
      );
      if (requeueError) {
        console.error("Job requeue error:", requeueError.message);
      }
    }
  }
}

async function recordHeartbeat() {
  const { error } = await supabase.from("worker_heartbeats").upsert(
    {
      instance_id: workerEnv.instanceId,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "instance_id" },
  );
  if (error) console.error("Worker heartbeat error:", error.message);
}

async function reclaimStaleProcessingJobs() {
  const summary = await reclaimStaleJobs(
    {
      async list(cutoffIso) {
        const { data, error } = await supabase
          .from("document_processing_jobs")
          .select(
            "id, document_id, profile_id, attempts, max_attempts, started_at, document_processing_attempts(id, state)",
          )
          .eq("status", "processing")
          .eq("document_processing_attempts.state", "active")
          .lt("started_at", cutoffIso)
          .order("started_at", { ascending: true });
        if (error) throw new Error(`Stale job query failed: ${error.message}`);
        // Untyped supabase client: assert the selected row shape once.
        const rows = (data ?? []) as StaleJobQueryRow[];
        return rows.map((row) => ({
          id: row.id,
          document_id: row.document_id,
          profile_id: row.profile_id,
          attempts: row.attempts,
          max_attempts: row.max_attempts,
          started_at: row.started_at,
          processing_attempt_id: row.document_processing_attempts?.[0]?.id ?? null,
        }));
      },
      async requeue(job, message) {
        await reclaimAttempt(job, message, false);
      },
      async fail(job, message) {
        await reclaimAttempt(job, message, true);
      },
    },
    {
      now: new Date(),
      staleAfterMs: workerEnv.staleJobMaxAgeMs,
    },
  );

  if (summary.requeued > 0 || summary.failed > 0) {
    console.warn(
      `Reclaimed stale jobs: ${summary.requeued} requeued, ${summary.failed} failed`,
    );
  }
}

async function reclaimAttempt(
  job: ReclaimableJob,
  message: string,
  fail: boolean,
) {
  if (!job.processing_attempt_id) {
    console.error(
      `Stale processing job ${job.id} has no active attempt; leaving it for manual review`,
    );
    return;
  }
  const { error } = await supabase.rpc("reclaim_document_processing_attempt", {
    p_attempt_id: job.processing_attempt_id,
    p_message: message,
    p_fail: fail,
  });
  if (error) {
    throw new Error(`Stale attempt reclaim failed: ${error.message}`);
  }
}

async function tick() {
  await recordHeartbeat();
  try {
    await reclaimStaleProcessingJobs();
  } catch (error) {
    console.error(
      "Stale job reclamation error:",
      error instanceof Error ? error.message : error,
    );
  }

  const job = await claimJob();
  if (job) await processJob(job);
}

async function runTick() {
  try {
    await tick();
  } catch (error) {
    console.error(
      "Worker tick failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

console.log("EasyHealth document worker started");
await ensureWorkerAiReady();
await runTick();
setInterval(() => void runTick(), workerEnv.pollIntervalMs);
