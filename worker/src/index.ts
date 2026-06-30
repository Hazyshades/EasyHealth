import { workerEnv } from "./env.js";
import { runPipeline } from "./pipeline.js";
import { supabase } from "./supabase.js";

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
    .limit(1);

  if (error) {
    console.error("Poll error:", error.message);
    return null;
  }

  const job = jobs?.[0] as JobRow | undefined;
  if (!job) return null;

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

  if (lockError || !locked) return null;
  return locked as JobRow;
}

async function processJob(job: JobRow) {
  console.log(`Processing job ${job.id} for document ${job.document_id}`);
  try {
    await runPipeline(job);
    console.log(`Completed job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    console.error(`Job ${job.id} failed:`, message);

    if (job.attempts >= job.max_attempts) {
      await supabase
        .from("document_processing_jobs")
        .update({
          status: "failed",
          error: message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await supabase
        .from("documents")
        .update({
          processing_status: "failed",
          status: "failed",
          processing_error: message,
        })
        .eq("id", job.document_id);
    } else {
      await supabase
        .from("document_processing_jobs")
        .update({
          status: "queued",
          error: message,
        })
        .eq("id", job.id);
    }
  }
}

async function tick() {
  const job = await claimJob();
  if (job) {
    await processJob(job);
    return;
  }
}

console.log("EasyHealth document worker started");
await tick();
setInterval(tick, workerEnv.pollIntervalMs);
