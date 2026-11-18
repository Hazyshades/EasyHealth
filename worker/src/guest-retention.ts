import { workerEnv } from "./env.js";
import { LAB_DOCUMENTS_BUCKET, supabase } from "./supabase.js";
import {
  listStorageObjects,
  removeStorageObjects,
} from "./deletion-cleanup.js";

type GuestDeletionOperation = {
  operation_id: string;
  profile_id: string;
  reason: "explicit" | "ttl";
  operation_status: "processing";
  lease_token: string;
  lease_expires_at: string;
  retry_count: number;
};

type GuestProfileRow = {
  id: string;
  account_type: "standard" | "guest";
  guest_deletion_state: "active" | "deleting" | "completed";
  guest_converted_at: string | null;
  guest_expires_at: string | null;
};

type GuestDocumentRow = {
  id: string;
  lifecycle_state: string;
};

export function guestErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("storage")) return "guest_storage_cleanup_failed";
  if (message.includes("auth") || message.includes("user")) {
    return "guest_auth_cleanup_failed";
  }
  if (message.includes("lease")) return "guest_deletion_lease_invalid";
  if (message.includes("document")) return "guest_document_cleanup_failed";
  if (message.includes("metrics")) return "guest_metrics_query_failed";
  return "guest_purge_failed";
}
export type GuestPurgeMetrics = {
  queued: number;
  processing: number;
  retryable: number;
  completed: number;
};

let lastBacklogAlertAt = 0;
let lastRetryAlertAt = 0;

export async function readGuestPurgeMetrics(): Promise<GuestPurgeMetrics> {
  const statuses = [
    "queued",
    "processing",
    "retryable_error",
    "completed",
  ] as const;
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabase
        .from("guest_profile_deletion_operations")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) throw new Error(`guest_metrics_query:${error.message}`);
      return count ?? 0;
    }),
  );
  return {
    queued: counts[0],
    processing: counts[1],
    retryable: counts[2],
    completed: counts[3],
  };
}

export function emitGuestPurgeMetrics(
  metrics: GuestPurgeMetrics,
  nowMs = Date.now(),
): void {
  const backlog = metrics.queued + metrics.retryable;
  console.info(
    `[guest] metrics queued=${metrics.queued} processing=${metrics.processing} retryable=${metrics.retryable} completed=${metrics.completed}`,
  );

  if (
    backlog >= workerEnv.guestPurgeBacklogAlertThreshold &&
    nowMs - lastBacklogAlertAt >= workerEnv.guestPurgeAlertCooldownMs
  ) {
    lastBacklogAlertAt = nowMs;
    console.warn(
      `[guest] alert=purge_backlog backlog=${backlog} threshold=${workerEnv.guestPurgeBacklogAlertThreshold}`,
    );
  }
  if (
    metrics.retryable >= workerEnv.guestPurgeRetryAlertThreshold &&
    nowMs - lastRetryAlertAt >= workerEnv.guestPurgeAlertCooldownMs
  ) {
    lastRetryAlertAt = nowMs;
    console.warn(
      `[guest] alert=purge_retryable retryable=${metrics.retryable} threshold=${workerEnv.guestPurgeRetryAlertThreshold}`,
    );
  }
}

export async function reconcileGuestUploadQuotaReservations(): Promise<number> {
  const { data, error } = await supabase.rpc(
    "reconcile_guest_upload_quota_reservations",
  );
  if (error) {
    throw new Error(`guest_upload_quota_reconciliation:${error.message}`);
  }
  const count = Number(data ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("guest_upload_quota_reconciliation:invalid_count");
  }
  return count;
}

function isMissingAuthUser(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("not found") || message.includes("user not found");
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function heartbeat(operation: GuestDeletionOperation): Promise<void> {
  const { error } = await supabase.rpc(
    "heartbeat_guest_profile_deletion_operation",
    {
      p_operation_id: operation.operation_id,
      p_lease_token: operation.lease_token,
    },
  );
  if (error) throw new Error(`guest_deletion_heartbeat:${error.message}`);
}

async function transition(
  operation: GuestDeletionOperation,
  nextStatus: "processing" | "retryable_error",
  errorCode: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc(
    "transition_guest_profile_deletion_operation",
    {
      p_operation_id: operation.operation_id,
      p_lease_token: operation.lease_token,
      p_next_status: nextStatus,
      p_error_code: errorCode,
    },
  );
  if (error) throw new Error(`guest_deletion_transition:${error.message}`);
}

async function requestDocumentDeletions(
  operation: GuestDeletionOperation,
): Promise<number> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, lifecycle_state")
    .eq("profile_id", operation.profile_id)
    .in("lifecycle_state", ["active", "deleting"]);
  if (error) throw new Error(`guest_document_query:${error.message}`);

  let requested = 0;
  for (const document of (data ?? []) as GuestDocumentRow[]) {
    if (document.lifecycle_state !== "active") continue;
    const { error: requestError } = await supabase.rpc(
      "request_document_deletion",
      { p_profile_id: operation.profile_id, p_document_id: document.id },
    );
    if (requestError) {
      throw new Error(`guest_document_request:${requestError.message}`);
    }
    requested += 1;
    if (requested % 10 === 0) await heartbeat(operation);
  }
  return requested;
}

