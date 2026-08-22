import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";

/** @deprecated Legacy cookie name; no longer used for authentication. */
export const SESSION_COOKIE = "eh_profile_id";

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
 * Hot path: does not touch the profiles table. Profile row creation is
 * confined to `/auth/callback` and the onboarding layout via
 * {@link getSessionProfileIdEnsured}. Memoized per App Router request so
 * layout and server page data share one `auth.getUser`.
 */
export const getSessionProfileId = cache(async (): Promise<string | null> => {
  const user = await getSessionUser();
  return user?.id ?? null;
});

/**
 * Like {@link getSessionProfileId}, but ensures a public.profiles row exists.
 * Use only on auth entry / onboarding layout — never on `/app/*` or API reads.
 */
export async function getSessionProfileIdEnsured(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    return await ensureProfile(user);
  } catch (error) {
    const details =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { value: error };
    console.error("[auth] ensureProfile failed:", details);
    return user.id;
  }
}

export async function clearSession() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
