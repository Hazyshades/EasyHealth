import { redirect } from "next/navigation";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileOnboardingState } from "@/lib/auth/onboarding";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    redirect("/?signin=required");
  }

  const onboarding = await getProfileOnboardingState(profileId);
  if (onboarding.needsProfileGate) {
    redirect("/onboarding/profile");
  }
  if (onboarding.needsConsentGate) {
    redirect("/onboarding/consent");
  }

  return <AppShell>{children}</AppShell>;
}
