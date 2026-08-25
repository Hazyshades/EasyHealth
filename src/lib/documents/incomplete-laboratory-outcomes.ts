import type {
  AdmissibilityRejectionCode,

  ClinicalCompatibilityAxis,

  IncompleteReasonClass,
  MappingConfidenceBand,
  MeasurementResolution,
  ResolutionReasonCode,
  ResolverDecisionTrace,
  ResolverResult,
  VerificationStatus,
  ResolvedReviewedMeasurementBinding,
} from "@/lib/biomarkers";
import { classifyIncompleteReason, incompleteReasonClass, minimalBlockingAxes, type ValueKind } from "@/lib/biomarkers";
import {
  evaluateAssessmentEligibility,
  ineligibleAssessmentEligibility,
  type AssessmentEligibility,
  type AssessmentExclusionReason,
} from "@/lib/health-profile-assessment-eligibility";
import {
  projectActiveRegistryV2LaboratoryBinding,
  type RegistryV2LaboratoryBindingSource,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "./observation-read-boundaries";
export type LaboratoryOutcomeSource = "active_revision" | "preview" | "none";

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
  versions: Readonly<{
    catalog: string | null;
    resolver: string | null;
    normalization: string | null;
    trace: number | null;
    compatibilityPolicy: string | null;
  }>;
  eligibility: LaboratoryConsumerEligibility;
}>;

