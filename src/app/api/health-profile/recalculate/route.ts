import { NextResponse } from "next/server";
import { getWritableSessionIdentity } from "@/lib/auth/identity";
import { GuestQuotaError, reserveGuestResource } from "@/lib/guest-quotas";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST() {
  const identity = await getWritableSessionIdentity();
  const profileId = identity?.profileId ?? null;
  if (!identity || !profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (identity.isGuest) {
    try {
      await reserveGuestResource(profileId, "processing_count", 1);
    } catch (error) {
      if (error instanceof GuestQuotaError) {
        return NextResponse.json(
          {
            error:
              error.kind === "limit"
                ? "Guest processing quota exceeded"
                : "Guest processing quota unavailable",
          },
          {
            status: error.kind === "limit" ? 429 : 503,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }
      return NextResponse.json(
        { error: "Guest processing quota unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  const { error } = await createAdminClient().rpc("retry_assessment_recalculation_job", {
    p_profile_id: profileId,
  });
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({ status: "queued" }, { headers: { "Cache-Control": "no-store" } });
}