import { redirect } from "next/navigation";
import { resolveAppShellRedirect } from "@/lib/auth/app-shell-gate";
import { getProfileOnboardingStateIfPresent } from "@/lib/auth/onboarding";
import { getSessionProfileId } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profileId = await getSessionProfileId();
  const onboarding = profileId
    ? await getProfileOnboardingStateIfPresent(profileId)
    : null;
  const destination = resolveAppShellRedirect({ profileId, onboarding });
  if (destination) {
    redirect(destination);
  }

  return <AppShell>{children}</AppShell>;
}
