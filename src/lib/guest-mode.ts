export const GUEST_RETENTION_DAYS = 30;
export const GUEST_CONSENT_VERSION = "guest-2026-06-29";

export type GuestDeletionState = "active" | "deleting" | "completed";
export function isActiveGuestProfileSession(
  profile: {
    account_type: string;
    guest_deletion_state: GuestDeletionState;
    guest_converted_at: string | null;
    guest_expires_at: string | null;
  },
  nowMs = Date.now(),
): boolean {
  if (
    profile.account_type !== "guest" ||
    profile.guest_deletion_state !== "active" ||
    profile.guest_converted_at !== null ||
    !profile.guest_expires_at
  ) {
    return false;
  }
  const expiresAt = Date.parse(profile.guest_expires_at);
  return Number.isFinite(expiresAt) && expiresAt > nowMs;
}

export function isGuestProductAccessAllowed(profile: {
  account_type: string;
  first_name: string | null;
  guest_deletion_state: GuestDeletionState;
  guest_converted_at: string | null;
  guest_expires_at: string | null;
  guest_consent_version: string | null;
  guest_consent_accepted_at: string | null;
}): boolean {
  return (
    isActiveGuestProfileSession(profile) &&
    Boolean(profile.first_name?.trim()) &&
    profile.guest_consent_version === GUEST_CONSENT_VERSION &&
    profile.guest_consent_accepted_at !== null
  );
}

export function isAnonymousAuthUser(user: {
  is_anonymous?: boolean;
} | null | undefined): boolean {
  return user?.is_anonymous === true;
}

export function isGuestDeletionStateWritable(
  isGuest: boolean,
  state: GuestDeletionState,
): boolean {
  return !isGuest || state === "active";
}

export function isPublicGuestModeEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_GUEST_MODE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_GUEST_MODE_ENABLED === "1"
  );
}
