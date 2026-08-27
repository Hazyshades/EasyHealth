import { createHash } from "node:crypto";
import {
  getReviewedAssessmentBinding,
  type LabUnitSystem,
} from "../src/lib/biomarkers";
import {
  getRegistryV2ScoreReadinessGroups,
  NAMED_BODY_SYSTEMS,
} from "../src/lib/biomarkers/registry-v2-runtime";
import type { NamedBodySystemId } from "../src/lib/biomarkers/types";
import { projectLaboratoryOutcome } from "../src/lib/documents/incomplete-laboratory-outcomes";
import { projectHealthProfileLaboratoryInput } from "../src/lib/health-profile-input";
import type { AssessmentExclusionReason } from "../src/lib/health-profile-assessment-eligibility";
import {
  buildHealthProfile,
  HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
  type ObservationInput,
} from "../src/lib/health-systems";

export const EH147_PACK_VERSION = "eh147-golden-v1";
export const EH147_FRESHNESS_AS_OF = "2026-08-01";
export const EH147_FRESHNESS_EVALUATED_AT = "2026-08-01T00:00:00.000Z";
export const EH147_DOCUMENT_ID = "eh147-fixture-document";

export type GoldenFamily =
  | "complete-in-range"
  | "complete-out-of-range"
  | "si-us-units"
  | "missing-group"
  | "invalid-reference"
  | "context-only"
  | "alternatives"
  | "inflammation"
  | "correction";

export type SystemExpectation = Readonly<{
  scoreability: string;
  state_score: number | null;
  readiness_codes: readonly string[];
  satisfied_by?: Readonly<Record<string, string>>;
}>;

export type ProfileExpectation = Readonly<{
  overall_state_score: number | null;
  systems: Readonly<Record<string, SystemExpectation>>;
  markers?: Readonly<
    Record<
      string,
      Readonly<{
        unit: string;
        status: string;
        converted?: boolean;
      }>
    >
  >;
}>;

export type AdmissionExpectation = Readonly<{
  eligible: boolean;
  exclusionReason: AssessmentExclusionReason | null;
}>;

export type GoldenCase = Readonly<{
  id: string;
  family: GoldenFamily;
  description: string;
  kind: "profile" | "admission";
  labUnitSystem?: LabUnitSystem;
  observations?: readonly ObservationInput[];
  admission?: Readonly<{
    observation: Parameters<typeof projectHealthProfileLaboratoryInput>[0]["observation"];
    relation: Parameters<typeof projectHealthProfileLaboratoryInput>[0]["relation"];
  }>;
}>;

const SOURCE = {
  id: EH147_DOCUMENT_ID,
  original_filename: "eh147-synthetic-labs.pdf",
  observed_at: EH147_FRESHNESS_AS_OF,
  lab_name: "Synthetic laboratory",
  document_type: "lab_result",
} as const;

type MarkerSpec = Readonly<{
  key: string;
  value: number;
  unit?: string;
  refLow: number | null;
  refHigh: number | null;
}>;

const IN_RANGE: Record<string, MarkerSpec> = {
  ldl: { key: "ldl", value: 2.5, refLow: 1.5, refHigh: 3.0 },
  hdl: { key: "hdl", value: 1.4, refLow: 1.0, refHigh: 2.0 },
  triglycerides: { key: "triglycerides", value: 1.2, refLow: 0.5, refHigh: 1.7 },
  fasting_glucose: { key: "fasting_glucose", value: 5.0, refLow: 3.9, refHigh: 5.6 },
  hba1c: { key: "hba1c", value: 5.4, unit: "%", refLow: 4.0, refHigh: 5.6 },
  tsh: { key: "tsh", value: 2.0, refLow: 0.4, refHigh: 4.0 },
  free_t4: { key: "free_t4", value: 15, refLow: 9, refHigh: 19 },
  alt: { key: "alt", value: 25, refLow: 0, refHigh: 40 },
  ast: { key: "ast", value: 25, refLow: 0, refHigh: 40 },
  alp: { key: "alp", value: 80, refLow: 40, refHigh: 129 },
  bilirubin: { key: "bilirubin", value: 12, refLow: 5, refHigh: 21 },
  albumin: { key: "albumin", value: 42, refLow: 35, refHigh: 50 },
  egfr: { key: "egfr", value: 90, refLow: 60, refHigh: 120 },
  creatinine: { key: "creatinine", value: 80, refLow: 45, refHigh: 110 },
  uacr: { key: "uacr", value: 10, refLow: 0, refHigh: 30 },
  hemoglobin: { key: "hemoglobin", value: 140, refLow: 120, refHigh: 160 },
  hematocrit: { key: "hematocrit", value: 42, unit: "%", refLow: 36, refHigh: 50 },
  wbc: { key: "wbc", value: 7, refLow: 4, refHigh: 10 },
  platelets: { key: "platelets", value: 250, refLow: 150, refHigh: 400 },
  mcv: { key: "mcv", value: 90, refLow: 80, refHigh: 100 },
  vitamin_d: { key: "vitamin_d", value: 75, refLow: 50, refHigh: 125 },
  b12: { key: "b12", value: 300, refLow: 150, refHigh: 600 },
  folate: { key: "folate", value: 20, refLow: 7, refHigh: 45 },
  crp: { key: "crp", value: 1.2, refLow: 0, refHigh: 5 },
  glucose: { key: "glucose", value: 5.0, refLow: 3.9, refHigh: 5.6 },
  total_cholesterol: { key: "total_cholesterol", value: 4.5, refLow: 3.0, refHigh: 5.2 },
};

