import { CURRENT_TERMS_VERSION } from "@/lib/consent";
import type { ProfileRow } from "@/lib/auth/profile";
import { CURRENT_PLATFORM_TOUR_VERSION } from "@/lib/onboarding/platform-tour";

export type ProfileOnboardingState = {
  profileId: string;
  firstName: string | null;
  lastName: string | null;
  hasAcceptedTerms: boolean;
  hasCurrentTerms: boolean;
  hasRequiredConsents: boolean;
  onboardingDismissedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingTourVersion: string;
  bannerDismissedAt: string | null;
  needsProfileGate: boolean;
  needsConsentGate: boolean;
  showPlatformTour: boolean;
  showSuccessBanner: boolean;
};

export function profileOnboardingStateFromRow(profile: ProfileRow): ProfileOnboardingState {
  const needsProfileGate = !profile.first_name?.trim();
  const hasRequiredConsents = Boolean(
    profile.terms_accepted_at &&
      profile.health_data_consent_at &&
      profile.ai_consent_at,
  );
  const hasCurrentTerms = profile.terms_version === CURRENT_TERMS_VERSION;
  const needsConsentGate = !needsProfileGate && (!hasRequiredConsents || !hasCurrentTerms);
  const onboardingTourVersion = profile.onboarding_tour_version || CURRENT_PLATFORM_TOUR_VERSION;
  const hasCurrentTourDecision =
    onboardingTourVersion === CURRENT_PLATFORM_TOUR_VERSION &&
    Boolean(profile.onboarding_dismissed_at || profile.onboarding_completed_at);
  const showPlatformTour =
    !needsProfileGate && !needsConsentGate && !hasCurrentTourDecision;
  const showSuccessBanner =
    !needsProfileGate &&
    !needsConsentGate &&
    onboardingTourVersion === CURRENT_PLATFORM_TOUR_VERSION &&
    Boolean(profile.onboarding_completed_at) &&
    !profile.dashboard_preferences?.banner_dismissed_at;

  return {
    profileId: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    hasAcceptedTerms: Boolean(profile.terms_accepted_at),
    hasCurrentTerms,
    hasRequiredConsents,
    onboardingDismissedAt: profile.onboarding_dismissed_at,
    onboardingCompletedAt: profile.onboarding_completed_at,
    onboardingTourVersion,
    bannerDismissedAt: profile.dashboard_preferences?.banner_dismissed_at ?? null,
    needsProfileGate,
    needsConsentGate,
    showPlatformTour,
    showSuccessBanner,
  };
}
