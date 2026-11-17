import assert from "node:assert/strict";

import {
  GUEST_CONSENT_VERSION,
  GUEST_RETENTION_DAYS,
  isActiveGuestProfileSession,
  isAnonymousAuthUser,
  isGuestDeletionStateWritable,
  isPublicGuestModeEnabled,
} from "../src/lib/guest-mode";
import { isGuestCreationConfigured } from "../src/lib/guest-policy-rules";
import { profileOnboardingStateFromRow } from "../src/lib/auth/onboarding-state";
import type { ProfileRow } from "../src/lib/auth/profile";
import type { GuestPolicy } from "../src/lib/guest-policy";

const baseProfile: ProfileRow = {
  id: "00000000-0000-4000-8000-000000000106",
  display_name: "Guest User",
  first_name: "Guest",
  last_name: "User",
  email: null,
  ai_provider: "openai",
  created_at: "2026-06-01T00:00:00.000Z",
  terms_accepted_at: "2026-06-01T00:00:00.000Z",
  terms_version: "2026-06-29",
  health_data_consent_at: "2026-06-01T00:00:00.000Z",
  ai_consent_at: "2026-06-01T00:00:00.000Z",
  consent_preferences: {},
  onboarding_dismissed_at: null,
  onboarding_completed_at: null,
  onboarding_tour_version: "1",
  dashboard_preferences: {},
  lab_unit_system: "si",
  review_mode_default: "pro",
  account_type: "guest",
  guest_last_activity_at: "2026-06-01T00:00:00.000Z",
  guest_expires_at: "2026-07-01T00:00:00.000Z",
  guest_consent_version: null,
  guest_consent_accepted_at: null,
  guest_converted_at: null,
  guest_deletion_state: "active",
};

assert.equal(isAnonymousAuthUser({ is_anonymous: true }), true);
assert.equal(isAnonymousAuthUser({ is_anonymous: false }), false);
assert.equal(isAnonymousAuthUser(null), false);

assert.equal(isGuestDeletionStateWritable(true, "active"), true);
assert.equal(isGuestDeletionStateWritable(true, "deleting"), false);
assert.equal(isGuestDeletionStateWritable(true, "completed"), false);
assert.equal(isGuestDeletionStateWritable(false, "completed"), true);
assert.equal(
  isActiveGuestProfileSession(baseProfile, Date.parse("2026-06-15T00:00:00.000Z")),
  true,
);
assert.equal(
  isActiveGuestProfileSession(
    { ...baseProfile, guest_deletion_state: "deleting" },
    Date.parse("2026-06-15T00:00:00.000Z"),
  ),
  false,
);
assert.equal(
  isActiveGuestProfileSession(
    { ...baseProfile, guest_expires_at: "2026-06-14T00:00:00.000Z" },
    Date.parse("2026-06-15T00:00:00.000Z"),
  ),
  false,
);

process.env.NEXT_PUBLIC_GUEST_MODE_ENABLED = "false";
assert.equal(isPublicGuestModeEnabled(), false);
process.env.NEXT_PUBLIC_GUEST_MODE_ENABLED = "1";
assert.equal(isPublicGuestModeEnabled(), true);

assert.equal(GUEST_RETENTION_DAYS, 30);
assert.equal(GUEST_CONSENT_VERSION, "guest-2026-06-29");

const pendingGuest = profileOnboardingStateFromRow(baseProfile);
const unnamedGuest = profileOnboardingStateFromRow({
  ...baseProfile,
  first_name: null,
});
assert.equal(unnamedGuest.needsProfileGate, true);
assert.equal(pendingGuest.isGuest, true);
assert.equal(pendingGuest.needsProfileGate, false);
assert.equal(pendingGuest.hasCurrentGuestConsent, false);
assert.equal(pendingGuest.needsConsentGate, true);

const acceptedGuest = profileOnboardingStateFromRow({
  ...baseProfile,
  guest_consent_version: GUEST_CONSENT_VERSION,
  guest_consent_accepted_at: "2026-06-01T00:00:00.000Z",
});
assert.equal(acceptedGuest.hasCurrentGuestConsent, true);
assert.equal(acceptedGuest.needsConsentGate, false);

const staleGuest = profileOnboardingStateFromRow({
  ...baseProfile,
  guest_consent_version: "guest-previous",
  guest_consent_accepted_at: "2026-06-01T00:00:00.000Z",
});
assert.equal(staleGuest.needsConsentGate, true);

const standard = profileOnboardingStateFromRow({
  ...baseProfile,
  account_type: "standard",
});
assert.equal(standard.isGuest, false);
assert.equal(standard.hasCurrentGuestConsent, true);

const guestPolicy: GuestPolicy = {
  enabled: true,
  retentionDays: 30,
  creationLimit: 5,
  creationWindowSeconds: 3600,
  uploadCountPerDay: 10,
  uploadBytesPerDay: 100 * 1024 * 1024,
  processingCountPerDay: 10,
  rateLimitConfigured: true,
  abuseChallengeEnabled: false,
  abuseChallengeRequired: false,
};
assert.equal(isGuestCreationConfigured(guestPolicy), true);
assert.equal(
  isGuestCreationConfigured({
    ...guestPolicy,
    abuseChallengeRequired: true,
  }),
  false,
);
assert.equal(
  isGuestCreationConfigured({
    ...guestPolicy,
    abuseChallengeEnabled: true,
    abuseChallengeRequired: true,
  }),
  true,
);

console.log("verify-guest-mode: identity, lifecycle, consent, and flag checks passed");

