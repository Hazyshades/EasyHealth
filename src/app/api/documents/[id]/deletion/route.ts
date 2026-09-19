import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { noStoreJson } from "@/lib/documents/access";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { data, error } = await createAdminClient()
    .from("document_deletion_operations")
    .select(
      "id, status, requested_at, completed_at, receipt_expires_at, last_error_code",
    )
    .eq("profile_id", profileId)
    .eq("document_id", id)
    .maybeSingle();

  if (error) {
    return noStoreJson(
      { error: "Deletion status unavailable" },
      { status: 500 },
    );
  }
  if (!data) {
    return noStoreJson(
      { error: "Deletion operation not found" },
      { status: 404 },
    );
  }

  return noStoreJson({
    operationId: data.id,
    status: data.status,
    retryable: [
      "queued",
      "waiting_for_writers",
      "cleaning_storage",
      "verifying_storage",
      "retryable_error",
    ].includes(data.status),
    requestedAt: data.requested_at,
    completedAt: data.completed_at,
    receiptExpiresAt: data.receipt_expires_at,
    errorCode: data.last_error_code,
  });
}
