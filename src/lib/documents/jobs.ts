import { createAdminClient } from "@/lib/supabase/admin";

export async function enqueueFullPipelineJob(
  profileId: string,
  documentId: string,
) {
  const supabase = createAdminClient();
  const configuredMaxAttempts = Number(
    process.env.DOCUMENT_PROCESSING_MAX_ATTEMPTS ?? "3",
  );
  const maxAttempts =
    Number.isInteger(configuredMaxAttempts) && configuredMaxAttempts > 0
      ? configuredMaxAttempts
      : 3;

  const { data: existingJob, error: existingJobError } = await supabase
    .from("document_processing_jobs")
    .select("id")
    .eq("document_id", documentId)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingJobError) throw new Error(existingJobError.message);

  let jobId = existingJob?.id ?? null;
  let created = false;

  if (!jobId) {
    const { data: insertedJob, error: jobError } = await supabase
      .from("document_processing_jobs")
      .insert({
        document_id: documentId,
        profile_id: profileId,
        job_type: "full_pipeline",
        status: "queued",
        attempts: 0,
        max_attempts: maxAttempts,
      })
      .select("id")
      .maybeSingle();

    if (jobError?.code === "23505") {
      const { data: racedJob, error: racedJobError } = await supabase
        .from("document_processing_jobs")
        .select("id")
        .eq("document_id", documentId)
        .in("status", ["queued", "processing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (racedJobError || !racedJob) {
        throw new Error(
          racedJobError?.message ?? "Active document processing job not found",
        );
      }
      jobId = racedJob.id;
    } else if (jobError) {
      throw new Error(jobError.message);
    } else if (insertedJob) {
      jobId = insertedJob.id;
      created = true;
    }
  }

  if (!jobId) throw new Error("Failed to enqueue document processing");

  const { error: docError } = await supabase
    .from("documents")
    .update({
      processing_status: "processing",
      status: "processing",
    })
    .eq("id", documentId)
    .eq("profile_id", profileId);

  if (docError) throw new Error(docError.message);
  return { jobId, created };
}
