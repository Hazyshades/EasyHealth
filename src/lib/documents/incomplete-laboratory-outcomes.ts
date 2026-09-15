import type {
  AdmissibilityRejectionCode,
  ClinicalCompatibilityAxis,
  IncompleteReasonClass,
  MappingConfidenceBand,
  MeasurementResolution,
  ResolutionReasonCode,
  ResolverResult,
  VerificationStatus,
  ResolvedReviewedMeasurementBinding,
} from "@/lib/biomarkers";
import {
  classifyIncompleteReason,
  incompleteReasonClass,
  minimalBlockingAxes,
  type ValueKind,
} from "@/lib/biomarkers";
import {
  evaluateAssessmentEligibility,
  ineligibleAssessmentEligibility,
  type AssessmentEligibility,
  type AssessmentExclusionReason,
} from "@/lib/health-profile-assessment-eligibility";
import {
  readPersistedDecision,
  type PersistedDecisionConflict,
  type PersistedDecisionOperationalEvidence,
  type PersistedDecisionQuality,
  type PersistedDecisionQualityCode,
  type PersistedDecisionSource,
} from "./persisted-decision-read";
import type {
  RegistryV2LaboratoryBindingSource,
  RegistryV2NormalizationRevisionReadBoundary,
} from "./observation-read-boundaries";
export type LaboratoryOutcomeSource = PersistedDecisionSource;

/**
 * Consumer eligibility exclusions. The shared identity gates are evaluated
 * exactly once by the assessment eligibility predicate; every consumer surface
 * derives its exclusion from that result, and only `conversion_unavailable`
 * stays consumer-local so the two axes cannot drift.
 */
export type LaboratoryConsumerExclusionReason =
  | AssessmentExclusionReason
  | "conversion_unavailable";

export type LaboratoryConsumerEligibility = Readonly<{
  trendEligible: boolean;
  conversionEligible: boolean;
  reportEligible: boolean;
  structuredContextEligible: boolean;
  assessmentEligible: boolean;
  exclusions: Readonly<{
    trend: AssessmentExclusionReason | null;
    conversion: LaboratoryConsumerExclusionReason | null;
    report: AssessmentExclusionReason | null;
    structuredContext: AssessmentExclusionReason | null;
    assessment: AssessmentExclusionReason | null;
  }>;
}>;

export type LaboratoryResolutionDetails = Readonly<{
  source: LaboratoryOutcomeSource;
  quality: PersistedDecisionQuality;
  notPersisted: boolean;
  qualityCodes: readonly PersistedDecisionQualityCode[];
  conflictDetails: readonly PersistedDecisionConflict[];
  outcome: ResolverResult | null;
  verificationStatus: VerificationStatus | null;
  mappingConfidence: number | null;
  mappingConfidenceBand: MappingConfidenceBand | null;
  missingAxes: readonly ClinicalCompatibilityAxis[];
  /**
   * #114: the smallest set of axes that would unblock this row, for copy.
   * `missingAxes` unions every candidate and over-reports what the reader would
   * actually have to state — glucose collected four when stating one resolves it.
   */
  minimalMissingAxes: readonly ClinicalCompatibilityAxis[];
  conflictCodes: readonly ResolutionReasonCode[];
  supportCodes: readonly ResolutionReasonCode[];
  candidateCount: number;
  /**
   * #114: the one reason this row did not resolve, or null when it did. Present
   * for a preview as well as for an active revision, because a row awaiting
   * first review is exactly where the reviewer reads the explanation.
   */
  incompleteReason: IncompleteReasonClass | null;
  storedIdentity: Readonly<{
    measurementDefinitionKey: string | null;
    analyteKey: string | null;
    winningCandidateKey: string | null;
    selectedCandidateKey: string | null;
  }>;
  versions: Readonly<{
    catalog: string | null;
    catalogDigest: string | null;
    resolver: string | null;
    normalization: string | null;
    trace: number | null;
    traceSchemaVersion: string | null;
    inputIdentityFormatVersion: string | null;
    compatibilityPolicy: string | null;
  }>;
  eligibility: LaboratoryConsumerEligibility;
}>;

export type LaboratoryOutcomeSummary = Readonly<{
  outcome: ResolverResult | null;
  verificationStatus: VerificationStatus | null;
  measurementDefinitionKey: string | null;
  analyteKey: string | null;
  storedMeasurementDefinitionKey: string | null;
  storedAnalyteKey: string | null;
  registryBindingReady: boolean;
  assessmentInputKey: string | null;
  resolvedMeasurementBinding: ResolvedReviewedMeasurementBinding | null;
  resolutionDetails: LaboratoryResolutionDetails;
}>;

