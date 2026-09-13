import {
  getReviewedAssessmentBinding,
  isCensoredLabValueCell,
  presentObservation,
  type LabUnitSystem,
  type ResolverResult,
  type VerificationStatus,
} from "@/lib/biomarkers";
import { buildHealthProfile } from "@/lib/health-systems";
import type { AssessmentExclusionReason } from "@/lib/health-profile-assessment-eligibility";
import {
  getActiveRegistryV2NormalizationRevision,
  type RegistryV2LaboratoryBindingSource,
  type RegistryV2NormalizationRevisionReadBoundary,
  type RegistryV2ResolverEvidence,
} from "@/lib/documents/observation-read-boundaries";
import {
  projectLaboratoryOutcome,
  type LaboratoryOutcomeSummary,
  type LaboratoryResolutionDetails,
} from "@/lib/documents/incomplete-laboratory-outcomes";

type HealthProfileLaboratoryObservation = RegistryV2LaboratoryBindingSource & {
  id?: string | null;
  analyte_key?: string | null;
  measurement_definition_key?: string | null;
  resolution_status?: string | null;
  name: string;
  value: number | string | null;
  unit: string | null;
  ref_low: number | string | null;
  ref_high: number | string | null;
  raw_reference_text: string | null;
  observed_at: string | null;
  document_id: string | null;
  value_kind: string | null;
  value_text: string | null;
  ordinal: number | string | null;
  specimen: string | null;
  modifier: string | null;
};

type HealthProfileLaboratoryRelation =
  | RegistryV2NormalizationRevisionReadBoundary
  | readonly RegistryV2NormalizationRevisionReadBoundary[]
  | null
  | undefined;

export type HealthProfileLaboratoryInput = Parameters<typeof buildHealthProfile>[0][number];

export type HealthProfileLaboratoryAdmissionEvidence = Readonly<{
  outcome: LaboratoryOutcomeSummary;
  resolution: LaboratoryResolutionDetails;
  resolverEvidence: RegistryV2ResolverEvidence | null;
  binding: Readonly<{
    measurementDefinitionKey: string | null;
    analyteKey: string | null;
    assessmentInputKey: string | null;
    registryBindingReady: boolean;
    verificationStatus: VerificationStatus | null;
  }>;
  canonical: Readonly<{
    outcome: ResolverResult | null;
    incompleteReason: LaboratoryResolutionDetails["incompleteReason"];
  }>;
}>;

export type HealthProfileLaboratoryAdmission =
  | Readonly<{
      kind: "accepted";
      input: HealthProfileLaboratoryInput;
      evidence: HealthProfileLaboratoryAdmissionEvidence;
    }>
  | Readonly<{
      kind: "excluded";
      reason: AssessmentExclusionReason;
      evidence: HealthProfileLaboratoryAdmissionEvidence;
    }>;

/**
 * Projects one persisted laboratory observation into the Health Profile
 * assessment decision. Resolver interpretation and admission ordering remain
 * delegated to the single production outcome projection.
 */
