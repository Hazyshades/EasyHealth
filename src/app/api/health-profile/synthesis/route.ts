import { NextResponse } from "next/server";
import { getWritableSessionIdentity } from "@/lib/auth/identity";
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
