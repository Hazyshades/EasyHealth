import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type GuestResource = "upload_count" | "upload_bytes" | "processing_count";

export class GuestQuotaError extends Error {
  readonly kind: "limit" | "unavailable";

  constructor(kind: "limit" | "unavailable") {
    super(kind === "limit" ? "Guest quota exceeded" : "Guest quota unavailable");
    this.name = "GuestQuotaError";
    this.kind = kind;
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
    throw new GuestQuotaError("unavailable");
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
    if (error.message.includes("guest_resource_profile_unavailable")) {
      throw new GuestQuotaError("unavailable");
    }
    throw new GuestQuotaError("unavailable");
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    allowed?: boolean;
  } | null;
  if (!row?.allowed) throw new GuestQuotaError("limit");
}
