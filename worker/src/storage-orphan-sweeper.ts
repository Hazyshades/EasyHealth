import { LAB_DOCUMENTS_BUCKET, supabase } from "./supabase.js";

const PAGE_SIZE = 100;

type StorageIntent = {
  id: string;
  document_id: string;
  bucket: string;
  object_path: string;
  state: "pending" | "exchanged";
};

type CurrentIntent = {
  id: string;
  state: "pending" | "exchanged" | "completed" | "failed" | "expired";
  object_path: string;
};

async function removeObjectIfPresent(bucket: string, objectPath: string) {
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (
    error &&
    !error.message.toLowerCase().includes("not found") &&
    !error.message.toLowerCase().includes("does not exist")
  ) {
    throw new Error(`storage_orphan_remove_failed:${error.message}`);
  }
}

async function sweepIntent(intent: StorageIntent): Promise<boolean> {
  const { error: failError } = await supabase.rpc("fail_storage_write_intent", {
    p_intent_id: intent.id,
    p_reason_code: "storage_intent_expired",
  });
  if (failError) throw new Error(`storage_orphan_fail:${failError.message}`);

  const { data: current, error: currentError } = await supabase
    .from("document_storage_write_intents")
    .select("id, state, object_path")
    .eq("id", intent.id)
    .maybeSingle();
  if (currentError) {
    throw new Error(`storage_orphan_recheck:${currentError.message}`);
  }
  const row = current as CurrentIntent | null;
  if (!row || row.state !== "failed") return false;

  const { data: liveIntents, error: liveError } = await supabase
    .from("document_storage_write_intents")
    .select("id, state, object_path")
    .eq("bucket", intent.bucket)
    .eq("object_path", row.object_path)
    .in("state", ["pending", "exchanged", "completed"]);
  if (liveError) {
    throw new Error(`storage_orphan_live_check:${liveError.message}`);
  }
  if ((liveIntents ?? []).some((candidate) => candidate.id !== intent.id)) {
    return false;
  }

  await removeObjectIfPresent(intent.bucket, row.object_path);
  return true;
}

export async function sweepExpiredStorageIntents(): Promise<number> {
  let swept = 0;
  while (true) {
    const { data, error } = await supabase
      .from("document_storage_write_intents")
      .select("id, document_id, bucket, object_path, state")
      .in("state", ["pending", "exchanged"])
      .lt("deadline_at", new Date().toISOString())
      .range(0, PAGE_SIZE - 1);
    if (error) throw new Error(`storage_orphan_query:${error.message}`);
    const intents = (data ?? []) as StorageIntent[];
    let processed = 0;
    for (const intent of intents) {
      try {
        if (intent.bucket === LAB_DOCUMENTS_BUCKET) {
          if (await sweepIntent(intent)) swept += 1;
          processed += 1;
        }
      } catch (error) {
        console.error(
          "Expired storage intent sweep failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    if (intents.length < PAGE_SIZE || processed === 0) break;
  }
  return swept;
}