export function projectHealthProfileLaboratoryAdmission(options: {
  observation: HealthProfileLaboratoryObservation;
  relation: HealthProfileLaboratoryRelation;
  labUnitSystem: LabUnitSystem;
}): HealthProfileLaboratoryAdmission {
  const { observation, relation, labUnitSystem } = options;
  const outcome: LaboratoryOutcomeSummary = projectLaboratoryOutcome({
    observation,
    relation,
  });
  const activeRevision = getActiveRegistryV2NormalizationRevision(relation);
  const evidence: HealthProfileLaboratoryAdmissionEvidence = {
    outcome,
    resolution: outcome.resolutionDetails,
    resolverEvidence: activeRevision?.resolver_evidence ?? null,
    binding: {
      measurementDefinitionKey: outcome.measurementDefinitionKey,
      analyteKey: outcome.analyteKey,
      assessmentInputKey: outcome.assessmentInputKey,
      registryBindingReady: outcome.registryBindingReady,
      verificationStatus: outcome.verificationStatus,
    },
    canonical: {
      outcome: outcome.outcome,
      incompleteReason: outcome.resolutionDetails.incompleteReason,
    },
  };
  const censoredValueText =
    [observation.value_text, typeof observation.value === "string" ? observation.value : null]
      .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
      .find((candidate) => isCensoredLabValueCell(candidate)) ?? null;
  const canPreserveCensoredMarker =
    censoredValueText !== null &&
    outcome.resolutionDetails.eligibility.exclusions.assessment === "non_numeric_value";
  const assessmentInputKey =
    outcome.assessmentInputKey ??
    (canPreserveCensoredMarker && outcome.measurementDefinitionKey
      ? getReviewedAssessmentBinding(outcome.measurementDefinitionKey)?.binding.assessmentInputKey ?? null
      : null);
  const evidenceWithAdmissionKey: HealthProfileLaboratoryAdmissionEvidence = {
    ...evidence,
    binding: {
      ...evidence.binding,
      assessmentInputKey,
    },
  };
  if (!assessmentInputKey) {
    return {
      kind: "excluded",
      reason:
        outcome.resolutionDetails.eligibility.exclusions.assessment ??
        "assessment_binding_ineligible",
      evidence: evidenceWithAdmissionKey,
    };
  }

  if (censoredValueText) {
    const refLow = observation.ref_low == null ? null : Number(observation.ref_low);
    const refHigh = observation.ref_high == null ? null : Number(observation.ref_high);
    return {
      kind: "accepted",
      input: {
        biomarker_key: assessmentInputKey,
        observation_id: observation.id ?? null,
        measurement_definition_key: outcome.measurementDefinitionKey,
        name: observation.name,
        value: null,
        unit: observation.unit ?? "",
        ref_low: refLow != null && Number.isFinite(refLow) ? refLow : null,
        ref_high: refHigh != null && Number.isFinite(refHigh) ? refHigh : null,
        observed_at: observation.observed_at,
        document_id: observation.document_id,
        observation_kind: "lab",
        value_kind: "text",
        value_text: censoredValueText,
        ordinal: null,
        specimen: observation.specimen ?? "unspecified",
        modifier: observation.modifier ?? "none",
        converted: false,
        conversion_note: null,
      },
      evidence: evidenceWithAdmissionKey,
    };
  }

  const numericValue = observation.value != null ? Number(observation.value) : null;
  if (numericValue === null || !Number.isFinite(numericValue)) {
    return {
      kind: "excluded",
      reason:
        outcome.resolutionDetails.eligibility.exclusions.assessment ??
        "numeric_value_invalid",
      evidence: evidenceWithAdmissionKey,
    };
  }

  const display = presentObservation(
    {
      resolved_measurement_binding: outcome.resolvedMeasurementBinding,
      value: numericValue,
      unit: observation.unit ?? "",
      ref_low: observation.ref_low != null ? Number(observation.ref_low) : null,
      ref_high: observation.ref_high != null ? Number(observation.ref_high) : null,
    },
    labUnitSystem,
  );
  return {
    kind: "accepted",
    input: {
      biomarker_key: assessmentInputKey,
      observation_id: observation.id ?? null,
      measurement_definition_key: outcome.measurementDefinitionKey,
      name: observation.name,
      value: display.value,
      unit: display.unit,
      ref_low: display.ref_low,
      ref_high: display.ref_high,
      observed_at: observation.observed_at,
      document_id: observation.document_id,
      observation_kind: "lab",
      value_kind: "numeric",
      value_text: observation.value_text ?? String(display.value),
      ordinal: null,
      specimen: observation.specimen ?? "unspecified",
      modifier: observation.modifier ?? "none",
      converted: display.converted,
      conversion_note: display.conversion_note,
      original_value: display.original_value,
      original_unit: display.original_unit,
    },
    evidence,
  };
}
