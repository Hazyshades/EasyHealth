/**
 * EH-146 E2E helper: completes the queued assessment job for the synthetic
 * test profile using the exact worker path (claim RPC -> snapshot -> complete RPC).
 * One-off verification script for the local Supabase Docker run.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const PROFILE_ID = "db1a3b93-fbd4-4e6b-9246-cffc3caf3013";

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { buildHealthProfileSnapshot } = await import("../src/lib/health-profile-snapshot");
  const admin = createAdminClient();

  const { data: jobRow, error: jobError } = await admin.from("assessment_recalculation_jobs").select("id, status, profile_id").eq("profile_id", PROFILE_ID).maybeSingle();
  if (jobError) throw new Error(jobError.message);
  const job = jobRow as unknown as Record<string, unknown> | null;
  if (!job) throw new Error("no assessment job row found");
  if (job.status !== "processing") throw new Error("job must be processing (claim manually before running)");
  console.log("job:", job.id, "status:", job.status);

  const snapshot = await buildHealthProfileSnapshot({ profileId: PROFILE_ID, labUnitSystem: "si" });
  console.log("snapshot built: inputHash", snapshot.inputHash.slice(0, 12), "sources", snapshot.sourceDocumentIds.length);

  const { error: completeError } = await admin.rpc("complete_assessment_recalculation_job", {
    p_job_id: job.id as string,
    p_input_hash: snapshot.inputHash,
    p_payload: snapshot.profile,
    p_source_document_ids: snapshot.sourceDocumentIds,
  });
  if (completeError) throw new Error(`complete failed: ${completeError.message}`);

  const { data: version, error: versionError } = await admin
    .from("health_profile_assessment_versions")
    .select("id, generated_at, input_hash")
    .eq("profile_id", PROFILE_ID)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw new Error(versionError.message);
  console.log("persisted version:", version?.id, "at", version?.generated_at);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
