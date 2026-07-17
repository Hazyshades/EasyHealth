import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDocumentOwner } from "@/lib/documents/access";
import { parseLabValueCell, OBSERVATION_PROVENANCE_SCHEMA_VERSION, MEASUREMENT_CATALOG_MANIFEST_VERSION, MEASUREMENT_CATALOG_MANIFEST_RELEASE, MEASUREMENT_RESOLVER_VERSION, MEASUREMENT_NORMALIZATION_VERSION } from "@/lib/biomarkers";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";
import { buildObservationUpsertPayload } from "@/lib/documents/observation-identity";
import {
  compatibleManualDefinitions,
  createManualCorrection,
  createManualReversal,
  getActiveNormalizationRevision,
  promoteNormalizationRevision,
} from "@/lib/documents/normalization-revisions";
import {
  buildNormalizationReview,
  type NormalizationRevisionSummary,
} from "@/lib/documents/normalization-review";

type RouteContext = { params: Promise<{ id: string }> };

type ExtractedBiomarkerRow = {
  id: string;
  biomarker_key: string | null;
  biomarker_name: string;
  raw_name: string | null;
  value_numeric: number | string | null;
  value_text: string | null;
  value_kind: string | null;
  ordinal: number | null;
  unit: string | null;
  raw_unit: string | null;
  reference_range: string | null;
  raw_reference_range: string | null;
  section_context: string | null;
  confidence: number | null;
  specimen: string | null;
  modifier: string | null;
  source_page: number | null;
  source_text: string | null;
  bounding_box?: unknown;
  reported_alt_value: number | null;
  reported_alt_unit: number | null;
  raw_value_text: string | null;
  processing_version: string | null;
};

function finite(value: number | string | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

  const specimen = row.specimen ?? "unspecified";
  const modifier = row.modifier ?? "none";
  const { ref_low, ref_high } = parseReferenceRange(row.reference_range ?? row.raw_reference_range);
  const input = {
    rawLabel: row.raw_name ?? row.biomarker_name,
    rawUnit: row.raw_unit ?? row.unit,
    specimen,
    modifier,
    section: row.section_context,
    referenceLow: ref_low,
    referenceHigh: ref_high,
    extractionConfidence: row.confidence,
    proposedKey: row.biomarker_key,
    rawValueText: row.raw_value_text ?? null,
  };
  const activeRevision = await getActiveNormalizationRevision(row.id);
  const revisionResult =
    body.action === "undo"
      ? body.revertToRevisionId && activeRevision
        ? await createManualReversal({
            extractedBiomarkerId: row.id,
            input,
            revertToRevisionId: body.revertToRevisionId,
            activeRevisionId: activeRevision.id,
            actorId: profileId,
          })
        : null
      : body.measurementDefinitionKey
        ? await createManualCorrection({
            extractedBiomarkerId: row.id,
            input,
            selectedDefinitionKey: body.measurementDefinitionKey,
            actorId: profileId,
            extractionVersion: row.processing_version ?? null,
            correctionReason: body.correctionReason ?? null,
            supersedesRevisionId: activeRevision?.id ?? null,
          })
        : null;
  if (!revisionResult) {
    return NextResponse.json({ error: "A compatible definition and active revision are required" }, { status: 400 });
  }
  if (!revisionResult.resolution.measurementDefinitionKey) {
    return NextResponse.json({ error: "This compatible definition has no supported observation identity" }, { status: 409 });
  }

  let value = finite(row.value_numeric);
  let valueText = row.value_text?.trim() || null;
  let valueKind = (row.value_kind as "numeric" | "qualitative" | "ordinal" | "text" | null) ?? null;
  let ordinal = row.ordinal ?? null;
  if (value == null && valueText) {
    const parsed = parseLabValueCell(valueText);
    if (parsed) {
      value = parsed.value;
      valueText = parsed.value_text;
      valueKind = parsed.value_kind;
      ordinal = parsed.ordinal;
    }
  }
  if (value != null) {
    valueKind = valueKind ?? "numeric";
    valueText = valueText ?? String(value);
  }
  if (valueKind === "numeric" && value == null) {
    return NextResponse.json({ error: "Numeric observation has no usable value" }, { status: 422 });
  }
  if (valueKind !== "numeric" && !valueText) {
    return NextResponse.json({ error: "Qualitative observation has no usable value" }, { status: 422 });
  }

  const { data: observation, error: upsertError } = await supabase
    .from("observations")
    .upsert(
      buildObservationUpsertPayload(
        {
        profile_id: profileId,
        document_id: id,
        name: row.biomarker_name,
        value,
        value_kind: valueKind ?? "text",
        value_text: valueText,
        ordinal,
        unit: row.unit ?? "",
        ref_low,
        ref_high,
        observed_at: doc!.observed_at ?? new Date().toISOString().slice(0, 10),
        specimen,
        modifier,
        raw_name: row.raw_name ?? row.biomarker_name,
        source_page: row.source_page,
        source_text: row.source_text,
        bounding_box: row.bounding_box,
        confidence: row.confidence,
        reported_alt_value: row.reported_alt_value,
        reported_alt_unit: row.reported_alt_unit,
        source_extracted_biomarker_id: row.id,
        raw_value_text: row.raw_value_text ?? null,
        raw_reference_text: row.raw_reference_range ?? null,
        raw_unit: row.raw_unit ?? row.unit ?? null,
        extraction_version: row.processing_version ?? null,
        provenance_schema_version: OBSERVATION_PROVENANCE_SCHEMA_VERSION,
        catalog_manifest_version: MEASUREMENT_CATALOG_MANIFEST_VERSION,
        catalog_manifest_digest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
        resolver_version: MEASUREMENT_RESOLVER_VERSION,
        normalization_version: MEASUREMENT_NORMALIZATION_VERSION,
      },
        revisionResult.resolution
      ),
      { onConflict: "source_extracted_biomarker_id" }
    )
    .select("id")
    .single();
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  await promoteNormalizationRevision({ revisionId: revisionResult.revision.id, observationId: observation.id, actorId: profileId });
  const { error: statusError } = await supabase
    .from("document_extracted_biomarkers")
    .update({ status: "accepted", verification_status: "manually_corrected" })
    .eq("id", row.id);
  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });
  return NextResponse.json({
    revision: revisionResult.revision,
    compatibleDefinitionKeys: compatibleManualDefinitions(input).map((definition) => definition.key),
  });
}
