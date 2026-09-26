import { createHash } from "node:crypto";
import { workerEnv } from "./env.js";
import { LAB_DOCUMENTS_BUCKET, supabase } from "./supabase.js";

type DeletionOperation = {
  operation_id: string;
  document_id: string;
  profile_id: string;
  tombstone_write_generation: number;
  operation_status:
    | "waiting_for_writers"
    | "cleaning_storage"
    | "verifying_storage"
    | "retryable_error";
  cleanup_lease_token: string;
  cleanup_lease_expires_at: string;
  stable_empty_count: number;
  last_empty_at: string | null;
};

type StorageEntry = { name: string; id: string | null };

type DocumentStoragePaths = {
  storage_path: string | null;
  original_storage_path: string | null;
  normalized_storage_path: string | null;
  thumbnail_storage_path: string | null;
};
type StorageIntentPath = { object_path: string };
type DocumentPageStoragePaths = {
  preview_storage_path: string | null;
  ocr_json_storage_path: string | null;
};

const STORAGE_PAGE_SIZE = 100;
const STABILITY_INTERVAL_MS = 5_000;

type PromiseConstructorWithResolvers = typeof Promise & {
  withResolvers<T>(): {
    promise: Promise<T>;
    resolve: (value?: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
};

function sleep(milliseconds: number): Promise<void> {
  const promiseConstructor = Promise as PromiseConstructorWithResolvers;
  const { promise, resolve } = promiseConstructor.withResolvers<void>();
  setTimeout(resolve, milliseconds);
  return promise;
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("lease")) return "deletion_cleanup_lease_invalid";
  if (message.includes("storage")) return "deletion_storage_unavailable";
  return "deletion_cleanup_failed";
}

async function listStorageObjects(prefix: string): Promise<string[]> {
  const objects: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage
      .from(LAB_DOCUMENTS_BUCKET)
      .list(prefix, { limit: STORAGE_PAGE_SIZE, offset });
    if (error) throw new Error(`storage_list_failed:${error.message}`);
    const entries = (data ?? []) as StorageEntry[];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) {
        objects.push(path);
      } else {
        objects.push(...(await listStorageObjects(path)));
      }
    }
    if (entries.length < STORAGE_PAGE_SIZE) return objects;
    offset += entries.length;
  }
}

async function knownStorageObjects(
  operation: DeletionOperation,
): Promise<string[]> {
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select(
      "storage_path, original_storage_path, normalized_storage_path, thumbnail_storage_path",
    )
    .eq("id", operation.document_id)
    .eq("profile_id", operation.profile_id)
    .maybeSingle();
  if (documentError)
    throw new Error(`storage_manifest_document:${documentError.message}`);
  const { data: pages, error: pagesError } = await supabase
    .from("document_pages")
    .select("preview_storage_path, ocr_json_storage_path")
    .eq("document_id", operation.document_id);
  if (pagesError)
    throw new Error(`storage_manifest_pages:${pagesError.message}`);

  const { data: intents, error: intentsError } = await supabase
    .from("document_storage_write_intents")
    .select("object_path")
    .eq("document_id", operation.document_id);
  if (intentsError)
    throw new Error(`storage_manifest_intents:${intentsError.message}`);

  const paths = new Set<string>();
  const add = (path: string | null | undefined) => {
    if (path) paths.add(path);
  };
  const row = document as DocumentStoragePaths | null;
  add(row?.storage_path);
  add(row?.original_storage_path);
  add(row?.normalized_storage_path);
  add(row?.thumbnail_storage_path);
  const pageRows = (pages ?? []) as DocumentPageStoragePaths[];
  for (const page of pageRows) {
    add(page.preview_storage_path);
    add(page.ocr_json_storage_path);
  }
  const intentRows = (intents ?? []) as StorageIntentPath[];
  for (const intent of intentRows) add(intent.object_path);
  return [...paths];
}

async function listManifest(operation: DeletionOperation): Promise<string[]> {
  const prefix = `${operation.profile_id}/${operation.document_id}`;
  const [listed, known] = await Promise.all([
    listStorageObjects(prefix),
    knownStorageObjects(operation),
  ]);
  return [...new Set([...listed, ...known])].sort();
}

