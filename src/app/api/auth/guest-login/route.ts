import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolveAuthCallbackPath } from "@/lib/auth/callback-redirect";
import { getProfileOnboardingState } from "@/lib/auth/onboarding";
import { ensureProfile } from "@/lib/auth/profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const SHARED_GUEST_ACCOUNT = {
  email: "gold60822@gmail.com",
  profileId: "60d02797-910b-43a9-beb9-0a52fe0f6067",
};

function guestLoginFailure(origin: string) {
  const response = NextResponse.redirect(
    new URL("/login?signin=error&reason=guest-login", origin),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isSharedGuestAccount(user: { id: string; email?: string | null }) {
  return (
    user.id === SHARED_GUEST_ACCOUNT.profileId &&
    user.email?.toLowerCase() === SHARED_GUEST_ACCOUNT.email
  );
}

export async function POST(request: Request) {
  const appOrigin = new URL(env.URL).origin;
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const requestHost = request.headers.get("host")?.trim().toLowerCase();
  let originUrl: URL | null = null;
  if (origin) {
    try {
      originUrl = new URL(origin);
    } catch {
      originUrl = null;
    }
  }
  const isDevelopmentLoopback =
    process.env.NODE_ENV === "development" &&
    originUrl !== null &&
    origin === originUrl.origin &&
    originUrl.host === requestHost &&
    originUrl.protocol === requestUrl.protocol &&
    ["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname);
  const redirectOrigin =
    isDevelopmentLoopback && originUrl ? originUrl.origin : appOrigin;

  if (origin !== appOrigin && !isDevelopmentLoopback) {
    return guestLoginFailure(appOrigin);
  }

  try {
    const admin = createAdminClient();
    const { data: accountData, error: accountError } =
      await admin.auth.admin.getUserById(SHARED_GUEST_ACCOUNT.profileId);

    if (
      accountError ||
      !accountData.user ||
      !isSharedGuestAccount(accountData.user)
    ) {
      return guestLoginFailure(redirectOrigin);
    }

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: SHARED_GUEST_ACCOUNT.email,
      });

    if (
      linkError ||
      !linkData ||
      !isSharedGuestAccount(linkData.user) ||
      !linkData.properties.hashed_token
    ) {
      return guestLoginFailure(redirectOrigin);
    }

    const auth = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: verified, error: verificationError } =
      await auth.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      });

    if (
      verificationError ||
      !verified.session ||
      !verified.user ||
      !isSharedGuestAccount(verified.user)
    ) {
      return guestLoginFailure(redirectOrigin);
    }

    const profileId = await ensureProfile(verified.user);
    const onboarding = await getProfileOnboardingState(profileId);
    const serverAuth = await createServerSupabaseClient();
    const { error: sessionError } = await serverAuth.auth.setSession({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    });

    if (sessionError) return guestLoginFailure(redirectOrigin);

    const destination = resolveAuthCallbackPath({
      hasCode: true,
      exchangeFailed: false,
      userId: verified.user.id,
      ensureFailed: false,
      next: null,
      needsProfileGate: onboarding.needsProfileGate,
      needsConsentGate: onboarding.needsConsentGate,
    });
    const response = NextResponse.redirect(
      new URL(destination, redirectOrigin),
      303,
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return guestLoginFailure(redirectOrigin);
  }
}
