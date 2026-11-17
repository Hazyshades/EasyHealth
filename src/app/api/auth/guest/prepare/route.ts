import { NextRequest, NextResponse } from "next/server";
import {
  assertGuestModeEnabled,
  GUEST_CREATION_TICKET_COOKIE,
  GUEST_CREATION_TICKET_TTL_SECONDS,
  getGuestPolicy,
  guestCreationKey,
  isGuestCreationConfigured,
} from "@/lib/guest-policy";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    assertGuestModeEnabled();
    const policy = getGuestPolicy();
    if (!isGuestCreationConfigured(policy)) {
      return NextResponse.json(
        { error: "Guest sign-in is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const key = guestCreationKey(request);
    if (!key) {
      return NextResponse.json(
        { error: "Guest sign-in is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data, error } = await createAdminClient().rpc(
      "reserve_guest_creation_ticket",
      {
        p_key_hash: key,
        p_limit: policy.creationLimit,
        p_window_seconds: policy.creationWindowSeconds,
        p_ttl_seconds: GUEST_CREATION_TICKET_TTL_SECONDS,
      },
    );
    if (error) {
      console.error(
        "[guest] creation throttle failed error=guest_creation_throttle_failed",
      );
      return NextResponse.json(
        { error: "Guest sign-in is temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.allowed || !row.ticket_id) {
      const retryRaw = Number(row?.retry_after_seconds ?? 60);
      const retryAfter = Number.isFinite(retryRaw)
        ? Math.max(1, Math.floor(retryRaw))
        : 60;
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

    const response = NextResponse.json(
      { allowed: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set({
      name: GUEST_CREATION_TICKET_COOKIE,
      value: String(row.ticket_id),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: GUEST_CREATION_TICKET_TTL_SECONDS,
      path: "/",
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "GuestModeDisabledError") {
      return NextResponse.json(
        { error: "Guest mode is not available" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(
      "[guest] creation configuration unavailable error=guest_creation_configuration_unavailable",
    );
    return NextResponse.json(
      { error: "Guest sign-in is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