async function removeStorageObjects(paths: string[]): Promise<void> {
  for (let offset = 0; offset < paths.length; offset += STORAGE_PAGE_SIZE) {
    const batch = paths.slice(offset, offset + STORAGE_PAGE_SIZE);
    if (batch.length === 0) continue;
    const { error } = await supabase.storage
      .from(LAB_DOCUMENTS_BUCKET)
      .remove(batch);
    if (
      error &&
      !error.message.toLowerCase().includes("not found") &&
      !error.message.toLowerCase().includes("does not exist")
    ) {
      throw new Error(`storage_remove_failed:${error.message}`);
    }
  }
}

function manifestDigest(paths: readonly string[]): string {
  return createHash("sha256").update(paths.join("\n"), "utf8").digest("hex");
}

async function heartbeat(operation: DeletionOperation): Promise<void> {
  const { error } = await supabase.rpc(
    "heartbeat_document_deletion_operation",
    {
      p_operation_id: operation.operation_id,
      p_cleanup_lease_token: operation.cleanup_lease_token,
    },
  );
  if (error) throw new Error(`deletion_cleanup_heartbeat:${error.message}`);
}

async function transition(
  operation: DeletionOperation,
  expectedStatus: DeletionOperation["operation_status"],
  nextStatus:
    | "waiting_for_writers"
    | "cleaning_storage"
    | "verifying_storage"
    | "retryable_error",
  values: {
    digest?: string | null;
    emptyCount?: number | null;
    lastEmptyAt?: string | null;
    errorCode?: string | null;
  } = {},
): Promise<void> {
  const { error } = await supabase.rpc(
    "transition_document_deletion_operation",
    {
      p_operation_id: operation.operation_id,
      p_cleanup_lease_token: operation.cleanup_lease_token,
      p_expected_status: expectedStatus,
      p_next_status: nextStatus,
      p_manifest_digest: values.digest ?? null,
      p_empty_listing_count: values.emptyCount ?? null,
      p_last_empty_at: values.lastEmptyAt ?? null,
      p_error_code: values.errorCode ?? null,
    },
  );
  if (error) throw new Error(`deletion_transition_failed:${error.message}`);
}

async function writersQuiesced(operation: DeletionOperation): Promise<boolean> {
  const [
    { data: attempts, error: attemptsError },
    { data: intents, error: intentsError },
  ] = await Promise.all([
    supabase
      .from("document_processing_attempts")
      .select("id, lease_expires_at")
      .eq("document_id", operation.document_id)
      .eq("state", "active"),
    supabase
      .from("document_storage_write_intents")
      .select("id, deadline_at, upload_window_until")
      .eq("document_id", operation.document_id)
      .in("state", ["pending", "exchanged"]),
  ]);
  if (attemptsError)
    throw new Error(`deletion_attempt_query:${attemptsError.message}`);
  if (intentsError)
    throw new Error(`deletion_intent_query:${intentsError.message}`);
  const now = Date.now();
  const liveAttempts = (attempts ?? []) as Array<{
    id: string;
    lease_expires_at: string | null;
  }>;
  const liveIntents = (intents ?? []) as Array<{
    id: string;
    deadline_at: string;
    upload_window_until: string | null;
  }>;
  return (
    !liveAttempts.some(
      (attempt) =>
        attempt.lease_expires_at == null ||
        Date.parse(attempt.lease_expires_at) > now,
    ) &&
    !liveIntents.some((intent) => {
      const deadline = Date.parse(intent.deadline_at);
      const windowUntil = intent.upload_window_until
        ? Date.parse(intent.upload_window_until)
        : deadline;
      return deadline > now || windowUntil > now;
    })
  );
}

