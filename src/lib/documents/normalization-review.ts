import {
  getMeasurementDefinition,
  normalizeMeasurementUnit,
} from "@/lib/biomarkers";
import type {
  AssessmentBinding,
  CandidateEvidence,
  ClinicalCompatibilityAxis,
  IncompleteReasonClass,
  MappingConfidenceBand,
  MeasurementMaturity,
  MeasurementResolution,
  MeasurementResolutionInput,
  PersistedResolverDecisionTrace,
  ResolutionReasonCode,
  NormalizedMeasurementUnit,
  ResolverResult,
  VerificationStatus,
} from "@/lib/biomarkers";
import {
  baseMeasurementFromExtractedRow,
  type BaseMeasurement,
  type MeasurementOverride,
} from "./observation-measurement-correction";
import {
  prepareMeasurementEvidence,
  type PreparedEvidence,
} from "./measurement-evidence-admission";
import { projectLaboratoryOutcome } from "./incomplete-laboratory-outcomes";
import type { LaboratoryResolutionDetails } from "./incomplete-laboratory-outcomes";
import {
  readPersistedDecision,
  type PersistedDecisionConflict,
  type PersistedDecisionQuality,
  type PersistedDecisionQualityCode,
  type PersistedDecisionSource,
} from "./persisted-decision-read";
import type { RegistryV2NormalizationRevisionReadBoundary } from "./observation-read-boundaries";
import {
  isRecordStatus,
  type RecordStatus,
} from "./observation-verification-workflow";

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
  status?: string | null;
  record_status?: string | null;
  lifecycle_reason_code?: string | null;
  superseded_at?: string | null;
  superseded_by_processing_attempt_id?: string | null;
  processing_attempt_id?: string | null;
  is_current?: boolean | null;
  created_at?: string | null;
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
    catalog_manifest_digest?: string | null;
    resolver_version: string;
    normalization_version: string;
    resolver_decision_trace: unknown | null;
    input_evidence_hash?: string | null;
    input_identity_format_version?: string | null;
    resolver_trace_schema_version: string | null;
    measurement_override?: MeasurementOverride | null;
    created_at: string;
  };

export type NormalizationReviewAction =
  | "acceptRaw"
  | "verifyUser"
  | "verifyAuto"
  | "correct"
  | "reverse"
  | "reject"
  | "batchVerify";

export type NormalizationActionAvailability = Readonly<{
  available: boolean;
  exclusionReason: string | null;
}>;

export type NormalizationActionAvailabilityMap = Readonly<
  Record<NormalizationReviewAction, NormalizationActionAvailability>
>;

export type DecisionTraceReview = {
  source: PersistedDecisionSource;
  quality: PersistedDecisionQuality;
  notPersisted: boolean;
  qualityCodes: readonly PersistedDecisionQualityCode[];
  conflictDetails: readonly PersistedDecisionConflict[];
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
  decisionSource: PersistedDecisionSource;
  decisionQuality: PersistedDecisionQuality;
  decisionNotPersisted: boolean;
  decisionQualityCodes: readonly PersistedDecisionQualityCode[];
  recordStatus: RecordStatus;
  sourceIsCurrent: boolean;
  lifecycleReasonCode: string | null;
  supersededAt: string | null;
  supersededByProcessingAttemptId: string | null;
  actionAvailability: NormalizationActionAvailabilityMap;
  previewCandidateEvidence: readonly CandidateEvidence[];
  manualOptions: readonly ManualMappingOption[];
  activeRevision: NormalizationRevisionSummary | null;
  revisions: readonly NormalizationRevisionSummary[];
};
export type EffectiveReviewMeasurement = Omit<BaseMeasurement, "observedAt"> & {
  observedAt: string | null;
};

function baseMeasurementForReview(row: ExtractedReviewRow): BaseMeasurement {
  return baseMeasurementFromExtractedRow(
    {
      value_numeric: row.value_numeric ?? null,
      value_text: row.value_text ?? null,
      value_kind: row.value_kind ?? null,
      ordinal: row.ordinal ?? null,
      unit: row.unit ?? null,
      reference_range: row.reference_range ?? null,
      raw_reference_range: row.raw_reference_range ?? null,
      raw_value_text: row.raw_value_text ?? null,
    },
    null,
    { allowMissingValue: true },
  );
}

