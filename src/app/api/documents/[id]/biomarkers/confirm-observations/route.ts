import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import {
  assertDocumentOwner,
  resolveDisplayProcessingStatus,
} from "@/lib/documents/access";
import { validateObservationFallbackConfirmation } from "@/lib/documents/biomarker-review-state";
import { getActiveNormalizationRevision } from "@/lib/documents/normalization-revisions";
import {
  buildManualCorrectionResolution,
  measurementInputFromWriterRow,
  type ExtractedBiomarkerWriterRow,
  writeExtractedBiomarkerNormalization,
} from "@/lib/documents/observation-normalization-writer";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

type SourceLinkedObservation = {
  id: string;
  source_extracted_biomarker_id: string | null;
};

type ConfirmationFailure = {
  observationId: string;
  error: string;
};

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
      .select("id, source_extracted_biomarker_id")
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

  const observations = (observationsResult.data ?? []) as SourceLinkedObservation[];
  const validation = validateObservationFallbackConfirmation({
    documentStatus: resolveDisplayProcessingStatus(doc!),
    submittedObservationIds: observationIds,
    linkedObservationIds: observations.map((row) => row.id),
    reviewableExtractedCount: extractedResult.count ?? 0,
    reviewDataQueryFailed: Boolean(observationsResult.error || extractedResult.error),
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  if (observations.some((observation) => !observation.source_extracted_biomarker_id)) {
    return NextResponse.json(
      {
        error:
          "A legacy observation has no extracted source and cannot be confirmed through the Registry 2.0 writer. Reprocess this document before confirming it.",
      },
      { status: 409 }
    );
  }

  const sourceIds = observations.map(
    (observation) => observation.source_extracted_biomarker_id!
  );
  const { data: sourceRows, error: sourceError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, confidence, specimen, modifier, source_page, source_text, bounding_box, reported_alt_value, reported_alt_unit, raw_value_text, processing_version"
    )
    .eq("document_id", id)
    .eq("profile_id", profileId)
    .eq("is_current", true)
    .in("id", sourceIds);
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });

  const sourceRowsById = new Map(
    ((sourceRows ?? []) as unknown as ExtractedBiomarkerWriterRow[]).map((row) => [
      row.id,
      row,
    ])
  );
  const confirmedObservationIds: string[] = [];
  const failures: ConfirmationFailure[] = [];
  const observedAt = doc!.observed_at ?? new Date().toISOString().slice(0, 10);

  for (const observation of observations) {
    const sourceRow = sourceRowsById.get(observation.source_extracted_biomarker_id!);
    if (!sourceRow) {
      failures.push({
        observationId: observation.id,
        error: "The source extraction is not available for Registry 2.0 confirmation",
      });
      continue;
    }

    try {
      const activeRevision = await getActiveNormalizationRevision(sourceRow.id);
      if (!activeRevision?.measurement_definition_key) {
        throw new Error(
          "This observation has no reviewed concrete Registry 2.0 definition to confirm"
        );
      }
      const resolution = buildManualCorrectionResolution({
        input: measurementInputFromWriterRow(sourceRow),
        selectedDefinitionKey: activeRevision.measurement_definition_key,
      });
      await writeExtractedBiomarkerNormalization({
        profileId,
        documentId: id,
        observedAt,
        row: sourceRow,
        actorId: profileId,
        writeKind: "correction",
        resolution,
        expectedActiveRevision: activeRevision,
        correctionReason: "Observation confirmation",
        supersedesRevisionId: activeRevision.id,
      });
      confirmedObservationIds.push(observation.id);
    } catch (writerError) {
      failures.push({
        observationId: observation.id,
        error:
          writerError instanceof Error
            ? writerError.message
            : "Registry 2.0 observation confirmation failed",
      });
    }
  }

  if (failures.length) {
    return NextResponse.json(
      {
        confirmedObservationIds,
        failures,
        processingStatus: "needs_review",
      },
      { status: 207 }
    );
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
    confirmedObservationIds,
    processingStatus: "ready",
  });
}
