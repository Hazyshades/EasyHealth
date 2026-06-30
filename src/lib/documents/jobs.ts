import { createAdminClient } from "@/lib/supabase/admin";

export async function enqueueFullPipelineJob(profileId: string, documentId: string) {
  const supabase = createAdminClient();

  const { error: jobError } = await supabase.from("document_processing_jobs").insert({
    document_id: documentId,
    profile_id: profileId,
    job_type: "full_pipeline",
    status: "queued",
  });

  if (jobError) throw new Error(jobError.message);

  const { error: docError } = await supabase
    .from("documents")
    .update({
      processing_status: "processing",
      status: "processing",
    })
    .eq("id", documentId)
    .eq("profile_id", profileId);

  if (docError) throw new Error(docError.message);
}
