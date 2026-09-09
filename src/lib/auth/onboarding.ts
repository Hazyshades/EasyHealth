import { findProfileById, getProfileById } from "@/lib/auth/profile";
import {
  profileOnboardingStateFromRow,
  type ProfileOnboardingState,
} from "@/lib/auth/onboarding-state";

export { profileOnboardingStateFromRow } from "@/lib/auth/onboarding-state";
export type { ProfileOnboardingState } from "@/lib/auth/onboarding-state";

export async function getProfileOnboardingState(
  profileId: string,
): Promise<ProfileOnboardingState> {
  const profile = await getProfileById(profileId);
  return profileOnboardingStateFromRow(profile);
}

export async function getProfileOnboardingStateIfPresent(
  profileId: string,
): Promise<ProfileOnboardingState | null> {
  const profile = await findProfileById(profileId);
  if (!profile) return null;
  return profileOnboardingStateFromRow(profile);
}
