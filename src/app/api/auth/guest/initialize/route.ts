import { NextResponse } from "next/server";
import {
  isActiveGuestProfileSession,
  isAnonymousAuthUser,
  type GuestDeletionState,
} from "@/lib/guest-mode";
import {
  assertGuestModeEnabled,
  getGuestPolicy,
  guestCreationKey,
  isGuestCreationConfigured,
} from "@/lib/guest-policy";
import {
  ensureProfile,
  getProfileById,
} from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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

    const policy = getGuestPolicy();
    const key = guestCreationKey(request);
    if (!key || !isGuestCreationConfigured(policy)) {
      return NextResponse.json(
        { error: "Guest sign-in is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const { data: reservation, error: throttleError } = await admin.rpc(
      "reserve_guest_creation",
      {
        p_key_hash: key,
        p_limit: policy.creationLimit,
        p_window_seconds: policy.creationWindowSeconds,
      },
    );
    if (throttleError) {
      console.error(
        "[guest] creation throttle failed error=guest_creation_throttle_failed",
      );
      return NextResponse.json(
        { error: "Guest sign-in is temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const row = Array.isArray(reservation) ? reservation[0] : reservation;
    if (!row?.allowed) {
      const retryRaw = Number(row?.retry_after_seconds ?? 60);
      const retryAfter = Number.isFinite(retryRaw)
        ? Math.max(1, Math.floor(retryRaw))
        : 60;
      console.info(`[guest] creation status=blocked retry_after=${retryAfter}`);
      return NextResponse.json(
        {
          error: "Too many guest sessions were requested. Try again later.",
          retry_after_seconds: retryAfter,
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }

    const profileId = await ensureProfile(user);
    const profile = await getProfileById(profileId);
    if (!isActiveGuestProfileSession(profile)) {
      return NextResponse.json(
        { error: "Guest profile is unavailable" },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.info("[guest] creation status=allowed");
    return NextResponse.json(
      { profile_id: profile.id, is_guest: true },
      { headers: { "Cache-Control": "no-store" } },
    );
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
