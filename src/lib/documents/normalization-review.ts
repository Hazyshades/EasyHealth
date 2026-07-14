import { resolveMeasurementDefinition } from "@/lib/biomarkers";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";
import { compatibleManualDefinitions } from "./normalization-revisions";

type ExtractedReviewRow = {
  id: string;
  biomarker_key: string | null;
  biomarker_name: string;
  raw_name?: string | null;
  unit?: string | null;
  raw_unit?: string | null;
  reference_range?: string | null;
  raw_reference_range?: string | null;
  section_context?: string | null;
  confidence?: number | null;
  specimen?: string | null;
  modifier?: string | null;
};

export type NormalizationRevisionSummary = {
  id: string;
  extracted_biomarker_id: string;
  measurement_definition_key: string | null;
  analyte_key: string | null;
  resolver_result: string;
  mapping_confidence: number;
  mapping_confidence_band: string | null;
  verification_status: string;
  is_active: boolean;
  registry_version: string;
  resolver_version: string;
  normalization_schema_version: string;
  created_at: string;
};

export function measurementInputFromExtracted(row: ExtractedReviewRow) {
  const { ref_low, ref_high } = parseReferenceRange(row.reference_range ?? row.raw_reference_range ?? null);
  return {
    rawLabel: row.raw_name ?? row.biomarker_name,
    rawUnit: row.raw_unit ?? row.unit ?? null,
    specimen: row.specimen ?? null,
    modifier: row.modifier ?? null,
    section: row.section_context ?? null,
    referenceLow: ref_low,
    referenceHigh: ref_high,
    extractionConfidence: row.confidence ?? null,
    proposedKey: row.biomarker_key,
  };
}

export function buildNormalizationReview(
  row: ExtractedReviewRow,
  revisions: readonly NormalizationRevisionSummary[]
) {
  const input = measurementInputFromExtracted(row);
  const resolution = resolveMeasurementDefinition(input);
  return {
    result: resolution.result,
    candidateDefinitionKey: resolution.measurementDefinitionKey,
    analyteKey: resolution.analyteKey,
    missingAxes: resolution.missingAxes,
    conflicts: resolution.conflicts,
    mappingConfidence: resolution.mappingConfidence,
    mappingConfidenceBand: resolution.mappingConfidenceBand,
    unit: resolution.unit,
    candidateEvidence: resolution.candidateEvidence,
    manualOptions: compatibleManualDefinitions(input)
      .map((definition) => ({
        key: definition.key,
        displayName: definition.displayName,
        analyteKey: definition.analyteKey,
        maturity: definition.maturity,
        assessmentBindings: definition.assessmentBindings,
      })),
    activeRevision: revisions.find((revision) => revision.is_active) ?? null,
    revisions,
  };
}
