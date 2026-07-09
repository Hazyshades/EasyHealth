import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import { getProfileOnboardingState } from "@/lib/auth/onboarding";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const origin = url.origin;

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchange failed:", error.message);
      return NextResponse.redirect(
        `${origin}/?signin=error&message=${encodeURIComponent(error.message)}`
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        const profileId = await ensureProfile(user);
        const onboarding = await getProfileOnboardingState(profileId);

        if (next && next.startsWith("/") && !next.startsWith("//")) {
          return NextResponse.redirect(`${origin}${next}`);
        }
        if (onboarding.needsProfileGate) {
          return NextResponse.redirect(`${origin}/onboarding/profile`);
        }
        if (onboarding.needsConsentGate) {
          return NextResponse.redirect(`${origin}/onboarding/consent`);
        }
        return NextResponse.redirect(`${origin}/app`);
      } catch (e) {
        console.error("[auth/callback] ensureProfile failed:", e);
        return NextResponse.redirect(`${origin}/app`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/?signin=error`);
}
