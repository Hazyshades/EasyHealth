import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type GuestResource = "upload_count" | "upload_bytes" | "processing_count";

export class GuestQuotaError extends Error {
  readonly kind: "limit" | "unavailable";
  readonly resource: GuestResource | null;

  constructor(
    kind: "limit" | "unavailable",
    resource: GuestResource | null = null,
  ) {
    super(kind === "limit" ? "Guest quota exceeded" : "Guest quota unavailable");
    this.name = "GuestQuotaError";
    this.kind = kind;
    this.resource = resource;
  }
}

function limitFor(resource: GuestResource): number {
  if (resource === "upload_count") return env.GUEST_UPLOAD_COUNT_PER_DAY;
  if (resource === "upload_bytes") return env.GUEST_UPLOAD_BYTES_PER_DAY;
  return env.GUEST_PROCESSING_COUNT_PER_DAY;
}

export async function reserveGuestResource(
  profileId: string,
  resource: GuestResource,
  amount: number,
): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new GuestQuotaError("unavailable", resource);
  }

  const { data, error } = await createAdminClient().rpc(
    "reserve_guest_resource",
    {
      p_profile_id: profileId,
      p_resource: resource,
      p_amount: amount,
      p_limit: limitFor(resource),
    },
  );
  if (error) {
    throw new GuestQuotaError("unavailable", resource);
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    allowed?: boolean;
  } | null;
  if (!row?.allowed) throw new GuestQuotaError("limit", resource);
}

export async function reserveGuestUpload(
  profileId: string,
  fileSizeBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1) {
    throw new GuestQuotaError("unavailable", "upload_bytes");
  }

  const { data, error } = await createAdminClient().rpc("reserve_guest_upload", {
    p_profile_id: profileId,
    p_file_size_bytes: fileSizeBytes,
    p_upload_count_limit: env.GUEST_UPLOAD_COUNT_PER_DAY,
    p_upload_bytes_limit: env.GUEST_UPLOAD_BYTES_PER_DAY,
    p_processing_count_limit: env.GUEST_PROCESSING_COUNT_PER_DAY,
  });
  if (error) {
    throw new GuestQuotaError("unavailable");
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    allowed?: boolean;
    resource?: GuestResource | null;
    reservation_id?: string | null;
  } | null;
  if (!row?.allowed) {
    throw new GuestQuotaError("limit", row?.resource ?? "upload_count");
  }
  if (!row.reservation_id) {
    throw new GuestQuotaError("unavailable");
  }
  return row.reservation_id;
}

export async function attachGuestUploadReservation(
  reservationId: string,
  documentId: string,
  intentId: string,
): Promise<void> {
  if (!reservationId.trim() || !documentId.trim() || !intentId.trim()) {
    throw new GuestQuotaError("unavailable");
  }

  const { data, error } = await createAdminClient().rpc(
    "attach_guest_upload_quota_reservation",
    {
      p_reservation_id: reservationId,
      p_document_id: documentId,
      p_intent_id: intentId,
    },
  );
  if (error || data !== true) throw new GuestQuotaError("unavailable");
}

export async function releaseGuestUpload(reservationId: string): Promise<void> {
  if (!reservationId.trim()) {
    throw new GuestQuotaError("unavailable");
  }

  const { error } = await createAdminClient().rpc("release_guest_upload", {
    p_reservation_id: reservationId,
  });
  if (error) throw new GuestQuotaError("unavailable");
}

export async function finalizeGuestUpload(reservationId: string): Promise<void> {
  if (!reservationId.trim()) {
    throw new GuestQuotaError("unavailable");
  }

  const { error } = await createAdminClient().rpc("finalize_guest_upload", {
    p_reservation_id: reservationId,
  });
  if (error) throw new GuestQuotaError("unavailable");
}
