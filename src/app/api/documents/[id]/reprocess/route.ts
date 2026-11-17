import { NextRequest, NextResponse } from "next/server";
import { getWritableSessionIdentity } from "@/lib/auth/identity";
import { assertDocumentOwner } from "@/lib/documents/access";
import { enqueueFullPipelineJob } from "@/lib/documents/jobs";
import { GuestQuotaError, reserveGuestResource } from "@/lib/guest-quotas";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDocumentReprocessTypeOverride } from "@/lib/documents/reprocess-policy";
import {
  assertReviewModeActionAllowed,
  ReviewModePolicyError,
} from "@/lib/documents/review-mode-policy";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const identity = await getWritableSessionIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profileId = identity.profileId;

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;
  if (doc!.document_type === "lab_result") {
    try {
      assertReviewModeActionAllowed(doc!, "reprocess");
    } catch (policyError) {
      if (policyError instanceof ReviewModePolicyError) {
        return NextResponse.json(
          { error: policyError.message, code: policyError.code },
          { status: policyError.status },
        );
      }
      throw policyError;
    }
  }

  let requestBody: unknown = null;
  try {
    requestBody = await req.json();
  } catch {
    // empty body is fine
  }
  const documentTypeOverride = getDocumentReprocessTypeOverride(requestBody);
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
      .eq("id", id)
      .eq("profile_id", profileId)
      .eq("lifecycle_state", "active")
      .eq("upload_state", "complete");
  } else {
    await supabase
      .from("documents")
      .update({
        type_mismatch_warning: false,
        type_mismatch_reason: null,
      })
      .eq("id", id)
      .eq("profile_id", profileId)
      .eq("lifecycle_state", "active")
      .eq("upload_state", "complete");
  }


  await enqueueFullPipelineJob(profileId, id);

  return NextResponse.json({
    ok: true,
    processingStatus: "processing",
    document_type: documentTypeOverride ?? doc!.document_type,
  });
}
