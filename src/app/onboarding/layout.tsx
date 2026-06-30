import { redirect } from "next/navigation";
import { getSessionProfileId } from "@/lib/auth/session";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    redirect("/?signin=required");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