async function processOperation(
  operation: DeletionOperation,
): Promise<boolean> {
  const expectedStatus = operation.operation_status;
  try {
    if (expectedStatus === "waiting_for_writers") {
      if (!(await writersQuiesced(operation))) {
        await transition(operation, expectedStatus, "waiting_for_writers");
        return false;
      }
      await transition(operation, expectedStatus, "cleaning_storage");
      return false;
    }

    if (expectedStatus === "retryable_error") {
      await transition(operation, expectedStatus, "cleaning_storage");
      return false;
    }

    if (expectedStatus === "verifying_storage") {
      const manifest = await listManifest(operation);
      await heartbeat(operation);
      if (manifest.length > 0) {
        await removeStorageObjects(manifest);
        await transition(operation, expectedStatus, "cleaning_storage", {
          digest: manifestDigest(manifest),
          emptyCount: 0,
        });
        return false;
      }

      const lastEmptyAt = operation.last_empty_at
        ? Date.parse(operation.last_empty_at)
        : 0;
      const remainingWait = Math.max(
        0,
        STABILITY_INTERVAL_MS - (Date.now() - lastEmptyAt),
      );
      if (operation.stable_empty_count < 2 || remainingWait > 0) {
        if (remainingWait > 0) await sleep(remainingWait);
        const secondManifest = await listManifest(operation);
        await heartbeat(operation);
        if (secondManifest.length > 0) {
          await removeStorageObjects(secondManifest);
          await transition(operation, expectedStatus, "cleaning_storage", {
            digest: manifestDigest(secondManifest),
            emptyCount: 0,
          });
          return false;
        }
        await transition(operation, expectedStatus, "verifying_storage", {
          digest: manifestDigest(secondManifest),
          emptyCount: 2,
          lastEmptyAt: new Date().toISOString(),
        });
        return false;
      }

      return true;
    }

    const firstManifest = await listManifest(operation);
    await heartbeat(operation);
    if (firstManifest.length > 0) {
      await removeStorageObjects(firstManifest);
      await heartbeat(operation);
    }

    const afterFirstRemoval = await listManifest(operation);
    await heartbeat(operation);
    if (afterFirstRemoval.length > 0) {
      await removeStorageObjects(afterFirstRemoval);
      await transition(operation, expectedStatus, "cleaning_storage", {
        digest: manifestDigest(afterFirstRemoval),
        emptyCount: 0,
      });
      return false;
    }

    const firstEmptyAt = new Date().toISOString();
    await sleep(STABILITY_INTERVAL_MS);
    const finalManifest = await listManifest(operation);
    await heartbeat(operation);
    if (finalManifest.length > 0) {
      await removeStorageObjects(finalManifest);
      await transition(operation, expectedStatus, "cleaning_storage", {
        digest: manifestDigest(finalManifest),
        emptyCount: 0,
      });
      return false;
    }

    await transition(operation, expectedStatus, "verifying_storage", {
      digest: manifestDigest(finalManifest),
      emptyCount: 2,
      lastEmptyAt: firstEmptyAt,
    });
  } catch (error) {
    console.error("Deletion cleanup failed:", safeErrorCode(error));
    try {
      await transition(operation, expectedStatus, "retryable_error", {
        errorCode: safeErrorCode(error),
      });
    } catch (transitionError) {
      console.error(
        "Deletion cleanup retry transition failed:",
        safeErrorCode(transitionError),
      );
    }
  }
  return false;
}

export async function processOneDeletionOperation(): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "claim_document_deletion_operation",
    {
      p_worker_id: workerEnv.instanceId,
    },
  );
  if (error) throw new Error(`deletion_claim_failed:${error.message}`);
  const operation = (
    Array.isArray(data) ? data[0] : data
  ) as DeletionOperation | null;
  if (!operation) return false;

  const readyToFinalize = await processOperation(operation);
  if (readyToFinalize) {
    const { error: finalizeError } = await supabase.rpc(
      "finalize_document_deletion",
      {
        p_operation_id: operation.operation_id,
        p_cleanup_lease_token: operation.cleanup_lease_token,
      },
    );
    if (finalizeError) {
      console.error(
        "Deletion finalization deferred:",
        safeErrorCode(finalizeError),
      );
    }
  }
  return true;
}

export async function pruneExpiredDeletionReceipts(): Promise<number> {
  const { data, error } = await supabase.rpc(
    "prune_expired_document_deletion_receipts",
    { p_limit: 1000 },
  );
  if (error) throw new Error(`deletion_receipt_prune_failed:${error.message}`);
  return Number(data ?? 0);
}
