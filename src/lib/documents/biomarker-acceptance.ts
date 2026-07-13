import {
  getBiomarkerDefinition,
  inferModifier,
  inferSpecimen,
  resolveMeasurementDefinition,
  normalizeBiomarkerKey,
  parseLabValueCell,
} from "@/lib/biomarkers";
import {
  createNormalizationCandidate,
  measurementResolutionMode,
  promoteNormalizationRevision,
} from "@/lib/documents/normalization-revisions";
import { recordMeasurementShadowEvent } from "@/lib/documents/measurement-shadow";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";

type ExtractedBiomarkerRow = {
  id: string;
  biomarker_key: string | null;
  biomarker_name: string;
  raw_name?: string | null;
  value_numeric: number | string | null;
  value_text?: string | null;
  value_kind?: string | null;
  ordinal?: number | null;
  unit: string | null;
  reference_range: string | null;
  status: string | null;
  source_page?: number | null;
  source_text?: string | null;
  bounding_box?: unknown;
  confidence?: number | null;
  specimen?: string | null;
  modifier?: string | null;
  reported_alt_value?: number | null;
  reported_alt_unit?: string | null;
  raw_unit?: string | null;
  raw_value_text?: string | null;
  raw_reference_range?: string | null;
  section_context?: string | null;
};