export type ResolutionOutcomeMetric = Readonly<{
  name: "resolution_outcome";
  outcome: ResolverResult;
  /**
   * #114: a closed enum, no free text and no candidate key, so the existing
   * privacy allowlist guarantee is unchanged.
   */
  incompleteReason: IncompleteReasonClass | null;
  mappingConfidenceBand: MappingConfidenceBand;
  missingAxes: readonly ClinicalCompatibilityAxis[];
  conflictCodes: readonly ResolutionReasonCode[];
  writeKind: "acceptance" | "correction" | "value_correction" | "reversal";
  resolverVersion: string;
  catalogVersion: string;
  compatibilityPolicyVersion: string;
  consumerExclusionReasons: readonly LaboratoryConsumerExclusionReason[];
}>;

type DecisionTraceLike = {
  version?: number;
  compatibilityPolicyVersion?: string;
  selectedCandidateKey?: string | null;
  runnerUpCandidateKey?: string | null;
  outcome?: ResolverResult | null;
  missingAxes?: readonly ClinicalCompatibilityAxis[];
  conflicts?: readonly ResolutionReasonCode[];
  admissibilityRejections?: readonly AdmissibilityRejectionCode[];
  candidates?: readonly {
    accepted?: readonly { code?: ResolutionReasonCode }[];
    missing?: readonly { code?: ResolutionReasonCode }[];
    rejected?: readonly { code?: ResolutionReasonCode }[];
    missingAxes?: readonly ClinicalCompatibilityAxis[];
    /** #114: a hard conflict makes a candidate unselectable. */
    selectable?: boolean;
    /** #114: why admissibility excluded this candidate. */
    admissibilityRejections?: readonly AdmissibilityRejectionCode[];
    candidateKey?: string;
  }[];
};

type AssessmentEligibilityObservation = RegistryV2LaboratoryBindingSource & {
  value?: unknown;
  value_kind?: string | null;
  value_text?: string | null;
  ref_low?: unknown;
  ref_high?: unknown;
  raw_reference_text?: string | null;
};

type OutcomeProjectionOptions = {
  observation: AssessmentEligibilityObservation;
  relation:
    | RegistryV2NormalizationRevisionReadBoundary
    | readonly RegistryV2NormalizationRevisionReadBoundary[]
    | null
    | undefined;
  preview?: MeasurementResolution | null;
};

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

function asDecisionTraceLike(
  evidence: PersistedDecisionOperationalEvidence,
): DecisionTraceLike {
  return {
    ...evidence,
    missingAxes: evidence.missingAxes as
      | readonly ClinicalCompatibilityAxis[]
      | undefined,
    conflicts: evidence.conflictCodes as
      | readonly ResolutionReasonCode[]
      | undefined,
    admissibilityRejections: evidence.admissibilityRejections as
      | readonly AdmissibilityRejectionCode[]
      | undefined,
    candidates:
      evidence.candidates as unknown as DecisionTraceLike["candidates"],
  };
}

function mergeDecisionTrace(
  technicalTrace: NonNullable<
    ReturnType<typeof readPersistedDecision>
  >["technicalTrace"],
  operationalEvidence: PersistedDecisionOperationalEvidence | null,
  previewTrace: MeasurementResolution["decisionTrace"] | null,
): DecisionTraceLike | null {
  const operationalTrace = operationalEvidence
    ? asDecisionTraceLike(operationalEvidence)
    : null;
  if (technicalTrace !== null && operationalTrace !== null) {
    const topLevelRejections = operationalTrace.admissibilityRejections;
    return {
      ...technicalTrace,
      missingAxes: uniqueSorted([
        ...technicalTrace.missingAxes,
        ...(operationalTrace.missingAxes ?? []),
      ]),
      conflicts: uniqueSorted([
        ...technicalTrace.conflicts,
        ...(operationalTrace.conflicts ?? []),
      ]),
      candidates: technicalTrace.candidates.map((candidate) => {
        const operationalCandidate = operationalTrace.candidates?.find(
          (entry) => entry.candidateKey === candidate.candidateKey,
        );
        const admissibilityRejections =
          operationalCandidate?.admissibilityRejections ?? topLevelRejections;
        return {
          ...candidate,
          ...(operationalCandidate?.selectable !== undefined
            ? { selectable: operationalCandidate.selectable }
            : {}),
          ...(admissibilityRejections !== undefined
            ? { admissibilityRejections }
            : {}),
        };
      }),
    };
  }
  return technicalTrace ?? operationalTrace ?? previewTrace;
}

