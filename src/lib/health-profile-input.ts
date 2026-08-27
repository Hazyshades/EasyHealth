import { getReviewedAssessmentBinding, isCensoredLabValueCell, presentObservation, type LabUnitSystem } from "@/lib/biomarkers";
import { buildHealthProfile } from "@/lib/health-systems";
import {
  type RegistryV2LaboratoryBindingSource,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "@/lib/documents/observation-read-boundaries";
import { projectLaboratoryOutcome } from "@/lib/documents/incomplete-laboratory-outcomes";

type HealthProfileLaboratoryObservation = RegistryV2LaboratoryBindingSource & {
  id?: string | null;
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

/**
 * Projects a scoped laboratory observation into the exact input accepted by
 * buildHealthProfile. All admission gates remain delegated to the single
 * production outcome projection.
 */
export function projectHealthProfileLaboratoryInput(options: {
  observation: HealthProfileLaboratoryObservation;
  relation: HealthProfileLaboratoryRelation;
  labUnitSystem: LabUnitSystem;
}): HealthProfileLaboratoryInput | null {
  const { observation, relation, labUnitSystem } = options;
  const outcome = projectLaboratoryOutcome({ observation, relation });
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
  if (!assessmentInputKey) return null;

  if (censoredValueText) {
    const refLow = observation.ref_low == null ? null : Number(observation.ref_low);
    const refHigh = observation.ref_high == null ? null : Number(observation.ref_high);
    return {
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
    };
  }

  const numericValue = observation.value != null ? Number(observation.value) : null;
  if (numericValue === null || !Number.isFinite(numericValue)) return null;

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
  };
}
