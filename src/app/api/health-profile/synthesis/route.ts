import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { forceRegenerateHolisticSynthesis } from "@/lib/holistic-synthesis";

export async function POST() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
