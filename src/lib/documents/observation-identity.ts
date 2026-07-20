import type { MeasurementResolution } from "@/lib/biomarkers";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ObservationSemanticIdentity = {
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: MeasurementResolution["result"];
};

export type ObservationUpsertSource = {
  profile_id: string;
  document_id: string;
  name: string;
  value: number | string | null;
  value_kind: string;
  value_text: string | null;
  ordinal: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  specimen: string;
  modifier: string;
  raw_name: string | null;
  source_page: number | null;
  source_text: string | null;
  bounding_box: unknown;
  confidence: number | null;
  reported_alt_value: number | null;
  reported_alt_unit: number | null;
  source_extracted_biomarker_id: string;
  raw_value_text: string | null;
  raw_reference_text: string | null;
  raw_unit: string | null;
  extraction_version: string | null;
  provenance_schema_version: string;
  catalog_manifest_version: string | null;
  catalog_manifest_digest: string | null;
  resolver_version: string | null;
  normalization_version: string | null;
};

export function buildObservationSemanticIdentity(
  resolution: Pick<MeasurementResolution, "result" | "analyteKey" | "measurementDefinitionKey">
): ObservationSemanticIdentity {
  return {
    analyte_key: resolution.analyteKey ?? null,
    measurement_definition_key:
      resolution.result === "resolved" ? resolution.measurementDefinitionKey : null,
    resolution_status: resolution.result,
  };
}

export function buildObservationUpsertPayload(
  source: ObservationUpsertSource,
  resolution: Pick<MeasurementResolution, "result" | "analyteKey" | "measurementDefinitionKey">
) {
  return {
    ...source,
    ...buildObservationSemanticIdentity(resolution),
  };
}

/**
 * Persist the one observation owned by an extracted biomarker.
 *
 * The original Registry v2 migration used a partial unique index for this
 * invariant. PostgreSQL enforces it, but PostgREST cannot use that index as
 * an `onConflict` target. Updating first, then inserting and retrying the
 * update after a duplicate-key race, preserves the same identity contract on
 * both the pre-033 schema and the replacement UNIQUE constraint.
 */
export async function persistObservationByExtractedBiomarker(
  client: SupabaseClient,
  payload: ReturnType<typeof buildObservationUpsertPayload>,
): Promise<{ id: string }> {
  const updateExisting = async () => {
    const result = await client
      .from("observations")
      .update(payload)
      .eq("source_extracted_biomarker_id", payload.source_extracted_biomarker_id)
      .select("id")
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data as { id: string } | null;
  };

  const existing = await updateExisting();
  if (existing) return existing;

  const inserted = await client.from("observations").insert(payload).select("id").single();
  if (!inserted.error) return inserted.data as { id: string };
  if (inserted.error.code !== "23505") throw inserted.error;

  const concurrent = await updateExisting();
  if (concurrent) return concurrent;
  throw inserted.error;
}
