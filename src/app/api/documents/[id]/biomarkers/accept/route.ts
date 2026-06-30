import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner } from "@/lib/documents/access";
import {
  acceptExtractedBiomarkers,
  BiomarkerAcceptanceError,
} from "@/lib/documents/biomarker-acceptance";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const body = (await req.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((v) => typeof v === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No biomarker ids provided" }, { status: 400 });
  }

  const observedAt = doc!.observed_at ?? new Date().toISOString().slice(0, 10);

  try {
    const result = await acceptExtractedBiomarkers({
      profileId,
      documentId: id,
      observedAt,
      ids,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BiomarkerAcceptanceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
