import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile, getProfileById } from "@/lib/auth/profile";
import { isActiveGuestProfileSession, isAnonymousAuthUser } from "@/lib/guest-mode";

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
 * Resolve the signed-in profile id from the Supabase Auth session.
 * Profile id equals auth.users.id.
 *
 * Standard sessions do not touch the profiles table on this hot path.
 * Anonymous sessions perform a read-only guest lifecycle check so expired or
 * deleting profiles cannot access patient data. Profile row creation is
 * confined to `/auth/callback` and the onboarding layout via
 * {@link getSessionProfileIdEnsured}. Memoized per App Router request so
 * layout and server page data share one `auth.getUser`.
 */
export const getSessionProfileId = cache(async (): Promise<string | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  if (!isAnonymousAuthUser(user)) return user.id;

  try {
    const profile = await getProfileById(user.id);
    return isActiveGuestProfileSession(profile) ? user.id : null;
  } catch {
    return null;
  }
});

/**
 * Like {@link getSessionProfileId}, but ensures a public.profiles row exists.
 * Use only on auth entry / onboarding layout — never on `/app/*` or API reads.
 */
export async function getSessionProfileIdEnsured(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    await ensureProfile(user);
    return await getSessionProfileId();
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
