import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import { getProfileOnboardingState } from "@/lib/auth/onboarding";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");
  const origin = url.origin;
  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchange failed:", error.message);
      return signInErrorRedirect(origin, error.message);
    }
  } else if (tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error("[auth/callback] token verification failed:", error.message);
      return signInErrorRedirect(origin, error.message);
    }
  } else {
    return signInErrorRedirect(origin);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return signInErrorRedirect(origin);

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
  } catch (error) {
    console.error("[auth/callback] ensureProfile failed:", error);
    return NextResponse.redirect(`${origin}/app`);
  }
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && EMAIL_OTP_TYPES.has(value as EmailOtpType);
}

function signInErrorRedirect(origin: string, message?: string): NextResponse {
  const errorURL = new URL("/", origin);
  errorURL.searchParams.set("signin", "error");
  if (message) errorURL.searchParams.set("message", message);
  return NextResponse.redirect(errorURL);
}
