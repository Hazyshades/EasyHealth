import { NextResponse } from "next/server";
import {
  isActiveGuestProfileSession,
  isAnonymousAuthUser,
} from "@/lib/guest-mode";
import { getSessionIdentity } from "@/lib/auth/identity";
import { completeGuestConversion } from "@/lib/auth/profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const identity = await getSessionIdentity();
  if (!identity) {
    return NextResponse.json(
      { error: "Guest profile is unavailable" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!identity.isGuest) {
    return NextResponse.json(
      {
        profile_id: identity.profileId,
        account_type: identity.profile.account_type,
        guest_converted_at: identity.profile.guest_converted_at,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (identity.profile.guest_deletion_state !== "active") {
    return NextResponse.json(
      { error: "Guest data deletion is already in progress" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isActiveGuestProfileSession(identity.profile)) {
    return NextResponse.json(
      { error: "Guest retention window has ended" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (isAnonymousAuthUser(user)) {
    return NextResponse.json(
      { ready: true, profile_id: identity.profileId },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const profile = await completeGuestConversion(user);
    if (!profile) {
      return NextResponse.json(
        { error: "Complete email or Google verification before saving data" },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        profile_id: profile.id,
        account_type: profile.account_type,
        guest_converted_at: profile.guest_converted_at,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[guest] conversion failed error=guest_conversion_failed");
    return NextResponse.json(
      { error: "Guest conversion is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
