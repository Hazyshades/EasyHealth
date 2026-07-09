import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";

/** @deprecated Legacy cookie name; no longer used for authentication. */
export const SESSION_COOKIE = "eh_profile_id";

/**
 * Resolve the signed-in profile id from the Supabase Auth session.
 * Profile id equals auth.users.id. Ensures a profiles row exists.
 */
export async function getSessionProfileId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    return await ensureProfile(user);
  } catch (error) {
    console.error("[auth] ensureProfile failed:", error);
    return user.id;
  }
}

export async function clearSession() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
