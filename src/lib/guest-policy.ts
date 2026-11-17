import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { getTrustedIngressRuntime } from "@/lib/share-links/trusted-ingress";
import { getTrustedIngressContext } from "@/lib/share-links/trusted-ingress-transport";
import { isGuestCreationConfigured } from "./guest-policy-rules";
export { isGuestCreationConfigured } from "./guest-policy-rules";
export const GUEST_CREATION_TICKET_COOKIE = "eh_guest_creation_ticket";
export const GUEST_CREATION_TICKET_TTL_SECONDS = 300;
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
  legalApproved: boolean;
  abuseChallengeEnabled: boolean;
  abuseChallengeRequired: boolean;
};

export function getGuestPolicy(): GuestPolicy {
  const legalApproved =
    env.GUEST_LEGAL_APPROVED && env.NEXT_PUBLIC_GUEST_LEGAL_APPROVED;
  return {
    enabled:
      env.GUEST_MODE_ENABLED &&
      env.NEXT_PUBLIC_GUEST_MODE_ENABLED &&
      legalApproved,
    retentionDays: env.GUEST_RETENTION_DAYS,
    creationLimit: env.GUEST_CREATION_LIMIT,
    creationWindowSeconds: env.GUEST_CREATION_WINDOW_SECONDS,
    uploadCountPerDay: env.GUEST_UPLOAD_COUNT_PER_DAY,
    uploadBytesPerDay: env.GUEST_UPLOAD_BYTES_PER_DAY,
    processingCountPerDay: env.GUEST_PROCESSING_COUNT_PER_DAY,
    rateLimitConfigured: Boolean(env.GUEST_RATE_LIMIT_PEPPER),
    legalApproved,
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

  const ingress = getTrustedIngressContext(
    request,
    getTrustedIngressRuntime(),
  );
  if (!("edgeVerifiedClientAddress" in ingress)) return null;

  return createHash("sha256")
    .update(`${pepper}|${ingress.edgeVerifiedClientAddress}`)
    .digest("hex");
}
