import { findProfileById, getProfileById, type ProfileRow } from "@/lib/auth/profile";

export type ProfileOnboardingState = {
  profileId: string;
  firstName: string | null;
  lastName: string | null;
  hasAcceptedTerms: boolean;
  onboardingDismissedAt: string | null;
  onboardingCompletedAt: string | null;
  bannerDismissedAt: string | null;
  needsProfileGate: boolean;
  needsConsentGate: boolean;
  showWizard: boolean;
  showSuccessBanner: boolean;
};

export function profileOnboardingStateFromRow(profile: ProfileRow): ProfileOnboardingState {
  const needsProfileGate = !profile.first_name?.trim();
  const needsConsentGate = !needsProfileGate && !profile.terms_accepted_at;
  const showWizard =
    !needsProfileGate &&
    !needsConsentGate &&
    !profile.onboarding_dismissed_at &&
    !profile.onboarding_completed_at;
  const showSuccessBanner =
    Boolean(profile.onboarding_completed_at) &&
    !profile.dashboard_preferences?.banner_dismissed_at;

  return {
    profileId: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    hasAcceptedTerms: Boolean(profile.terms_accepted_at),
    onboardingDismissedAt: profile.onboarding_dismissed_at,
    onboardingCompletedAt: profile.onboarding_completed_at,
    bannerDismissedAt: profile.dashboard_preferences?.banner_dismissed_at ?? null,
    needsProfileGate,
    needsConsentGate,
    showWizard,
    showSuccessBanner,
  };
}

export async function getProfileOnboardingState(
  profileId: string
): Promise<ProfileOnboardingState> {
  const profile = await getProfileById(profileId);
  return profileOnboardingStateFromRow(profile);
}

export async function getProfileOnboardingStateIfPresent(
  profileId: string
): Promise<ProfileOnboardingState | null> {
  const profile = await findProfileById(profileId);
  if (!profile) return null;
  return profileOnboardingStateFromRow(profile);
}
