import type { MeasurementResolution } from "@/lib/biomarkers";

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
  reported_alt_unit: string | null;
  source_extracted_biomarker_id: string;
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
