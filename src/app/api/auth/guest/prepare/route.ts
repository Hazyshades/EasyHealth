import { NextResponse } from "next/server";
import {
  assertGuestModeEnabled,
  getGuestPolicy,
  isGuestCreationConfigured,
} from "@/lib/guest-policy";

export async function POST() {
  try {
    assertGuestModeEnabled();
    const policy = getGuestPolicy();
    if (!isGuestCreationConfigured(policy)) {
      return NextResponse.json(
        { error: "Guest sign-in is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { allowed: true },
      { headers: { "Cache-Control": "no-store" } },
    );
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
