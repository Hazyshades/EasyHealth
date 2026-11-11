import { profileOnboardingStateFromRow } from "@/lib/auth/onboarding-state";
import type { ProfileRow } from "@/lib/auth/profile";
import type { AssistantLimitationCode } from "@/lib/assistant/contract";

export type AssistantAccess = Readonly<{
  allowed: boolean;
  limitationCode: AssistantLimitationCode | null;
  reason: "enabled" | "not_invited" | "revoked" | "consent_required" | "profile_required";
}>;

export function assistantAccessFromProfile(profile: ProfileRow): AssistantAccess {
  if (!profile.closed_beta_enabled) {
    return { allowed: false, limitationCode: "BETA_ACCESS_REQUIRED", reason: "not_invited" };
  }
  if (profile.closed_beta_revoked_at) {
    return { allowed: false, limitationCode: "BETA_ACCESS_REQUIRED", reason: "revoked" };
  }
  const onboarding = profileOnboardingStateFromRow(profile);
  if (onboarding.needsProfileGate) {
    return { allowed: false, limitationCode: "CONSENT_REQUIRED", reason: "profile_required" };
  }
  if (onboarding.needsConsentGate) {
    return { allowed: false, limitationCode: "CONSENT_REQUIRED", reason: "consent_required" };
  }
  return { allowed: true, limitationCode: null, reason: "enabled" };
}
