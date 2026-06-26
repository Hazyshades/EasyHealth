import type { SupabaseClient } from "@supabase/supabase-js";

const LAB_DOCUMENTS_BUCKET = "lab-documents";

export async function ensureLabDocumentsBucket(supabase: SupabaseClient) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to list storage buckets: ${listError.message}`);
  }

  if (buckets?.some((bucket) => bucket.name === LAB_DOCUMENTS_BUCKET)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(LAB_DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/jpg"],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(
      `Storage bucket "${LAB_DOCUMENTS_BUCKET}" is missing. Create it in Supabase Dashboard (Storage → New bucket, private) or run migration 003_storage_bucket.sql. ${createError.message}`
    );
  }
}

export { LAB_DOCUMENTS_BUCKET };
