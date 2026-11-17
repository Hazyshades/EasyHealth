import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { isGuestCreationConfigured } from "./guest-policy-rules";
export { isGuestCreationConfigured } from "./guest-policy-rules";
export class GuestModeDisabledError extends Error {
  constructor() {
    super("Guest mode is not available");
    this.name = "GuestModeDisabledError";
  }
}

export type GuestPolicy = {
  enabled: boolean;
  retentionDays: number;
  creationLimit: number;
  creationWindowSeconds: number;
  uploadCountPerDay: number;
  uploadBytesPerDay: number;
  processingCountPerDay: number;
  rateLimitConfigured: boolean;
  abuseChallengeEnabled: boolean;
  abuseChallengeRequired: boolean;
};

export function getGuestPolicy(): GuestPolicy {
  return {
    enabled: env.GUEST_MODE_ENABLED && env.NEXT_PUBLIC_GUEST_MODE_ENABLED,
    retentionDays: env.GUEST_RETENTION_DAYS,
    creationLimit: env.GUEST_CREATION_LIMIT,
    creationWindowSeconds: env.GUEST_CREATION_WINDOW_SECONDS,
    uploadCountPerDay: env.GUEST_UPLOAD_COUNT_PER_DAY,
    uploadBytesPerDay: env.GUEST_UPLOAD_BYTES_PER_DAY,
    processingCountPerDay: env.GUEST_PROCESSING_COUNT_PER_DAY,
    rateLimitConfigured: Boolean(env.GUEST_RATE_LIMIT_PEPPER),
    abuseChallengeEnabled: env.GUEST_ABUSE_CHALLENGE_ENABLED,
    abuseChallengeRequired: env.GUEST_ABUSE_CHALLENGE_REQUIRED,
  };
}

export function assertGuestModeEnabled(): void {
  if (!getGuestPolicy().enabled) throw new GuestModeDisabledError();
}

export function guestCreationKey(request: Request): string | null {
  const pepper = env.GUEST_RATE_LIMIT_PEPPER;
  if (!pepper) return null;
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) || "unknown";
  return createHash("sha256")
    .update(`${pepper}|${address}|${userAgent}`)
    .digest("hex");
}
