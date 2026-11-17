import { createAdminClient } from "@/lib/supabase/admin";

export async function recordGuestActivity(profileId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc(
    "touch_guest_profile_activity",
    { p_profile_id: profileId, p_now: new Date().toISOString() },
  );
  if (error) throw new Error(`guest_activity_failed:${error.message}`);
  return data === true;
}
