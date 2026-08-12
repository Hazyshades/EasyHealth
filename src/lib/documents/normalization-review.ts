import {
  isPersistedResolverDecisionTrace,
  resolveMeasurementDefinition,
} from "@/lib/biomarkers";
import type {
  AssessmentBinding,
  CandidateEvidence,
  ClinicalCompatibilityAxis,

  IncompleteReasonClass,
  MappingConfidenceBand,
  MeasurementMaturity,
  MeasurementResolutionInput,
  PersistedResolverDecisionTrace,
  ResolutionReasonCode,
  NormalizedMeasurementUnit,
  ResolverResult,
  VerificationStatus,
} from "@/lib/biomarkers";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";
import {
  applyMeasurementOverride,
  type BaseMeasurement,
  type MeasurementOverride,
  type MeasurementValueKindKey,
} from "./observation-measurement-correction";
import { compatibleManualDefinitions } from "./normalization-revisions";
import { projectLaboratoryOutcome } from "./incomplete-laboratory-outcomes";
import type { LaboratoryResolutionDetails } from "./incomplete-laboratory-outcomes";
import type { RegistryV2NormalizationRevisionReadBoundary } from "./observation-read-boundaries";
import { statedAxisValue } from "./stated-axis-evidence";

type ExtractedReviewRow = {
  id: string;
  biomarker_key: string | null;
  biomarker_name: string;
  raw_name?: string | null;
  value_numeric?: number | string | null;
  value_text?: string | null;
  value_kind?: string | null;
  ordinal?: number | null;
  unit?: string | null;
  raw_unit?: string | null;
  reference_range?: string | null;
  raw_reference_range?: string | null;
  raw_value_text?: string | null;
  section_context?: string | null;
  source_text?: string | null;
  confidence?: number | null;
  specimen?: string | null;
  modifier?: string | null;
  method?: string | null;
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
    measurement_override?: MeasurementOverride | null;
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

export type ManualMappingOption = {
  key: string;
  displayName: string;
  analyteKey: string;
  maturity: MeasurementMaturity;
  assessmentBindings: readonly AssessmentBinding[];
};

/**
 * Per-extracted-row review payload returned to the document review UI.
 * Incomplete outcomes intentionally expose `candidateDefinitionKey` as null so
 * no candidate is ever presented as active identity (EH-112).
 */
export type NormalizationReview = {
  result: ResolverResult;
  candidateDefinitionKey: string | null;
  analyteKey: string | null;
  missingAxes: readonly ClinicalCompatibilityAxis[];
  conflicts: readonly ResolutionReasonCode[];
  /**
   * #114: why this row did not resolve, in one word the UI can speak to. Read
   * from the projection so a preview row carries it too.
   */
  incompleteReason: IncompleteReasonClass | null;
  mappingConfidence: number;
  mappingConfidenceBand: MappingConfidenceBand;
  unit: NormalizedMeasurementUnit;
  resolutionDetails: LaboratoryResolutionDetails;
  userCorrected: boolean;
  effectiveMeasurement?: EffectiveReviewMeasurement;
  registryBindingReady: boolean;
  decisionTrace: DecisionTraceReview;
  previewCandidateEvidence: readonly CandidateEvidence[];
  manualOptions: readonly ManualMappingOption[];
  activeRevision: NormalizationRevisionSummary | null;
  revisions: readonly NormalizationRevisionSummary[];
};
export type EffectiveReviewMeasurement = Omit<BaseMeasurement, "observedAt"> & {
  observedAt: string | null;
};

function normalizedValueKind(
  value: string | null | undefined,
  fallback: MeasurementValueKindKey,
): MeasurementValueKindKey {
  return value === "numeric" ||
    value === "qualitative" ||
    value === "ordinal" ||
    value === "text"
    ? value
    : fallback;
}

function finiteNumericValue(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function effectiveMeasurementFromExtracted(
  row: ExtractedReviewRow,
  override: MeasurementOverride | null | undefined,
): EffectiveReviewMeasurement | null {
  if (!override) return null;
  const { ref_low, ref_high } = parseReferenceRange(
    row.reference_range ?? row.raw_reference_range ?? null,
  );
  const fallbackKind = normalizedValueKind(
    row.value_kind,
    finiteNumericValue(row.value_numeric) == null ? "text" : "numeric",
  );
  const measurement = applyMeasurementOverride(
    {
      value: fallbackKind === "numeric" ? finiteNumericValue(row.value_numeric) : null,
      valueText: row.value_text ?? null,
      valueKind: fallbackKind,
      ordinal: row.ordinal ?? null,
      unit: row.unit ?? row.raw_unit ?? null,
      refLow: ref_low,
      refHigh: ref_high,
      observedAt: "1970-01-01",
    },
    override,
  );
  return {
    ...measurement,
    observedAt: "observed_at" in override ? measurement.observedAt : null,
  };
}

export function measurementInputFromExtracted(
  row: ExtractedReviewRow,
  override?: MeasurementOverride | null,
): MeasurementResolutionInput {
  const { ref_low, ref_high } = parseReferenceRange(
    row.reference_range ?? row.raw_reference_range ?? null,
  );
  const effectiveMeasurement = effectiveMeasurementFromExtracted(row, override);
  const correctedRawValueText =
    override && "value_text" in override
      ? override.value_text ?? null
      : override && "value" in override
        ? override.value == null
          ? null
          : String(override.value)
        : row.raw_value_text ?? null;
  // #106: an axis the document never stated must reach the resolver as absent,
  // otherwise it satisfies a compatibility axis and unlocks `resolved`.
  const provenance = {
    label: row.raw_name ?? row.biomarker_name,
    sourceText: row.source_text ?? null,
    sectionContext: row.section_context ?? null,
  };
  const effectiveValueKind = effectiveMeasurement?.valueKind;
  const overrideValueKind = override?.value_kind;
  const valueKind =
    effectiveValueKind === "numeric" ||
    effectiveValueKind === "qualitative" ||
    effectiveValueKind === "ordinal"
      ? effectiveValueKind
      : overrideValueKind === "numeric" ||
          overrideValueKind === "qualitative" ||
          overrideValueKind === "ordinal"
        ? overrideValueKind
        : row.value_kind === "numeric" ||
            row.value_kind === "qualitative" ||
            row.value_kind === "ordinal"
          ? row.value_kind
          : null;
  return {
    rawLabel: row.raw_name ?? row.biomarker_name,
    rawUnit:
      override && "unit" in override
        ? override.unit ?? null
        : row.raw_unit ?? row.unit ?? null,
    valueKind,
    specimen: statedAxisValue("specimen", row.specimen ?? null, provenance),
    modifier: statedAxisValue("modifier", row.modifier ?? null, provenance),
    method: statedAxisValue("method", row.method ?? null, provenance),
    section: row.section_context ?? null,
    referenceLow:
      effectiveMeasurement?.refLow ??
      (override && "ref_low" in override ? override.ref_low ?? null : ref_low),
    referenceHigh:
      effectiveMeasurement?.refHigh ??
      (override && "ref_high" in override ? override.ref_high ?? null : ref_high),
    extractionConfidence: row.confidence ?? null,
    proposedKey: row.biomarker_key,
    rawValueText: correctedRawValueText,
  };
}

export function buildNormalizationReview(
  row: ExtractedReviewRow & {
    measurement_definition_key?: string | null;
    resolver_result?: string | null;
  },
  revisions: readonly NormalizationRevisionSummary[]
): NormalizationReview {
  const activeRevision = revisions.find((revision) => revision.is_active) ?? null;
  const activeOverride = activeRevision?.measurement_override ?? null;
  const effectiveMeasurement = effectiveMeasurementFromExtracted(
    row,
    activeOverride,
  );
  const input = measurementInputFromExtracted(row, activeOverride);
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
  const persistedTrace =
    activeRevision &&
    (activeRevision.resolver_trace_schema_version === "1" ||
      activeRevision.resolver_trace_schema_version === "2") &&
    isPersistedResolverDecisionTrace(activeRevision.resolver_decision_trace)
      ? activeRevision.resolver_decision_trace
      : null;
  const decisionTrace: DecisionTraceReview = activeRevision
    ? {
        availability: persistedTrace ? "persisted" : "legacy_unavailable",
        trace: persistedTrace,
      }
    : { availability: "preview", trace: null };
  const manualOptions = compatibleManualDefinitions(input);
  return {
    result: outcome.outcome ?? preview.result,
    candidateDefinitionKey: outcome.measurementDefinitionKey,
    analyteKey: outcome.analyteKey,
    missingAxes: persistedTrace?.missingAxes ?? outcome.resolutionDetails.missingAxes,
    conflicts: persistedTrace?.conflicts ?? outcome.resolutionDetails.conflictCodes,
    incompleteReason: outcome.resolutionDetails.incompleteReason,
    mappingConfidence:
      outcome.resolutionDetails.mappingConfidence ?? preview.mappingConfidence,
    mappingConfidenceBand:
      outcome.resolutionDetails.mappingConfidenceBand ??
      preview.mappingConfidenceBand,
    userCorrected: activeOverride !== null,
    ...(effectiveMeasurement ? { effectiveMeasurement } : {}),
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