function bindingFor(key: string) {
  const binding = getReviewedAssessmentBinding(key);
  if (!binding) {
    throw new Error(`EH-147 fixture key ${key} has no reviewed assessment binding`);
  }
  return binding;
}

function observationFromSpec(spec: MarkerSpec, observationId = `obs-${spec.key}`): ObservationInput {
  const binding = bindingFor(spec.key);
  return {
    observation_id: observationId,
    biomarker_key: spec.key,
    measurement_definition_key: binding.definition.key,
    resolution_status: "resolved",
    name: spec.key,
    value: spec.value,
    unit: spec.unit ?? binding.definition.unitPolicy.canonicalUnit ?? "unit",
    ref_low: spec.refLow,
    ref_high: spec.refHigh,
    observed_at: EH147_FRESHNESS_AS_OF,
    document_id: EH147_DOCUMENT_ID,
    observation_kind: "lab",
    value_kind: "numeric",
    value_text: String(spec.value),
    specimen: binding.definition.specimen ?? "unspecified",
    modifier: "none",
  };
}

function firstAlternatives(): MarkerSpec[] {
  const specs: MarkerSpec[] = [];
  for (const system of NAMED_BODY_SYSTEMS) {
    if (system === "inflammation") continue;
    for (const group of getRegistryV2ScoreReadinessGroups(system)) {
      const key = group[0]!;
      const spec = IN_RANGE[key];
      if (!spec) throw new Error(`missing in-range spec for ${key}`);
      specs.push(spec);
    }
  }
  specs.push(IN_RANGE.crp!);
  return specs;
}

function outOfRange(spec: MarkerSpec): MarkerSpec {
  const high = spec.refHigh ?? 1;
  return { ...spec, value: high * 3 };
}

function observations(specs: readonly MarkerSpec[]): ObservationInput[] {
  return specs.map((spec) => observationFromSpec(spec));
}

function profileExpected(
  profile: ReturnType<typeof buildHealthProfile>,
  markerKeys: readonly string[] = [],
): ProfileExpectation {
  const systems: Record<string, SystemExpectation> = {};
  for (const system of profile.systems) {
    if (
      !NAMED_BODY_SYSTEMS.includes(system.id as NamedBodySystemId) &&
      system.id !== "inflammation"
    ) {
      continue;
    }
    const satisfied_by: Record<string, string> = {};
    for (const group of system.score_readiness.required_groups) {
      if (group.satisfied_by) {
        satisfied_by[group.keys.join("|")] = group.satisfied_by;
      }
    }
    systems[system.id] = {
      scoreability: system.scoreability,
      state_score: system.state_score,
      readiness_codes: system.score_readiness.reasons.map((reason) => reason.code),
      ...(Object.keys(satisfied_by).length > 0 ? { satisfied_by } : {}),
    };
  }
  const markers: Record<string, { unit: string; status: string; converted?: boolean }> = {};
  for (const system of profile.systems) {
    for (const marker of system.markers) {
      if (!markerKeys.includes(marker.key)) continue;
      markers[marker.key] = {
        unit: marker.unit,
        status: marker.status,
        converted: marker.converted,
      };
    }
  }
  return {
    overall_state_score: profile.overall_state_score,
    systems,
    ...(Object.keys(markers).length > 0 ? { markers } : {}),
  };
}

function buildProfile(obs: readonly ObservationInput[]) {
  return buildHealthProfile([...obs], [SOURCE], {
    freshnessAsOf: EH147_FRESHNESS_AS_OF,
    freshnessEvaluatedAt: EH147_FRESHNESS_EVALUATED_AT,
  });
}

