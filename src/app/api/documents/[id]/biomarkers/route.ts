import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDocumentOwner } from "@/lib/documents/access";
import {
  compatibleManualDefinitions,
  getActiveNormalizationRevision,
} from "@/lib/documents/normalization-revisions";
import {
  buildManualCorrectionResolution,
  measurementInputFromWriterRow,
  ObservationNormalizationWriterError,
  type ExtractedBiomarkerWriterRow,
  writeExtractedBiomarkerNormalization,
} from "@/lib/documents/observation-normalization-writer";
import {
  buildNormalizationReview,
  type NormalizationRevisionSummary,
} from "@/lib/documents/normalization-review";

type RouteContext = { params: Promise<{ id: string }> };

type ExtractedBiomarkerRow = ExtractedBiomarkerWriterRow;

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const supabase = createAdminClient();
  const { data: items, error: listError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, source_page, source_text, confidence, status, processing_version, extraction_model, specimen, modifier, reported_alt_value, reported_alt_unit, raw_value_text, measurement_definition_key, resolver_result, mapping_confidence, mapping_confidence_band, resolver_evidence, catalog_manifest_version, catalog_manifest_digest, resolver_version, normalization_version, verification_status, created_at"
    )
    .eq("document_id", id)
    .eq("profile_id", profileId)
    .eq("is_current", true)
    .order("biomarker_name", { ascending: true });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const rows = (items ?? []) as unknown as ExtractedBiomarkerRow[];
  const ids = rows.map((item) => item.id);
  const revisionsResult = ids.length
    ? await supabase
        .from("observation_normalization_revisions")
        .select(
          "id, extracted_biomarker_id, analyte_key, measurement_definition_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, is_active, catalog_manifest_version, resolver_version, normalization_version, created_at"
        )
        .in("extracted_biomarker_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>> };
  const revisionsByExtractedId = new Map<string, Array<Record<string, unknown>>>();
  for (const revision of revisionsResult.data ?? []) {
    const key = String(revision.extracted_biomarker_id);
    const entries = revisionsByExtractedId.get(key) ?? [];
    entries.push(revision as Record<string, unknown>);
    revisionsByExtractedId.set(key, entries);
  }
  return NextResponse.json({
    items: rows.map((row) => ({
      ...row,
      normalization: buildNormalizationReview(
        row,
        (revisionsByExtractedId.get(row.id) ?? []) as unknown as NormalizationRevisionSummary[]
      ),
    })),
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { doc, error: ownerError } = await assertDocumentOwner(profileId, id);
  if (ownerError) return ownerError;

  const body = (await req.json().catch(() => null)) as
    | {
        extractedBiomarkerId?: string;
        action?: "correct" | "undo";
        measurementDefinitionKey?: string;
        correctionReason?: string;
        revertToRevisionId?: string;
      }
    | null;
  if (!body?.extractedBiomarkerId || (body.action !== "correct" && body.action !== "undo")) {
    return NextResponse.json({ error: "Invalid normalization review request" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error: extractedError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, confidence, specimen, modifier, source_page, source_text, bounding_box, reported_alt_value, reported_alt_unit, raw_value_text, processing_version"
    )
    .eq("id", body.extractedBiomarkerId)
    .eq("document_id", id)
    .eq("profile_id", profileId)
    .eq("is_current", true)
    .maybeSingle();
  if (extractedError) return NextResponse.json({ error: extractedError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Extracted biomarker not found" }, { status: 404 });
  const row = data as ExtractedBiomarkerRow;

  const activeRevision = await getActiveNormalizationRevision(row.id);
  if (body.action === "undo" && (!body.revertToRevisionId || !activeRevision)) {
    return NextResponse.json({ error: "A compatible definition and active revision are required" }, { status: 400 });
  }

  let selectedDefinitionKey = body.measurementDefinitionKey;
  let reversalOfRevisionId: string | null = null;
  let correctionReason = body.correctionReason ?? null;

  if (body.action === "undo") {
    const { data: revertRevision, error: revertError } = await supabase
      .from("observation_normalization_revisions")
      .select("id, measurement_definition_key")
      .eq("id", body.revertToRevisionId!)
      .eq("extracted_biomarker_id", row.id)
      .maybeSingle();
    if (revertError) return NextResponse.json({ error: revertError.message }, { status: 500 });
    if (!revertRevision?.measurement_definition_key) {
      return NextResponse.json(
        { error: "The selected revision cannot be restored as a manual mapping" },
        { status: 400 }
      );
    }
    selectedDefinitionKey = revertRevision.measurement_definition_key;
    reversalOfRevisionId = revertRevision.id;
    correctionReason = "Manual correction reverted";
  }

  if (!selectedDefinitionKey) {
    return NextResponse.json({ error: "A compatible definition is required" }, { status: 400 });
  }

  try {
    const input = measurementInputFromWriterRow(row);
    const resolution = buildManualCorrectionResolution({
      input,
      selectedDefinitionKey,
    });
    const writerResult = await writeExtractedBiomarkerNormalization({
      profileId,
      documentId: id,
      observedAt: doc!.observed_at ?? new Date().toISOString().slice(0, 10),
      row,
      actorId: profileId,
      writeKind: "correction",
      resolution,
      expectedActiveRevision: activeRevision,
      correctionReason,
      reversalOfRevisionId,
      supersedesRevisionId: activeRevision?.id ?? null,
    });
    return NextResponse.json({
      revision: writerResult,
      compatibleDefinitionKeys: compatibleManualDefinitions(input).map((definition) => definition.key),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Normalization writer failed";
    const isClientError = error instanceof ObservationNormalizationWriterError;
    const isConflict = [
      "stale_revision_conflict",
      "observation_source_mismatch",
      "observation_source_owner_mismatch",
      "active_revision_projection_mismatch",
      "revision_observation_binding_conflict",
    ].includes(message);
    return NextResponse.json(
      { error: message },
      { status: isClientError ? error.status : isConflict ? 409 : 500 }
    );
  }
}