export function preparedEvidenceFromExtracted(
  row: ExtractedReviewRow,
  override?: MeasurementOverride | null,
): PreparedEvidence {
  return prepareMeasurementEvidence({
    baseMeasurement: baseMeasurementForReview(row),
    override,
    rawLabel: row.raw_name ?? row.biomarker_name,
    rawUnit: row.raw_unit ?? row.unit ?? null,
    rawValueText: row.raw_value_text ?? null,
    sourceText: row.source_text ?? null,
    sectionContext: row.section_context ?? null,
    sourceAnalyteKey: row.biomarker_key,
    proposedKey: row.biomarker_key,
    specimen: row.specimen ?? null,
    modifier: row.modifier ?? null,
    method: row.method ?? null,
  });
}

export function effectiveMeasurementFromExtracted(
  row: ExtractedReviewRow,
  override: MeasurementOverride | null | undefined,
): EffectiveReviewMeasurement | null {
  if (!override) return null;
  const prepared = preparedEvidenceFromExtracted(row, override);
  return {
    ...prepared.effectiveMeasurement,
    observedAt:
      "observed_at" in override
        ? prepared.effectiveMeasurement.observedAt
        : null,
  };
}

export function measurementInputFromExtracted(
  row: ExtractedReviewRow,
  override?: MeasurementOverride | null,
): MeasurementResolutionInput {
  return preparedEvidenceFromExtracted(row, override).input;
}

function manualOptionsFromPreview(
  preview: MeasurementResolution | null,
): ManualMappingOption[] {
  return (preview?.candidateEvidence ?? [])
    .filter(
      (candidate) =>
        candidate.selectable &&
        candidate.rejected.length === 0 &&
        candidate.missingAxes.length === 0,
    )
    .map((candidate) => getMeasurementDefinition(candidate.candidateKey))
    .filter(
      (definition): definition is NonNullable<typeof definition> =>
        definition?.maturity === "reviewed",
    )
    .map((definition) => ({
      key: definition.key,
      displayName: definition.displayName,
      analyteKey: definition.analyteKey,
      maturity: definition.maturity,
      assessmentBindings: definition.assessmentBindings,
    }));
}

function actionAvailability(
  available: boolean,
  exclusionReason: string | null,
): NormalizationActionAvailability {
  return { available, exclusionReason: available ? null : exclusionReason };
}

export function buildNormalizationActionAvailability(options: {
  recordStatus: RecordStatus;
  sourceIsCurrent: boolean;
  reviewable: boolean;
  outcome: ResolverResult | null;
  registryBindingReady: boolean;
  activeRevision: NormalizationRevisionSummary | null;
  verificationStatus: VerificationStatus | null;
}): NormalizationActionAvailabilityMap {
  const lifecycleBlock =
    options.recordStatus !== "active"
      ? "record_not_active"
      : !options.sourceIsCurrent
        ? "source_not_current"
        : null;
  const reviewBlock = !options.reviewable ? "not_awaiting_review" : null;
  const resolvedBlock =
    options.outcome !== "resolved" ? "incomplete_outcome" : null;
  const verifiedBlock =
    options.verificationStatus === null ||
    options.verificationStatus === "pending"
      ? "no_verified_revision"
      : null;

  return {
    acceptRaw: actionAvailability(
      lifecycleBlock === null &&
        reviewBlock === null &&
        options.outcome !== null &&
        options.outcome !== "resolved",
      lifecycleBlock ?? reviewBlock ?? resolvedBlock,
    ),
    verifyUser: actionAvailability(
      lifecycleBlock === null &&
        resolvedBlock === null &&
        options.registryBindingReady &&
        options.activeRevision !== null &&
        options.verificationStatus === "pending",
      lifecycleBlock ??
        resolvedBlock ??
        (!options.registryBindingReady ? "definition_not_ready" : null) ??
        (options.activeRevision === null ? "no_active_revision" : null) ??
        (options.verificationStatus !== "pending"
          ? "verification_already_set"
          : null),
    ),
    verifyAuto: actionAvailability(false, "system_only"),
    correct: actionAvailability(
      lifecycleBlock === null &&
        reviewBlock === null &&
        options.outcome !== null,
      lifecycleBlock ?? reviewBlock ?? "no_resolution",
    ),
    reverse: actionAvailability(
      lifecycleBlock === null &&
        options.activeRevision !== null &&
        verifiedBlock === null,
      lifecycleBlock ?? verifiedBlock ?? "no_active_revision",
    ),
    reject: actionAvailability(lifecycleBlock === null, lifecycleBlock),
    batchVerify: actionAvailability(false, "batch_eligibility_not_evaluated"),
  };
}