function summarizeTrace(trace: DecisionTraceLike | null | undefined) {
  const candidates = trace?.candidates ?? [];
  const missingAxes = uniqueSorted([
    ...(trace?.missingAxes ?? []),
    ...candidates.flatMap((candidate) => candidate.missingAxes ?? []),
  ]);
  const conflictCodes = uniqueSorted([
    ...(trace?.conflicts ?? []),
    ...candidates.flatMap((candidate) =>
      (candidate.rejected ?? []).flatMap((evidence) =>
        evidence.code ? [evidence.code] : [],
      ),
    ),
  ]);
  const candidateMinimalMissingAxes = minimalBlockingAxes(candidates);
  return {
    missingAxes,
    conflictCodes,
    supportCodes: uniqueSorted(
      candidates.flatMap((candidate) =>
        (candidate.accepted ?? []).flatMap((evidence) =>
          evidence.code ? [evidence.code] : [],
        ),
      ),
    ),
    candidateCount: candidates.length,
    // #114: the union above is the evidence record; this is what the copy says.
    minimalMissingAxes:
      candidateMinimalMissingAxes.length > 0
        ? candidateMinimalMissingAxes
        : missingAxes,
    admissibilityRejections: uniqueSorted([
      ...(trace?.admissibilityRejections ?? []),
      ...candidates.flatMap(
        (candidate) => candidate.admissibilityRejections ?? [],
      ),
    ]),
    selectableCount: candidates.filter(
      (candidate) => candidate.selectable !== false,
    ).length,
  };
}

const SHARED_IDENTITY_EXCLUSIONS = new Set<AssessmentExclusionReason>([
  "no_active_revision",
  "incomplete_resolution",
  "candidate_only_identity",
]);

function parseObservationValueKind(
  value: string | null | undefined,
): ValueKind | null {
  switch (value) {
    case "numeric":
    case "qualitative":
    case "ordinal":
    case "text":
      return value;
    default:
      return null;
  }
}

function buildEligibility(options: {
  conversionEligible: boolean;
  assessmentEligibility: AssessmentEligibility;
}): LaboratoryConsumerEligibility {
  const assessmentExclusion = options.assessmentEligibility.exclusionReason;
  const sharedExclusion =
    assessmentExclusion !== null &&
    SHARED_IDENTITY_EXCLUSIONS.has(assessmentExclusion)
      ? assessmentExclusion
      : null;
  const trendEligible = sharedExclusion === null;
  const conversionExclusion =
    sharedExclusion ??
    (options.conversionEligible ? null : "conversion_unavailable");

  return {
    trendEligible,
    conversionEligible: conversionExclusion === null,
    reportEligible: trendEligible,
    structuredContextEligible: trendEligible,
    assessmentEligible: options.assessmentEligibility.eligible,
    exclusions: {
      trend: sharedExclusion,
      conversion: conversionExclusion,
      report: sharedExclusion,
      structuredContext: sharedExclusion,
      assessment: assessmentExclusion,
    },
  };
}

