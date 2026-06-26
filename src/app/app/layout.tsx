import { redirect } from "next/navigation";
import { getSessionProfileId } from "@/lib/auth/session";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    redirect("/?signin=required");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