export function buildNormalizationReview(
  row: ExtractedReviewRow & {
    measurement_definition_key?: string | null;
    resolver_result?: string | null;
  },
  revisions: readonly NormalizationRevisionSummary[],
  options: { preview?: MeasurementResolution | null } = {},
): NormalizationReview {
  const activeRevision =
    revisions.find((revision) => revision.is_active) ?? null;
  const activeOverride = activeRevision?.measurement_override ?? null;
  const prepared = preparedEvidenceFromExtracted(row, activeOverride);
  const effectiveMeasurement = activeOverride
    ? {
        ...prepared.effectiveMeasurement,
        observedAt:
          "observed_at" in activeOverride
            ? prepared.effectiveMeasurement.observedAt
            : null,
      }
    : null;
  const decisionObservation = {
    observation_kind: "lab" as const,
    source_extracted_biomarker_id: row.id,
    measurement_definition_key: row.measurement_definition_key ?? null,
    resolution_status: row.resolver_result ?? null,
  };
  const decision = readPersistedDecision({
    observation: decisionObservation,
    relation: revisions,
    preview: options.preview ?? null,
  });
  const outcome = projectLaboratoryOutcome({
    observation: decisionObservation,
    relation: revisions,
    preview: options.preview ?? null,
    decision,
  });
  const decisionTrace: DecisionTraceReview = {
    source: decision.source,
    quality: decision.quality,
    notPersisted: decision.notPersisted,
    qualityCodes: decision.qualityCodes,
    conflictDetails: decision.conflicts,
    trace: decision.technicalTrace,
  };
  const manualOptions =
    decision.source === "preview"
      ? manualOptionsFromPreview(decision.preview)
      : [];
  const recordStatus: RecordStatus = isRecordStatus(row.record_status)
    ? row.record_status
    : row.is_current === false
      ? "superseded"
      : "active";
  const sourceIsCurrent = recordStatus === "active" && row.is_current !== false;
  const reviewable =
    sourceIsCurrent &&
    (row.status === "needs_review" || row.status === "pending_review");
  const verificationStatus = outcome.verificationStatus;
  const reviewResult = outcome.outcome ?? "unmapped";
  const actionAvailability = buildNormalizationActionAvailability({
    recordStatus,
    sourceIsCurrent,
    reviewable,
    outcome: reviewResult,
    registryBindingReady: outcome.registryBindingReady,
    activeRevision,
    verificationStatus,
  });
  return {
    result: reviewResult,
    candidateDefinitionKey: outcome.measurementDefinitionKey,
    analyteKey: outcome.analyteKey,
    missingAxes: outcome.resolutionDetails.missingAxes,
    conflicts: outcome.resolutionDetails.conflictCodes,
    incompleteReason: outcome.resolutionDetails.incompleteReason,
    mappingConfidence: outcome.resolutionDetails.mappingConfidence ?? 0,
    mappingConfidenceBand:
      outcome.resolutionDetails.mappingConfidenceBand ?? "low",
    userCorrected: activeOverride !== null,
    ...(effectiveMeasurement ? { effectiveMeasurement } : {}),
    unit: normalizeMeasurementUnit(prepared.input.rawUnit),
    resolutionDetails: outcome.resolutionDetails,
    registryBindingReady: outcome.registryBindingReady,
    decisionTrace,
    decisionSource: decision.source,
    decisionQuality: decision.quality,
    decisionNotPersisted: decision.notPersisted,
    decisionQualityCodes: decision.qualityCodes,
    recordStatus,
    sourceIsCurrent,
    lifecycleReasonCode: row.lifecycle_reason_code ?? null,
    supersededAt: row.superseded_at ?? null,
    supersededByProcessingAttemptId:
      row.superseded_by_processing_attempt_id ?? null,
    actionAvailability,
    previewCandidateEvidence:
      decision.source === "preview"
        ? (decision.preview?.candidateEvidence ?? [])
        : [],
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