export class BiomarkerAcceptanceError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
  }
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function acceptExtractedBiomarkers(options: {
  profileId: string;
  documentId: string;
  observedAt: string;
  ids: string[];
}): Promise<{ acceptedIds: string[] }> {
  const supabase = createAdminClient();
  const { profileId, documentId, observedAt, ids } = options;

  const { data: rows, error: fetchError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, reference_range, raw_unit, raw_value_text, raw_reference_range, section_context, status, source_page, source_text, bounding_box, confidence, specimen, modifier, reported_alt_value, reported_alt_unit"
    )
    .eq("document_id", documentId)
    .eq("profile_id", profileId)
    .eq("is_current", true)
    .in("id", ids);

  if (fetchError) {
    throw new BiomarkerAcceptanceError(fetchError.message);
  }
  if (!rows?.length) {
    throw new BiomarkerAcceptanceError("No matching biomarkers", 404);
  }

  const observations = (rows as ExtractedBiomarkerRow[])
    .filter((row) => row.status !== "accepted")
    .map((row) => {
      const key = normalizeBiomarkerKey(row.biomarker_key ?? "", row.biomarker_name);
      const def = getBiomarkerDefinition(key);

      let value = toFiniteNumber(row.value_numeric);
      let valueText = row.value_text?.trim() || null;
      let valueKind = (row.value_kind as "numeric" | "qualitative" | "ordinal" | "text" | null) ?? null;
      let ordinal = row.ordinal ?? null;

      if (value == null && valueText) {
        const parsed = parseLabValueCell(valueText);
        if (parsed) {
          valueKind = parsed.value_kind;
          value = parsed.value;
          valueText = parsed.value_text;
          ordinal = parsed.ordinal;
        }
      } else if (value != null) {
        valueKind = valueKind ?? "numeric";
        valueText = valueText ?? String(value);
      } else {
        // Try parsing value_numeric as string qualitative
        const parsed = parseLabValueCell(row.value_numeric);
        if (parsed && parsed.value_kind !== "numeric") {
          valueKind = parsed.value_kind;
          value = parsed.value;
          valueText = parsed.value_text;
          ordinal = parsed.ordinal;
        }
      }

      if (valueKind === "numeric") {
        if (value == null) return null;
      } else {
        if (!valueText) return null;
        valueKind = valueKind ?? "text";
      }

      const { ref_low, ref_high } = parseReferenceRange(row.reference_range);
      const specimen = inferSpecimen(
        key,
        row.biomarker_name,
        row.specimen ?? def?.specimen ?? null
      );
      const modifier = inferModifier(key, row.biomarker_name, row.modifier ?? null);

      return {
        profile_id: profileId,
        document_id: documentId,
        biomarker_key: key,
        name: row.biomarker_name,
        value: valueKind === "numeric" ? value : value,
        value_kind: valueKind,
        value_text: valueText,
        ordinal,
        unit: row.unit ?? "",
        ref_low,
        ref_high,
        observed_at: observedAt,
        specimen,
        modifier,
        raw_name: row.raw_name ?? row.biomarker_name,
        source_page: row.source_page ?? null,
        source_text: row.source_text ?? null,
        bounding_box: row.bounding_box ?? null,
        confidence: row.confidence ?? null,
        reported_alt_value: row.reported_alt_value ?? null,
        reported_alt_unit: row.reported_alt_unit ?? null,
        source_extracted_biomarker_id: row.id,
        measurement_input: {
          rawLabel: row.raw_name ?? row.biomarker_name,
          rawUnit: row.raw_unit ?? row.unit,
          specimen,
          modifier,
          section: row.section_context ?? null,
          referenceLow: ref_low,
          referenceHigh: ref_high,
          extractionConfidence: row.confidence ?? null,
          proposedKey: row.biomarker_key,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const mode = measurementResolutionMode();
  const acceptedIds: string[] = [];

  if (observations.length > 0) {
    if (mode === "promote") {
      for (const prepared of observations) {
        const candidate = await createNormalizationCandidate({
          extractedBiomarkerId: prepared.source_extracted_biomarker_id,
          input: prepared.measurement_input,
          verificationStatus: "user_verified",
          actorId: profileId,
        });
        if (candidate.resolution.result !== "resolved" || !candidate.resolution.canonicalKey) continue;

        const { measurement_input: _measurementInput, ...observation } = prepared;
        const { data: activeObservation, error: upsertError } = await supabase
          .from("observations")
          .upsert(
            {
              ...observation,
              biomarker_key: candidate.resolution.canonicalKey,
              measurement_definition_key: candidate.resolution.measurementDefinitionKey,
            },
            { onConflict: "profile_id,biomarker_key,observed_at,specimen,modifier" }
          )
          .select("id")
          .single();
        if (upsertError) throw new BiomarkerAcceptanceError(upsertError.message);
        await promoteNormalizationRevision({
          revisionId: candidate.revision.id,
          observationId: activeObservation.id,
          actorId: profileId,
        });
        acceptedIds.push(prepared.source_extracted_biomarker_id);
      }
    } else {
      if (mode === "shadow") {
        await Promise.all(
          observations.map(async (prepared) => {
            const candidate = await createNormalizationCandidate({
              extractedBiomarkerId: prepared.source_extracted_biomarker_id,
              input: prepared.measurement_input,
            });
            await recordMeasurementShadowEvent({
              profileId,
              documentId,
              extractedBiomarkerId: prepared.source_extracted_biomarker_id,
              eventType: "resolution",
              legacyBiomarkerKey: prepared.biomarker_key,
              resolution: candidate.resolution,
              promotionRejectionReason: "rollout_not_enabled",
              context: {
                normalized_unit: candidate.resolution.unit.normalizedUnit,
                unit_dimension: candidate.resolution.unit.dimension,
                specimen: prepared.specimen,
                modifier: prepared.modifier,
              },
            });
          })
        );
      }
      const legacyObservations = observations.map(({ measurement_input: _measurementInput, ...observation }) => observation);
      const { error: upsertError } = await supabase.from("observations").upsert(legacyObservations, {
        onConflict: "profile_id,biomarker_key,observed_at,specimen,modifier",
      });
      if (upsertError) throw new BiomarkerAcceptanceError(upsertError.message);
      acceptedIds.push(...observations.map((row) => row.source_extracted_biomarker_id));
    }

    if (acceptedIds.length > 0) {
      const { error: updateError } = await supabase
        .from("document_extracted_biomarkers")
        .update({ status: "accepted" })
        .in("id", acceptedIds);
      if (updateError) {
        throw new BiomarkerAcceptanceError(updateError.message);
      }
    }
  }

  // Mark remaining selected qualitative-only rejects that had no mappable value still pending
  // Rows that could not be mapped stay needs_review

  const { count: pendingCount, error: countError } = await supabase
    .from("document_extracted_biomarkers")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId)
    .eq("is_current", true)
    .in("status", ["needs_review", "pending_review"]);

  if (countError) {
    throw new BiomarkerAcceptanceError(countError.message);
  }

  if ((pendingCount ?? 0) === 0) {
    const { error: documentError } = await supabase
      .from("documents")
      .update({ processing_status: "ready", status: "completed" })
      .eq("id", documentId);
    if (documentError) {
      throw new BiomarkerAcceptanceError(documentError.message);
    }
  }

  return { acceptedIds };
}