export type LaboratoryOutcomeSummary = Readonly<{
  outcome: ResolverResult | null;
  verificationStatus: VerificationStatus | null;
  measurementDefinitionKey: string | null;
  analyteKey: string | null;
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

type DecisionTraceLike = Partial<ResolverDecisionTrace> & {
  candidates?: readonly {
    accepted?: readonly { code?: ResolutionReasonCode }[];
    missing?: readonly { code?: ResolutionReasonCode }[];
    rejected?: readonly { code?: ResolutionReasonCode }[];
    missingAxes?: readonly ClinicalCompatibilityAxis[];
    /** #114: a hard conflict makes a candidate unselectable, which is what makes the conflict this row's blocker. */
    selectable?: boolean;
    /** #114: why admissibility excluded this candidate, when the resolver recorded it. */
    admissibilityRejections?: readonly AdmissibilityRejectionCode[];
  }[];
};

type AssessmentEligibilityObservation = RegistryV2LaboratoryBindingSource & {
  value?: unknown;
  value_kind?: string | null;
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

function summarizeTrace(trace: DecisionTraceLike | null | undefined) {
  const candidates = trace?.candidates ?? [];
  return {
    missingAxes: uniqueSorted(
      candidates.flatMap((candidate) => candidate.missingAxes ?? [])
    ),
    conflictCodes: uniqueSorted(
      candidates.flatMap((candidate) =>
        (candidate.rejected ?? []).flatMap((evidence) =>
          evidence.code ? [evidence.code] : []
        )
      )
    ),
    supportCodes: uniqueSorted(
      candidates.flatMap((candidate) =>
        (candidate.accepted ?? []).flatMap((evidence) =>
          evidence.code ? [evidence.code] : []
        )
      )
    ),
    candidateCount: candidates.length,
    // #114: the union above is the evidence record; this is what the copy says.
    minimalMissingAxes: minimalBlockingAxes(candidates),
    admissibilityRejections: uniqueSorted(
      candidates.flatMap((candidate) => candidate.admissibilityRejections ?? [])
    ),
    selectableCount: candidates.filter((candidate) => candidate.selectable !== false).length,
  };
}

const SHARED_IDENTITY_EXCLUSIONS = new Set<AssessmentExclusionReason>([
  "no_active_revision",
  "incomplete_resolution",
  "candidate_only_identity",
]);

function parseObservationValueKind(value: string | null | undefined): ValueKind | null {
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
    assessmentExclusion !== null && SHARED_IDENTITY_EXCLUSIONS.has(assessmentExclusion)
      ? assessmentExclusion
      : null;
  const trendEligible = sharedExclusion === null;
  const conversionExclusion =
    sharedExclusion ?? (options.conversionEligible ? null : "conversion_unavailable");

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
  options: OutcomeProjectionOptions
): LaboratoryOutcomeSummary {
  const binding = projectActiveRegistryV2LaboratoryBinding(
    options.observation,
    options.relation
  );
  const activeRevision = binding.activeRevision;

  if (activeRevision) {
    const trace = activeRevision.resolver_evidence as DecisionTraceLike | null;
    const { admissibilityRejections, selectableCount, ...traceFields } = summarizeTrace(trace);
    const definition = binding.measurementDefinition;
    const reviewedAssessmentBinding = definition?.assessmentBindings.find(
      (assessmentBinding) =>
        assessmentBinding.status === "reviewed" &&
        assessmentBinding.compatibility === "compatible"
    );
    const assessmentEligibility = evaluateAssessmentEligibility({
      hasActiveRevision: true,
      outcome: binding.resolutionStatus as ResolverResult | null,
      registryBindingReady: binding.registryBindingReady,
      hasReviewedAssessmentBinding: reviewedAssessmentBinding != null,
      verificationStatus: binding.verificationStatus,
      valueKind: parseObservationValueKind(options.observation.value_kind),
      value: options.observation.value,
      rawReferenceText: options.observation.raw_reference_text,
      refLow: options.observation.ref_low,
      refHigh: options.observation.ref_high,
    });
    const eligibility = buildEligibility({
      conversionEligible: binding.resolvedMeasurementBinding !== null,
      assessmentEligibility,
    });

    return {
      outcome: binding.resolutionStatus as ResolverResult | null,
      verificationStatus: binding.verificationStatus as VerificationStatus | null,
      measurementDefinitionKey: binding.measurementDefinitionKey,
      analyteKey: binding.registryBindingReady
        ? (definition?.analyteKey ?? null)
        : null,
      registryBindingReady: binding.registryBindingReady,
      assessmentInputKey: assessmentEligibility.eligible
        ? reviewedAssessmentBinding?.assessmentInputKey ?? null
        : null,
      resolvedMeasurementBinding: binding.resolvedMeasurementBinding,
      resolutionDetails: {
        source: "active_revision",
        outcome: binding.resolutionStatus as ResolverResult | null,
        verificationStatus:
          binding.verificationStatus as VerificationStatus | null,
        mappingConfidence: activeRevision.mapping_confidence ?? null,
        mappingConfidenceBand:
          (activeRevision.mapping_confidence_band as MappingConfidenceBand | null) ??
          null,
        ...traceFields,
        incompleteReason: classifyIncompleteReason({
          outcome: binding.resolutionStatus as ResolverResult | null,
          candidateCount: traceFields.candidateCount,
          conflictCount: traceFields.conflictCodes.length,
          selectableCount,
          admissibilityRejections,
        }),
        versions: {
          catalog: activeRevision.catalog_manifest_version ?? null,
          resolver: activeRevision.resolver_version ?? null,
          normalization: activeRevision.normalization_version ?? null,
          trace: typeof trace?.version === "number" ? trace.version : null,
          compatibilityPolicy: trace?.compatibilityPolicyVersion ?? null,
        },
        eligibility,
      },
    };
  }

  if (options.preview) {
    const { admissibilityRejections, selectableCount, ...traceFields } = summarizeTrace(options.preview.decisionTrace);
    const eligibility = buildEligibility({
      conversionEligible: false,
      assessmentEligibility: ineligibleAssessmentEligibility(),
    });
    return {
      outcome: options.preview.result,
      verificationStatus: "pending",
      measurementDefinitionKey: null,
      analyteKey: null,
      registryBindingReady: false,
      assessmentInputKey: null,
      resolvedMeasurementBinding: null,
      resolutionDetails: {
        source: "preview",
        outcome: options.preview.result,
        verificationStatus: "pending",
        mappingConfidence: options.preview.mappingConfidence,
        mappingConfidenceBand: options.preview.mappingConfidenceBand,
        ...traceFields,
        // #114: the preview path is the one issue #114 is about — a row awaiting
        // first review has no active revision, so this is the only place the
        // reviewer's explanation can come from.
        incompleteReason: classifyIncompleteReason({
          outcome: options.preview.result,
          candidateCount: traceFields.candidateCount,
          conflictCount: traceFields.conflictCodes.length,
          selectableCount,
          admissibilityRejections,
        }),
        versions: {
          catalog: null,
          resolver: null,
          normalization: null,
          trace: options.preview.decisionTrace.version,
          compatibilityPolicy:
            options.preview.decisionTrace.compatibilityPolicyVersion,
        },
        eligibility,
      },
    };
  }

  const eligibility = buildEligibility({
    conversionEligible: false,
    assessmentEligibility: ineligibleAssessmentEligibility(),
  });
  return {
    outcome: null,
    verificationStatus: null,
    measurementDefinitionKey: null,
    analyteKey: null,
    registryBindingReady: false,
    assessmentInputKey: null,
    resolvedMeasurementBinding: null,
    resolutionDetails: {
      source: "none",
      outcome: null,
      verificationStatus: null,
      mappingConfidence: null,
      mappingConfidenceBand: null,
      missingAxes: [],
      minimalMissingAxes: [],
      conflictCodes: [],
      supportCodes: [],
      candidateCount: 0,
      // No outcome at all, so there is nothing to explain.
      incompleteReason: null,
      versions: {
        catalog: null,
        resolver: null,
        normalization: null,
        trace: null,
        compatibilityPolicy: null,
      },
      eligibility,
    },
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

export function emitResolutionOutcomeMetric(metric: ResolutionOutcomeMetric): void {
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