function replaceKey(specs: readonly MarkerSpec[], from: string, to: string): MarkerSpec[] {
  return specs.map((spec) => (spec.key === from ? IN_RANGE[to]! : spec));
}

function dropKey(specs: readonly MarkerSpec[], key: string): MarkerSpec[] {
  return specs.filter((spec) => spec.key !== key);
}

function labObservation(options: {
  measurementDefinitionKey: string;
  name: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  rawReferenceText: string;
  specimen: string;
}) {
  return {
    observation_kind: "lab" as const,
    measurement_definition_key: options.measurementDefinitionKey,
    resolution_status: "resolved" as const,
    name: options.name,
    value: options.value,
    unit: options.unit,
    ref_low: options.refLow,
    ref_high: options.refHigh,
    raw_reference_text: options.rawReferenceText,
    observed_at: EH147_FRESHNESS_AS_OF,
    document_id: EH147_DOCUMENT_ID,
    value_kind: "numeric" as const,
    value_text: String(options.value),
    ordinal: null,
    specimen: options.specimen,
    modifier: "none",
  };
}

function revision(options: {
  measurementDefinitionKey: string;
  verificationStatus: string;
}) {
  return {
    is_active: true,
    resolver_result: "resolved" as const,
    verification_status: options.verificationStatus,
    measurement_definition_key: options.measurementDefinitionKey,
    resolver_evidence: {
      version: 2,
      selectedCandidateKey: options.measurementDefinitionKey,
      outcome: "resolved" as const,
    },
  };
}

function glucoseAdmission(verificationStatus: string, refLow = 70, refHigh = 99, raw = "70-99") {
  const observation = labObservation({
    measurementDefinitionKey: "glucose_serum",
    name: "Glucose",
    value: 90,
    unit: "mg/dL",
    refLow,
    refHigh,
    rawReferenceText: raw,
    specimen: "serum",
  });
  const relation = revision({
    measurementDefinitionKey: "glucose_serum",
    verificationStatus,
  });
  return { observation, relation };
}

const completeInRange = firstAlternatives();
const completeOutOfRange = completeInRange.map((spec) =>
  spec.key === "crp" ? spec : outOfRange(spec),
);

function fastingGlucoseNative(labUnitSystem: LabUnitSystem): ObservationInput[] {
  const native = labObservation({
    measurementDefinitionKey: "fasting_glucose",
    name: "Fasting glucose",
    value: 90,
    unit: "mg/dL",
    refLow: 70,
    refHigh: 99,
    rawReferenceText: "70-99 mg/dL",
    specimen: "plasma",
  });
  const relation = revision({
    measurementDefinitionKey: "fasting_glucose",
    verificationStatus: "user_verified",
  });
  const projected = projectHealthProfileLaboratoryInput({
    observation: native,
    relation,
    labUnitSystem,
  });
  if (!projected) {
    throw new Error(`fasting glucose should project under ${labUnitSystem}`);
  }
  return [projected];
}

function missingGroupCases(): GoldenCase[] {
  return NAMED_BODY_SYSTEMS.filter((system) => system !== "inflammation").map((system) => {
    const dropped = getRegistryV2ScoreReadinessGroups(system)[0]![0]!;
    const specs = dropKey(completeInRange, dropped);
    return {
      id: `missing-group-${system}`,
      family: "missing-group" as const,
      description: `${system} omits required group alternative ${dropped}`,
      kind: "profile" as const,
      observations: observations(specs),
    };
  });
}

function admissionCase(
  id: string,
  family: GoldenFamily,
  description: string,
  admission: ReturnType<typeof glucoseAdmission>,
): GoldenCase {
  return {
    id,
    family,
    description,
    kind: "admission",
    admission,
  };
}

