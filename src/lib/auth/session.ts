import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";

/** @deprecated Legacy cookie name; no longer used for authentication. */
export const SESSION_COOKIE = "eh_profile_id";

/**
 * Resolve the signed-in profile id from the Supabase Auth session.
 * Profile id equals auth.users.id.
 *
 * Hot path: does not touch the profiles table. Profile row creation is
 * ensured at auth callback and app/onboarding layouts via
 * {@link getSessionProfileIdEnsured}.
 */
export async function getSessionProfileId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return user.id;
}

/**
 * Like {@link getSessionProfileId}, but ensures a public.profiles row exists.
 * Use only on auth entry / layout bootstrap — not on every API request.
 */
export async function getSessionProfileIdEnsured(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
