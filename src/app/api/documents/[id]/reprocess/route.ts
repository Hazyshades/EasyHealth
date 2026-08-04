import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner } from "@/lib/documents/access";
import { enqueueFullPipelineJob } from "@/lib/documents/jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDocumentReprocessTypeOverride } from "@/lib/documents/reprocess-policy";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  let requestBody: unknown = null;
  try {
    requestBody = await req.json();
  } catch {
    // empty body is fine
  }
  const documentTypeOverride = getDocumentReprocessTypeOverride(requestBody);

  const supabase = createAdminClient();

  if (documentTypeOverride) {
    await supabase
      .from("documents")
      .update({
        document_type: documentTypeOverride,
        type_mismatch_warning: false,
        type_mismatch_reason: null,
        detected_document_type: null,
      })
      .eq("id", id);
  } else {
    await supabase
      .from("documents")
      .update({
        type_mismatch_warning: false,
        type_mismatch_reason: null,
      })
      .eq("id", id);
  }

  await enqueueFullPipelineJob(profileId, id);

  return NextResponse.json({
    ok: true,
    processingStatus: "processing",
    document_type: documentTypeOverride ?? doc!.document_type,
  });
}
