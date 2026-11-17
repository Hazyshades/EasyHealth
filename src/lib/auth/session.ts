import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile, getProfileById } from "@/lib/auth/profile";
import {
  isActiveGuestProfileSession,
  isGuestProductAccessAllowed,
} from "@/lib/guest-mode";

export class ProfileSetupError extends Error {
  constructor() {
    super("Profile setup unavailable");
    this.name = "ProfileSetupError";
  }
}

const getSessionUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

/**
 * Resolve a signed-in profile id for product routes.
 *
 * Standard profiles are returned after authentication. Guest profiles must
 * still be active and complete both onboarding gates before product data is
 * exposed, including after a guest links an email or Google identity.
 */
export const getSessionProfileId = cache(async (): Promise<string | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    const profile = await getProfileById(user.id);
    if (profile.account_type !== "guest") return user.id;
    return isGuestProductAccessAllowed(profile) ? user.id : null;
  } catch {
    return null;
  }
});

/**
 * Resolve the signed-in profile id for the auth entry and onboarding gates.
 * This intentionally does not require a completed guest name or consent.
 */
export const getSessionProfileIdForOnboarding = cache(
  async (): Promise<string | null> => {
    const user = await getSessionUser();
    if (!user) return null;
    try {
      const profile = await getProfileById(user.id);
      if (
        profile.account_type === "guest" &&
        !isActiveGuestProfileSession(profile)
      ) {
        return null;
      }
      return user.id;
    } catch {
      return null;
    }
  },
);

/**
 * Like {@link getSessionProfileIdForOnboarding}, but ensures a
 * public.profiles row exists. Use only on auth entry / onboarding layout —
 * never on `/app/*` or API reads.
 */
export async function getSessionProfileIdEnsured(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    await ensureProfile(user);
    return await getSessionProfileIdForOnboarding();
  } catch (error) {
    const details =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { value: error };
    console.error("[auth] ensureProfile failed:", details);
    throw new ProfileSetupError();
  }
}

export async function clearSession() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