async function hasRemainingDocumentOperations(profileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("document_deletion_operations")
    .select("id")
    .eq("profile_id", profileId)
    .neq("status", "completed")
    .limit(1);
  if (error) throw new Error(`guest_document_operation_query:${error.message}`);
  return (data ?? []).length > 0;
}

async function cleanProfileStorage(
  profileId: string,
  operation: GuestDeletionOperation,
): Promise<void> {
  const firstListing = await listStorageObjects(profileId);
  if (firstListing.length > 0) {
    await heartbeat(operation);
    await removeStorageObjects(firstListing);
  }
  await sleep(1_000);
  await heartbeat(operation);
  const remaining = await listStorageObjects(profileId);
  if (remaining.length > 0) {
    throw new Error(`guest_storage_objects_remain:${LAB_DOCUMENTS_BUCKET}`);
  }
}

async function deleteAuthUser(profileId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(profileId);
  if (error && !isMissingAuthUser(error)) {
    throw new Error(`guest_auth_delete:${error.message}`);
  }
}

async function processOperation(operation: GuestDeletionOperation): Promise<void> {
  console.info(
    `[guest] purge status=processing operation=${operation.operation_id} reason=${operation.reason} retry=${operation.retry_count}`,
  );
  try {
    await heartbeat(operation);
    const requested = await requestDocumentDeletions(operation);
    if (requested > 0 || (await hasRemainingDocumentOperations(operation.profile_id))) {
      await transition(operation, "processing");
      console.log(
        `[guest] purge status=waiting operation=${operation.operation_id} reason=${operation.reason} retry=${operation.retry_count}`,
      );
      return;
    }

    const { data: remainingDocuments, error: documentsError } = await supabase
      .from("documents")
      .select("id")
      .eq("profile_id", operation.profile_id)
      .limit(1);
    if (documentsError) throw new Error(`guest_document_verify:${documentsError.message}`);
    if ((remainingDocuments ?? []).length > 0) {
      throw new Error("guest_documents_remain");
    }

    await cleanProfileStorage(operation.profile_id, operation);
    await heartbeat(operation);
    await deleteAuthUser(operation.profile_id);

    const { error: finalizeError } = await supabase.rpc(
      "finalize_guest_profile_purge",
      {
        p_operation_id: operation.operation_id,
        p_lease_token: operation.lease_token,
      },
    );
    if (finalizeError) throw new Error(`guest_profile_finalize:${finalizeError.message}`);

    console.log(
      `[guest] purge status=completed operation=${operation.operation_id} reason=${operation.reason}`,
    );
  } catch (error) {
    const errorCode = guestErrorCode(error);
    console.warn(
      `[guest] purge status=retryable operation=${operation.operation_id} error=${errorCode}`,
    );
    try {
      await transition(operation, "retryable_error", errorCode);
    } catch (transitionError) {
      console.error(
        `[guest] purge retry transition failed operation=${operation.operation_id} error=${guestErrorCode(transitionError)}`,
      );
    }
  }
}

export async function queueExpiredGuestProfiles(): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, account_type, guest_deletion_state, guest_converted_at, guest_expires_at",
    )
    .eq("account_type", "guest")
    .eq("guest_deletion_state", "active")
    .is("guest_converted_at", null)
    .not("guest_expires_at", "is", null)
    .lte("guest_expires_at", new Date().toISOString())
    .order("guest_expires_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(`guest_ttl_query:${error.message}`);

  let queued = 0;
  for (const profile of (data ?? []) as GuestProfileRow[]) {
    const { error: requestError } = await supabase.rpc(
      "request_guest_profile_deletion",
      { p_profile_id: profile.id, p_reason: "ttl" },
    );
    if (requestError) {
      console.warn(`[guest] ttl request skipped: ${guestErrorCode(requestError)}`);
      continue;
    }
    queued += 1;
  }
  return queued;
}

export async function processOneGuestProfileDeletion(): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "claim_guest_profile_deletion_operation",
    { p_worker_id: workerEnv.instanceId },
  );
  if (error) throw new Error(`guest_deletion_claim:${error.message}`);
  const operation = (
    Array.isArray(data) ? data[0] : data
  ) as GuestDeletionOperation | null;
  if (!operation) return false;
  await processOperation(operation);
  return true;
}
