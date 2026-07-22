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

  for (const job of (jobs ?? []) as JobRow[]) {
    const { data: activeJob, error: activeJobError } = await supabase
      .from("document_processing_jobs")
      .select("id")
      .eq("document_id", job.document_id)
      .eq("status", "processing")
      .neq("id", job.id)
      .limit(1);

    if (activeJobError) {
      console.error("Active job guard error:", activeJobError.message);
      continue;
    }
    if ((activeJob ?? []).length > 0) continue;

    const { data: locked, error: lockError } = await supabase
      .from("document_processing_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id, document_id, profile_id, attempts, max_attempts")
      .maybeSingle();

    if (lockError) {
      console.error("Job claim error:", lockError.message);
      continue;
    }
    if (locked) return locked as JobRow;
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
      await failJob(job, job.document_id, message);
    } else {
      await supabase
        .from("document_processing_jobs")
        .update({
          status: "queued",
          error: message,
          started_at: null,
          finished_at: null,
        })
        .eq("id", job.id);
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
            "id, document_id, profile_id, attempts, max_attempts, started_at",
          )
          .eq("status", "processing")
          .lt("started_at", cutoffIso)
          .order("started_at", { ascending: true });
        if (error) throw new Error(`Stale job query failed: ${error.message}`);
        return (data ?? []) as ReclaimableJob[];
      },
      async requeue(job, message) {
        const { error } = await supabase
          .from("document_processing_jobs")
          .update({
            status: "queued",
            error: message,
            started_at: null,
            finished_at: null,
          })
          .eq("id", job.id)
          .eq("status", "processing");
        if (error) throw new Error(`Stale job requeue failed: ${error.message}`);
      },
      async fail(job, message) {
        await failJob(job, job.document_id, message);
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
