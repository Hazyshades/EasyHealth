import { redirect } from "next/navigation";
import { getSessionProfileIdEnsured, ProfileSetupError } from "@/lib/auth/session";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  let profileId: string | null;
  try {
    profileId = await getSessionProfileIdEnsured();
  } catch (error) {
    if (error instanceof ProfileSetupError) {
      redirect("/?signin=error&reason=profile-setup");
    }
    throw error;
  }

  if (!profileId) {
    redirect("/?signin=required");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10 font-sans text-[#0F172A]">
      <style>{`
        button.eh-onboarding-cta {
          appearance: none;
          -webkit-appearance: none;
          display: inline-flex;
          height: 44px;
          width: 100%;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 14px;
          background-color: #4F46E5 !important;
          background-image: none !important;
          box-shadow: 0 10px 22px rgba(79, 70, 229, 0.24);
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          font-size: 14px;
          font-weight: 500;
          line-height: 1;
          opacity: 1 !important;
          cursor: pointer;
        }
        button.eh-onboarding-cta:hover,
        button.eh-onboarding-cta:focus-visible {
          background-color: #4338CA !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }
        button.eh-onboarding-cta:disabled {
          background-color: #4F46E5 !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
