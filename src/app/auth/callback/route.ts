import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAuthCallbackPath } from "@/lib/auth/callback-redirect";
import { ensureProfile, completeGuestConversion } from "@/lib/auth/profile";
import { getProfileOnboardingState } from "@/lib/auth/onboarding";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const origin = new URL(env.URL).origin;

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchange failed:", error.message);
      return NextResponse.redirect(
        `${origin}${resolveAuthCallbackPath({
          hasCode: true,
          exchangeFailed: true,
          userId: null,
          ensureFailed: false,
          next,
          needsProfileGate: false,
          needsConsentGate: false,
        })}`,
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        const profileId = await ensureProfile(user);
        const convertedProfile = await completeGuestConversion(user);
        if (convertedProfile) {
          console.info(
            `[guest] conversion status=completed profile=${convertedProfile.id}`,
          );
        }
        const onboarding = await getProfileOnboardingState(profileId);
        return NextResponse.redirect(
          `${origin}${resolveAuthCallbackPath({
            hasCode: true,
            exchangeFailed: false,
            userId: user.id,
            ensureFailed: false,
            next,
            needsProfileGate: onboarding.needsProfileGate,
            needsConsentGate: onboarding.needsConsentGate,
          })}`,
        );
      } catch {
        console.error(
          "[auth/callback] profile setup failed error=profile_setup_failed",
        );
        return NextResponse.redirect(
          `${origin}${resolveAuthCallbackPath({
            hasCode: true,
            exchangeFailed: false,
            userId: user.id,
            ensureFailed: true,
            next,
            needsProfileGate: false,
            needsConsentGate: false,
          })}`,
        );
      }
    }
  }

  return NextResponse.redirect(
    `${origin}${resolveAuthCallbackPath({
      hasCode: Boolean(code),
      exchangeFailed: false,
      userId: null,
      ensureFailed: false,
      next,
      needsProfileGate: false,
      needsConsentGate: false,
    })}`,
  );
}
