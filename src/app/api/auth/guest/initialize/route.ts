import { NextRequest, NextResponse } from "next/server";
import {
  isActiveGuestProfileSession,
  isAnonymousAuthUser,
  type GuestDeletionState,
} from "@/lib/guest-mode";
import {
  assertGuestModeEnabled,
  GUEST_CREATION_TICKET_COOKIE,
} from "@/lib/guest-policy";
import {
  ensureProfile,
  getProfileById,
} from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    assertGuestModeEnabled();
  } catch (error) {
    if (error instanceof Error && error.name === "GuestModeDisabledError") {
      return NextResponse.json(
        { error: "Guest mode is not available" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(
      "[guest] profile initialization unavailable error=guest_configuration_unavailable",
    );
    return NextResponse.json(
      { error: "Guest sign-in is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

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
  if (!isAnonymousAuthUser(user)) {
    return NextResponse.json(
      { error: "Anonymous guest session required" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const admin = createAdminClient();
    const existingResult = await admin
      .from("profiles")
      .select(
        "id, account_type, guest_deletion_state, guest_converted_at, guest_expires_at",
      )
      .eq("id", user.id)
      .maybeSingle();
    if (existingResult.error) throw existingResult.error;
    if (existingResult.data?.id) {
      const existing = existingResult.data as {
        id: string;
        account_type: string;
        guest_deletion_state: GuestDeletionState;
        guest_converted_at: string | null;
        guest_expires_at: string | null;
      };
      if (isActiveGuestProfileSession(existing)) {
        return NextResponse.json(
          { profile_id: existing.id, is_guest: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      return NextResponse.json(
        { error: "Guest profile is unavailable" },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const ticketId = request.cookies.get(GUEST_CREATION_TICKET_COOKIE)?.value;
    if (!ticketId) {
      return NextResponse.json(
        { error: "Guest sign-in preflight is required" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: consumed, error: consumeError } = await admin.rpc(
      "consume_guest_creation_ticket",
      { p_ticket_id: ticketId },
    );
    if (consumeError || consumed !== true) {
      console.error(
        "[guest] creation ticket failed error=guest_creation_ticket_invalid",
      );
      return NextResponse.json(
        { error: "Guest sign-in preflight expired. Try again." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const profileId = await ensureProfile(user, {
      allowAnonymousGuestCreation: true,
    });
    const profile = await getProfileById(profileId);
    if (!isActiveGuestProfileSession(profile)) {
      return NextResponse.json(
        { error: "Guest profile is unavailable" },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.info("[guest] creation status=allowed");
    const response = NextResponse.json(
      { profile_id: profile.id, is_guest: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set({
      name: GUEST_CREATION_TICKET_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch {
    console.error(
      "[guest] profile initialization failed error=guest_profile_initialization_failed",
    );
    return NextResponse.json(
      { error: "Guest profile is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isAnonymousAuthUser(user)) {
    return NextResponse.json(
      { error: "Anonymous guest session required" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error(
      "[guest] initialization cleanup failed error=guest_profile_lookup_failed",
    );
    return NextResponse.json(
      { error: "Guest cleanup is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (profile?.account_type === "guest") {
    const { error } = await admin.rpc("request_guest_profile_deletion", {
      p_profile_id: user.id,
      p_reason: "explicit",
    });
    if (error) {
      console.error(
        "[guest] initialization cleanup failed error=guest_deletion_request_failed",
      );
      return NextResponse.json(
        { error: "Guest cleanup is temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: true, profile_deletion_requested: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (profile) {
    return NextResponse.json(
      { error: "Guest profile cleanup is unavailable" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(
      "[guest] initialization cleanup failed error=guest_auth_cleanup_failed",
    );
    return NextResponse.json(
      { error: "Guest cleanup is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  await supabase.auth.signOut();
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
