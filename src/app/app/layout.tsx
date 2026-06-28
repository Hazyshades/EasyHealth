import { redirect } from "next/navigation";
import { getSessionProfileId } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    redirect("/?signin=required");
  }

  return <AppShell>{children}</AppShell>;
}
