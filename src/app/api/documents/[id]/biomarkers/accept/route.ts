import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import {
  assertDocumentOwner,
  resolveDisplayProcessingStatus,
} from "@/lib/documents/access";
import { shouldCompleteDocumentReview } from "@/lib/documents/biomarker-review-state";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const observedAt = doc!.observed_at;

  try {
    const result = await acceptExtractedBiomarkers({
      profileId,
      documentId: id,
      observedAt,
      ids,
    });
    const currentProcessingStatus = resolveDisplayProcessingStatus(doc!);
    let processingStatus = currentProcessingStatus;

    if (result.failures.length === 0) {
      const supabase = createAdminClient();
      const { count, error: pendingReviewError } = await supabase
        .from("document_extracted_biomarkers")
        .select("id", { count: "exact", head: true })
        .eq("document_id", id)
        .eq("profile_id", profileId)
        .eq("is_current", true)
        .eq("is_published", true)
        .eq("record_status", "active")
        .in("status", ["needs_review", "pending_review"]);

      if (pendingReviewError) {
        throw new BiomarkerAcceptanceError(pendingReviewError.message);
      }

      if (
        shouldCompleteDocumentReview({
          documentStatus: currentProcessingStatus,
          reviewableExtractedCount: count ?? 0,
        })
      ) {
        const { error: updateError } = await supabase
          .from("documents")
          .update({ processing_status: "ready", status: "completed" })
          .eq("id", id)
          .eq("profile_id", profileId)
          .eq("processing_status", "needs_review");

        if (updateError) {
          throw new BiomarkerAcceptanceError(updateError.message);
        }
        processingStatus = "ready";
      }
    }

    return NextResponse.json(
      { ...result, processingStatus },
      {
        // A selected row may legitimately lose the v2 CAS while another row in
        // the same ids[] request commits its own independent transaction.
        status: result.failures.length ? 207 : 200,
      },
    );
  } catch (error) {
    if (error instanceof BiomarkerAcceptanceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
