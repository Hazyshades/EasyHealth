import {
  getMeasurementDefinition,
  isPersistedResolverDecisionTrace,
  resolveMeasurementDefinition,
} from "@/lib/biomarkers";
import type {
  MeasurementResolutionInput,
  PersistedResolverDecisionTrace,
  VerificationStatus,
} from "@/lib/biomarkers";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";
import { compatibleManualDefinitions } from "./normalization-revisions";
import { projectLaboratoryOutcome } from "./incomplete-laboratory-outcomes";
import type { RegistryV2NormalizationRevisionReadBoundary } from "./observation-read-boundaries";

type ExtractedReviewRow = {
  id: string;
  biomarker_key: string | null;
  biomarker_name: string;
  raw_name?: string | null;
  unit?: string | null;
  raw_unit?: string | null;
  reference_range?: string | null;
  raw_reference_range?: string | null;
  raw_value_text?: string | null;
  value_kind?: string | null;
  section_context?: string | null;
  confidence?: number | null;
  specimen?: string | null;
  modifier?: string | null;
};

export type NormalizationRevisionSummary =
  RegistryV2NormalizationRevisionReadBoundary & {
    id: string;
    extracted_biomarker_id: string;
    measurement_definition_key: string | null;
    analyte_key: string | null;
    resolver_result: string;
    mapping_confidence: number;
    mapping_confidence_band: string | null;
    verification_status: VerificationStatus;
    is_active: boolean;
    catalog_manifest_version: string;
    resolver_version: string;
    normalization_version: string;
    resolver_decision_trace: unknown | null;
    resolver_trace_schema_version: string | null;
    created_at: string;
  };

export type DecisionTraceAvailability =
  | "persisted"
  | "preview"
  | "legacy_unavailable";

export type DecisionTraceReview = {
  availability: DecisionTraceAvailability;
  trace: PersistedResolverDecisionTrace | null;
};

export function measurementInputFromExtracted(
  row: ExtractedReviewRow
): MeasurementResolutionInput {
  const { ref_low, ref_high } = parseReferenceRange(row.reference_range ?? row.raw_reference_range ?? null);
  return {
    rawLabel: row.raw_name ?? row.biomarker_name,
    rawUnit: row.raw_unit ?? row.unit ?? null,
    valueKind:
      row.value_kind === "numeric" ||
      row.value_kind === "qualitative" ||
      row.value_kind === "ordinal"
        ? row.value_kind
        : null,
    specimen: row.specimen ?? null,
    modifier: row.modifier ?? null,
    section: row.section_context ?? null,
    referenceLow: ref_low,
    referenceHigh: ref_high,
    extractionConfidence: row.confidence ?? null,
    proposedKey: row.biomarker_key,
    rawValueText: row.raw_value_text ?? null,
  };
}

export function buildNormalizationReview(
  row: ExtractedReviewRow & {
    measurement_definition_key?: string | null;
    resolver_result?: string | null;
  },
  revisions: readonly NormalizationRevisionSummary[]
) {
  const input = measurementInputFromExtracted(row);
  const preview = resolveMeasurementDefinition(input);
  const outcome = projectLaboratoryOutcome({
    observation: {
      observation_kind: "lab",
      measurement_definition_key: row.measurement_definition_key ?? null,
      resolution_status: row.resolver_result ?? null,
    },
    relation: revisions,
    preview,
  });
  const activeRevision = revisions.find((revision) => revision.is_active) ?? null;
  const persistedTrace =
    activeRevision &&
    activeRevision.resolver_trace_schema_version === "1" &&
    isPersistedResolverDecisionTrace(activeRevision.resolver_decision_trace)
      ? activeRevision.resolver_decision_trace
      : null;
  const decisionTrace: DecisionTraceReview = activeRevision
    ? {
        availability: persistedTrace ? "persisted" : "legacy_unavailable",
        trace: persistedTrace,
      }
    : { availability: "preview", trace: null };
  const traceCandidates = persistedTrace?.candidates ?? [];
  const manualOptions = persistedTrace
    ? traceCandidates
        .filter((candidate) => candidate.maturity === "reviewed" && candidate.conflicts.length === 0)
        .map((candidate) => getMeasurementDefinition(candidate.candidateKey))
        .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition))
    : compatibleManualDefinitions(input);

  return {
    result: outcome.outcome ?? preview.result,
    candidateDefinitionKey: outcome.measurementDefinitionKey,
    analyteKey: outcome.analyteKey,
    missingAxes: persistedTrace?.missingAxes ?? outcome.resolutionDetails.missingAxes,
    conflicts: persistedTrace?.conflicts ?? outcome.resolutionDetails.conflictCodes,
    mappingConfidence:
      outcome.resolutionDetails.mappingConfidence ?? preview.mappingConfidence,
    mappingConfidenceBand:
      outcome.resolutionDetails.mappingConfidenceBand ??
      preview.mappingConfidenceBand,
    unit: preview.unit,
    resolutionDetails: outcome.resolutionDetails,
    registryBindingReady: outcome.registryBindingReady,
    decisionTrace,
    previewCandidateEvidence: activeRevision ? [] : preview.candidateEvidence,
    manualOptions: manualOptions.map((definition) => ({
      key: definition.key,
      displayName: definition.displayName,
      analyteKey: definition.analyteKey,
      maturity: definition.maturity,
      assessmentBindings: definition.assessmentBindings,
    })),
    activeRevision,
    revisions,
  };
}
