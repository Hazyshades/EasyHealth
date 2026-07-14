import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import {
  assertDocumentOwner,
  resolveDisplayProcessingStatus,
} from "@/lib/documents/access";
import { validateObservationFallbackConfirmation } from "@/lib/documents/biomarker-review-state";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { observationIds?: unknown };
  const observationIds = Array.isArray(body.observationIds)
    ? body.observationIds.filter((value): value is string => typeof value === "string")
    : [];

  const supabase = createAdminClient();
  const [observationsResult, extractedResult] = await Promise.all([
    supabase
      .from("observations")
      .select("id")
      .eq("profile_id", profileId)
      .eq("document_id", id),
    supabase
      .from("document_extracted_biomarkers")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("document_id", id)
      .eq("is_current", true)
      .in("status", ["needs_review", "pending_review"]),
  ]);

  const validation = validateObservationFallbackConfirmation({
    documentStatus: resolveDisplayProcessingStatus(doc!),
    submittedObservationIds: observationIds,
    linkedObservationIds: (observationsResult.data ?? []).map((row) => row.id),
    reviewableExtractedCount: extractedResult.count ?? 0,
    reviewDataQueryFailed: Boolean(observationsResult.error || extractedResult.error),
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const { data: updatedDocument, error: updateError } = await supabase
    .from("documents")
    .update({ processing_status: "ready", status: "completed" })
    .eq("id", id)
    .eq("profile_id", profileId)
    .eq("processing_status", "needs_review")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updatedDocument) {
    return NextResponse.json({ error: "Document review state changed" }, { status: 409 });
  }

  return NextResponse.json({
    confirmedObservationIds: observationIds,
    processingStatus: "ready",
  });
}