export function projectLaboratoryOutcome(
  options: OutcomeProjectionOptions,
): LaboratoryOutcomeSummary {
  const decision = readPersistedDecision({
    observation: options.observation,
    relation: options.relation,
    preview: options.preview,
  });
  const trace = mergeDecisionTrace(
    decision.technicalTrace,
    decision.operationalEvidence,
    decision.preview?.decisionTrace ?? null,
  );
  const { admissibilityRejections, selectableCount, ...traceFields } =
    summarizeTrace(trace);
  const outcome = decision.stored.outcome;
  const verificationStatus =
    decision.stored.verificationStatus === "pending" ||
    decision.stored.verificationStatus === "auto_verified" ||
    decision.stored.verificationStatus === "user_verified" ||
    decision.stored.verificationStatus === "manually_corrected"
      ? decision.stored.verificationStatus
      : null;
  const currentDefinition = decision.currentBindingReady
    ? decision.measurementDefinition
    : null;
  const reviewedAssessmentBinding = currentDefinition?.assessmentBindings.find(
    (assessmentBinding) =>
      assessmentBinding.status === "reviewed" &&
      assessmentBinding.compatibility === "compatible",
  );
  const assessmentEligibility =
    decision.source === "persisted"
      ? evaluateAssessmentEligibility({
          hasActiveRevision: true,
          outcome,
          registryBindingReady: decision.currentBindingReady,
          hasReviewedAssessmentBinding: reviewedAssessmentBinding != null,
          verificationStatus,
          valueKind: parseObservationValueKind(options.observation.value_kind),
          value: options.observation.value,
          valueText: options.observation.value_text,
          rawReferenceText: options.observation.raw_reference_text,
          refLow: options.observation.ref_low,
          refHigh: options.observation.ref_high,
        })
      : ineligibleAssessmentEligibility();
  const eligibility = buildEligibility({
    conversionEligible: decision.resolvedMeasurementBinding !== null,
    assessmentEligibility,
  });
  const resolutionDetails: LaboratoryResolutionDetails = {
    source: decision.source,
    quality: decision.quality,
    notPersisted: decision.notPersisted,
    qualityCodes: decision.qualityCodes,
    conflictDetails: decision.conflicts,
    outcome,
    verificationStatus,
    mappingConfidence: decision.stored.mappingConfidence,
    mappingConfidenceBand:
      (decision.stored.mappingConfidenceBand as MappingConfidenceBand | null) ??
      null,
    ...traceFields,
    incompleteReason: classifyIncompleteReason({
      outcome,
      candidateCount: traceFields.candidateCount,
      conflictCount: traceFields.conflictCodes.length,
      selectableCount,
      admissibilityRejections,
    }),
    storedIdentity: {
      measurementDefinitionKey: decision.stored.measurementDefinitionKey,
      analyteKey: decision.stored.analyteKey,
      winningCandidateKey: decision.technicalTrace?.winningCandidateKey ?? null,
      selectedCandidateKey:
        decision.operationalEvidence?.selectedCandidateKey ?? null,
    },
    versions: {
      catalog: decision.release.catalogManifestVersion,
      catalogDigest: decision.release.catalogManifestDigest,
      resolver: decision.release.resolverVersion,
      normalization: decision.release.normalizationVersion,
      trace:
        typeof decision.operationalEvidence?.version === "number"
          ? decision.operationalEvidence.version
          : null,
      traceSchemaVersion: decision.release.traceSchemaVersion,
      inputIdentityFormatVersion: decision.stored.inputIdentityFormatVersion,
      compatibilityPolicy:
        decision.operationalEvidence?.compatibilityPolicyVersion ?? null,
    },
    eligibility,
  };
  return {
    outcome,
    verificationStatus,
    measurementDefinitionKey: decision.currentBindingReady
      ? decision.stored.measurementDefinitionKey
      : null,
    analyteKey: decision.currentBindingReady
      ? (currentDefinition?.analyteKey ?? decision.stored.analyteKey)
      : null,
    storedMeasurementDefinitionKey: decision.stored.measurementDefinitionKey,
    storedAnalyteKey: decision.stored.analyteKey,
    registryBindingReady: decision.currentBindingReady,
    assessmentInputKey: assessmentEligibility.eligible
      ? (reviewedAssessmentBinding?.assessmentInputKey ?? null)
      : null,
    resolvedMeasurementBinding: decision.resolvedMeasurementBinding,
    resolutionDetails,
  };
}

export function serializeLaboratoryOutcome<
  T extends AssessmentEligibilityObservation,
>(options: OutcomeProjectionOptions & { observation: T }) {
  const outcome = projectLaboratoryOutcome(options);
  return {
    ...options.observation,
    measurement_definition_key: outcome.measurementDefinitionKey,
    analyte_key: outcome.analyteKey,
    resolution_status: outcome.outcome,
    resolver_result: outcome.outcome,
    verification_status: outcome.verificationStatus,
    registry_binding_ready: outcome.registryBindingReady,
    decision_source: outcome.resolutionDetails.source,
    decision_quality: outcome.resolutionDetails.quality,
    decision_not_persisted: outcome.resolutionDetails.notPersisted,
    decision_quality_codes: outcome.resolutionDetails.qualityCodes,
    resolution_details: outcome.resolutionDetails,
  };
}

export function buildResolutionOutcomeMetric(options: {
  resolution: MeasurementResolution;
  writeKind: "acceptance" | "correction" | "value_correction" | "reversal";
  resolverVersion: string;
  catalogVersion: string;
}): ResolutionOutcomeMetric {
  const consumerExclusionReasons: LaboratoryConsumerExclusionReason[] =
    options.resolution.result === "resolved" ? [] : ["incomplete_resolution"];

  return {
    name: "resolution_outcome",
    outcome: options.resolution.result,
    incompleteReason: incompleteReasonClass(options.resolution),
    mappingConfidenceBand: options.resolution.mappingConfidenceBand,
    missingAxes: uniqueSorted(options.resolution.missingAxes),
    conflictCodes: uniqueSorted(options.resolution.conflicts),
    writeKind: options.writeKind,
    resolverVersion: options.resolverVersion,
    catalogVersion: options.catalogVersion,
    compatibilityPolicyVersion:
      options.resolution.decisionTrace.compatibilityPolicyVersion,
    consumerExclusionReasons,
  };
}

export function emitResolutionOutcomeMetric(
  metric: ResolutionOutcomeMetric,
): void {
  console.info("[metric]", JSON.stringify(metric));
}

export function emitResolutionOutcomeMetricForWrite(options: {
  wasReused: boolean;
  metric: ResolutionOutcomeMetric;
}): boolean {
  if (options.wasReused) return false;
  emitResolutionOutcomeMetric(options.metric);
  return true;
}
