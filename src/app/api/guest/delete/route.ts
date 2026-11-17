import { NextResponse } from "next/server";
import { getGuestSessionIdentity } from "@/lib/auth/identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const identity = await getGuestSessionIdentity();
  if (!identity) {
    return NextResponse.json(
      { error: "Guest session required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await createAdminClient().rpc(
    "request_guest_profile_deletion",
    { p_profile_id: identity.profileId, p_reason: "explicit" },
  );
  if (error) {
    const message = error.message.toLowerCase();
    const status = message.includes("converted")
      ? 409
      : message.includes("not_found") || message.includes("already_deleted")
        ? 404
        : 503;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "This account has already been saved"
            : status === 404
              ? "Guest profile is not available"
              : "Guest deletion is temporarily unavailable",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
  const operation = Array.isArray(data) ? data[0] : data;

  if (!operation?.operation_id) {
    return NextResponse.json(
      { error: "Guest deletion is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const supabase = await createServerSupabaseClient();
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.warn("[guest] server session sign-out failed after deletion request");
  }

  return NextResponse.json(
    {
      operation_id: operation?.operation_id ?? null,
      status: operation?.operation_status ?? "queued",
      signed_out: !signOutError,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
