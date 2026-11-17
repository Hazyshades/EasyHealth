import { NextResponse } from "next/server";
import { isActiveGuestProfileSession } from "@/lib/guest-mode";
import { getGuestSessionIdentity } from "@/lib/auth/identity";
import { recordGuestActivity } from "@/lib/guest-activity";
export async function POST() {
  const identity = await getGuestSessionIdentity();
  if (!identity || !isActiveGuestProfileSession(identity.profile)) {
    return NextResponse.json(
      { error: "Guest session is no longer active" },
      { status: identity ? 409 : 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const updated = await recordGuestActivity(identity.profileId);
    return NextResponse.json(
      { updated },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error(
      "[guest] activity update failed error=guest_activity_update_failed",
    );
    return NextResponse.json(
      { error: "Guest activity is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
