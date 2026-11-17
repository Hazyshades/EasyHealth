import { NextResponse } from "next/server";
import { getWritableSessionIdentity } from "@/lib/auth/identity";
import { getProfileById } from "@/lib/auth/profile";
import { isGuestProductAccessAllowed } from "@/lib/guest-mode";
import { GuestQuotaError, reserveGuestResource } from "@/lib/guest-quotas";
import { forceRegenerateHolisticSynthesis } from "@/lib/holistic-synthesis";
export async function POST() {
  const identity = await getWritableSessionIdentity();
  const profileId = identity?.profileId ?? null;
  if (!identity || !profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
          { status: error.kind === "limit" ? 429 : 503 },
        );
      }
      return NextResponse.json(
        { error: "Guest processing quota unavailable" },
        { status: 503 },
      );
    }
  }
  if (identity.isGuest) {
    const currentProfile = await getProfileById(profileId);
    if (!isGuestProductAccessAllowed(currentProfile)) {
      return NextResponse.json(
        { error: "Guest session is no longer active" },
        { status: 409 },
      );
    }
  }

  const synthesis = await forceRegenerateHolisticSynthesis(profileId);
  if (!synthesis) {
    return NextResponse.json(
      { error: "No structured documents available for synthesis" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    synthesis_text: synthesis.text,
    generated_at: synthesis.generated_at,
    source_document_ids: synthesis.source_document_ids,
    disclaimer: synthesis.disclaimer,
  });
}

export const maxDuration = 60;
