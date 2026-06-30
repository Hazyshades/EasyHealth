import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const profile = await getProfileById(profileId);
    const supabase = createAdminClient();
    const { data: observations } = await supabase
      .from("observations")
      .select("*, documents(id, original_filename)")
      .eq("profile_id", profileId)
      .order("observed_at", { ascending: false });

    return NextResponse.json({
      authenticated: true,
      profile,
      observations: observations ?? [],
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
