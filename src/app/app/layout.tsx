import { redirect } from "next/navigation";
import { getSessionProfileId } from "@/lib/auth/session";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    redirect("/?signin=required");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="mx-auto flex max-w-7xl">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
