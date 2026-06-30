import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner } from "@/lib/documents/access";
import { enqueueFullPipelineJob } from "@/lib/documents/jobs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  await enqueueFullPipelineJob(profileId, id);

  return NextResponse.json({ ok: true, processingStatus: "processing" });
}
