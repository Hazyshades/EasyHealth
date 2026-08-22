import type { ProfileOnboardingState } from "@/lib/auth/onboarding";

export function resolveAppShellRedirect(input: {
  profileId: string | null;
  onboarding: ProfileOnboardingState | null;
}): string | null {
  if (!input.profileId) return "/?signin=required";
  if (!input.onboarding || input.onboarding.needsProfileGate) {
    return "/onboarding/profile";
  }
  if (input.onboarding.needsConsentGate) return "/onboarding/consent";
  return null;
}