export function listGoldenCases(): GoldenCase[] {
  const siUnits = fastingGlucoseNative("si");
  const usUnits = fastingGlucoseNative("us");
  const invalidRefs = completeInRange.map((spec) =>
    spec.key === "alt" ? { ...spec, refLow: null, refHigh: null } : spec,
  );
  const glucoseOnly = [IN_RANGE.glucose!];
  const cholesterolSwap = replaceKey(completeInRange, "ldl", "total_cholesterol");
  const hba1cAlt = replaceKey(completeInRange, "fasting_glucose", "hba1c");
  const hematocritAlt = replaceKey(completeInRange, "hemoglobin", "hematocrit");
  const creatinineAlt = replaceKey(completeInRange, "egfr", "creatinine");
  const inflammationOnly = [IN_RANGE.crp!];

  return [
    {
      id: "complete-in-range-eight-systems",
      family: "complete-in-range",
      description: "Every scoreable required group is a usable in-range core marker; CRP is display-only",
      kind: "profile",
      observations: observations(completeInRange),
    },
    {
      id: "complete-out-of-range-eight-systems",
      family: "complete-out-of-range",
      description: "Same required groups with values outside document-native bounds",
      kind: "profile",
      observations: observations(completeOutOfRange),
    },
    {
      id: "si-us-fasting-glucose-si",
      family: "si-us-units",
      description: "Native mg/dL fasting glucose presented in SI",
      kind: "profile",
      labUnitSystem: "si",
      observations: siUnits,
    },
    {
      id: "si-us-fasting-glucose-us",
      family: "si-us-units",
      description: "Native mg/dL fasting glucose presented in US units",
      kind: "profile",
      labUnitSystem: "us",
      observations: usUnits,
    },
    ...missingGroupCases(),
    {
      id: "invalid-reference-liver-alt",
      family: "invalid-reference",
      description: "Liver ALT is present without a usable document-native range",
      kind: "profile",
      observations: observations(invalidRefs),
    },
    {
      id: "context-only-metabolic-glucose",
      family: "context-only",
      description: "Unqualified glucose cannot satisfy glycemia readiness",
      kind: "profile",
      observations: observations(glucoseOnly),
    },
    {
      id: "context-only-cardiovascular-total-cholesterol",
      family: "context-only",
      description: "Total cholesterol cannot replace the atherogenic cholesterol group",
      kind: "profile",
      observations: observations(cholesterolSwap),
    },
    {
      id: "alternatives-metabolic-hba1c",
      family: "alternatives",
      description: "HbA1c satisfies the glycemia group",
      kind: "profile",
      observations: observations(hba1cAlt),
    },
    {
      id: "alternatives-blood-hematocrit",
      family: "alternatives",
      description: "Hematocrit satisfies the red-cell mass group",
      kind: "profile",
      observations: observations(hematocritAlt),
    },
    {
      id: "alternatives-kidney-creatinine",
      family: "alternatives",
      description: "Creatinine satisfies the filtration group",
      kind: "profile",
      observations: observations(creatinineAlt),
    },
    {
      id: "inflammation-crp-factual-only",
      family: "inflammation",
      description: "CRP never unlocks an inflammation score",
      kind: "profile",
      observations: observations(inflammationOnly),
    },
    admissionCase(
      "correction-pending-excluded",
      "correction",
      "Pending verification cannot enter assessment",
      glucoseAdmission("pending"),
    ),
    admissionCase(
      "correction-manually-corrected-admitted",
      "correction",
      "manually_corrected verification is eligible",
      glucoseAdmission("manually_corrected"),
    ),
    admissionCase(
      "invalid-inverted-document-range",
      "invalid-reference",
      "Inverted document-native bounds are excluded at admission",
      glucoseAdmission("user_verified", 99, 70, "99-70"),
    ),
    admissionCase(
      "invalid-missing-document-range",
      "invalid-reference",
      "Blank document-native range text is excluded at admission",
      glucoseAdmission("user_verified", 70, 99, ""),
    ),
  ];
}

export function evaluateGoldenCase(goldenCase: GoldenCase): ProfileExpectation | AdmissionExpectation {
  if (goldenCase.kind === "admission") {
    if (!goldenCase.admission) {
      throw new Error(`${goldenCase.id} is missing admission inputs`);
    }
    const outcome = projectLaboratoryOutcome({
      observation: goldenCase.admission.observation,
      relation: goldenCase.admission.relation,
    });
    return {
      eligible: outcome.resolutionDetails.eligibility.assessmentEligible,
      exclusionReason: outcome.resolutionDetails.eligibility.exclusions.assessment,
    };
  }
  if (!goldenCase.observations) {
    throw new Error(`${goldenCase.id} is missing profile observations`);
  }
  const markerKeys = goldenCase.family === "si-us-units" ? ["fasting_glucose"] : [];
  return profileExpected(buildProfile(goldenCase.observations), markerKeys);
}

export function canonicalPackPayload(
  cases: readonly GoldenCase[],
  expectedById: Readonly<Record<string, ProfileExpectation | AdmissionExpectation>>,
) {
  return {
    packVersion: EH147_PACK_VERSION,
    algorithmVersion: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
    cases: [...cases]
      .map((goldenCase) => ({
        id: goldenCase.id,
        family: goldenCase.family,
        kind: goldenCase.kind,
        expected: expectedById[goldenCase.id],
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function packHash(
  cases: readonly GoldenCase[],
  expectedById: Readonly<Record<string, ProfileExpectation | AdmissionExpectation>>,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalPackPayload(cases, expectedById)))
    .digest("hex");
}
