import { parseLabValueCell, OBSERVATION_PROVENANCE_SCHEMA_VERSION, MEASUREMENT_CATALOG_MANIFEST_VERSION, MEASUREMENT_CATALOG_MANIFEST_RELEASE, MEASUREMENT_RESOLVER_VERSION, MEASUREMENT_NORMALIZATION_VERSION } from "@/lib/biomarkers";
import type { MeasurementValueKind } from "@/lib/biomarkers";
import {
  buildObservationUpsertPayload,
  persistObservationByExtractedBiomarker,
} from "@/lib/documents/observation-identity";
import { createNormalizationCandidate, promoteNormalizationRevision } from "@/lib/documents/normalization-revisions";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";

type ExtractedBiomarkerRow = {
  id: string; biomarker_key: string | null; biomarker_name: string; raw_name?: string | null; value_numeric: number | string | null; value_text?: string | null; value_kind?: string | null; ordinal?: number | null; unit: string | null; reference_range: string | null; status: string | null; source_page?: number | null; source_text?: string | null; bounding_box?: unknown; confidence?: number | null; specimen?: string | null; modifier?: string | null; reported_alt_value?: number | null; reported_alt_unit?: number | null; raw_unit?: string | null; raw_value_text?: string | null; raw_reference_range?: string | null; section_context?: string | null; processing_version?: string | null;
};

export class BiomarkerAcceptanceError extends Error { constructor(message: string, public readonly status = 500) { super(message); } }
function toFiniteNumber(value: number | string | null | undefined): number | null { if (value == null) return null; const parsed = typeof value === "number" ? value : Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : null; }
function resolverValueKind(valueKind: string | null): MeasurementValueKind { return valueKind === "numeric" || valueKind === "qualitative" || valueKind === "ordinal" ? valueKind : "unspecified"; }

export async function acceptExtractedBiomarkers(options: { profileId: string; documentId: string; observedAt: string; ids: string[] }): Promise<{ acceptedIds: string[] }> {
  const supabase = createAdminClient();
  const { profileId, documentId, observedAt, ids } = options;
  const { data: rows, error: fetchError } = await supabase.from("document_extracted_biomarkers").select("id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, reference_range, raw_unit, raw_value_text, raw_reference_range, section_context, status, source_page, source_text, bounding_box, confidence, specimen, modifier, reported_alt_value, reported_alt_unit, processing_version").eq("document_id", documentId).eq("profile_id", profileId).eq("is_current", true).in("id", ids);
  if (fetchError) throw new BiomarkerAcceptanceError(fetchError.message);
  if (!rows?.length) throw new BiomarkerAcceptanceError("No matching biomarkers", 404);

  const acceptedIds: string[] = [];
  for (const row of rows as ExtractedBiomarkerRow[]) {
    if (row.status === "accepted") continue;
    let value = toFiniteNumber(row.value_numeric);
    let valueText = row.value_text?.trim() || null;
    let valueKind = row.value_kind ?? null;
    let ordinal = row.ordinal ?? null;
    if (value == null && valueText) {
      const parsed = parseLabValueCell(valueText);
      if (parsed) { value = parsed.value; valueText = parsed.value_text; valueKind = parsed.value_kind; ordinal = parsed.ordinal; }
    } else if (value != null) { valueKind ??= "numeric"; valueText ??= String(value); }
    if ((valueKind === "numeric" && value == null) || (valueKind !== "numeric" && !valueText)) continue;
    const { ref_low, ref_high } = parseReferenceRange(row.reference_range);
    const specimen = row.specimen ?? "unspecified";
    const modifier = row.modifier ?? "none";
    const input = { rawLabel: row.raw_name ?? row.biomarker_name, rawUnit: row.raw_unit ?? row.unit, specimen, modifier, section: row.section_context ?? null, referenceLow: ref_low, referenceHigh: ref_high, extractionConfidence: row.confidence ?? null, proposedKey: row.biomarker_key, valueKind: resolverValueKind(valueKind), rawValueText: row.raw_value_text ?? null };
    const candidate = await createNormalizationCandidate({ extractedBiomarkerId: row.id, input, verificationStatus: "user_verified", actorId: profileId, extractionVersion: row.processing_version ?? null });
    let observation: { id: string };
    try {
      observation = await persistObservationByExtractedBiomarker(
        supabase,
        buildObservationUpsertPayload({ profile_id: profileId, document_id: documentId, name: row.biomarker_name, value: valueKind === "numeric" ? value : value, value_kind: valueKind ?? "text", value_text: valueText, ordinal, unit: row.unit ?? "", ref_low, ref_high, observed_at: observedAt, specimen, modifier, raw_name: row.raw_name ?? row.biomarker_name, source_page: row.source_page ?? null, source_text: row.source_text ?? null, bounding_box: row.bounding_box ?? null, confidence: row.confidence ?? null, reported_alt_value: row.reported_alt_value ?? null, reported_alt_unit: row.reported_alt_unit ?? null, source_extracted_biomarker_id: row.id, raw_value_text: row.raw_value_text ?? null, raw_reference_text: row.raw_reference_range ?? null, raw_unit: row.raw_unit ?? row.unit ?? null, extraction_version: row.processing_version ?? null, provenance_schema_version: OBSERVATION_PROVENANCE_SCHEMA_VERSION, catalog_manifest_version: MEASUREMENT_CATALOG_MANIFEST_VERSION, catalog_manifest_digest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest, resolver_version: MEASUREMENT_RESOLVER_VERSION, normalization_version: MEASUREMENT_NORMALIZATION_VERSION }, candidate.resolution),
      );
    } catch (error) {
      throw new BiomarkerAcceptanceError(error instanceof Error ? error.message : "Failed to persist observation");
    }
    if (candidate.resolution.result === "resolved") await promoteNormalizationRevision({ revisionId: candidate.revision.id, observationId: observation.id, actorId: profileId });
    acceptedIds.push(row.id);
  }
  if (acceptedIds.length) { const { error } = await supabase.from("document_extracted_biomarkers").update({ status: "accepted" }).in("id", acceptedIds); if (error) throw new BiomarkerAcceptanceError(error.message); }
  return { acceptedIds };
}
