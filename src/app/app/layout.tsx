import { redirect } from "next/navigation";
import { getSessionProfileIdEnsured } from "@/lib/auth/session";
import { getProfileOnboardingState } from "@/lib/auth/onboarding";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Ensure profile row once per app shell entry; API routes use slim getSessionProfileId.
  const profileId = await getSessionProfileIdEnsured();
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
