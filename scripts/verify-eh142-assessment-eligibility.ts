import assert from "node:assert/strict";
import {
  ASSESSMENT_EXCLUSION_LABELS,
  evaluateAssessmentEligibility,
} from "../src/lib/health-profile-assessment-eligibility";
import { MEASUREMENT_DEFINITIONS } from "../src/lib/biomarkers";
import { projectLaboratoryOutcome } from "../src/lib/documents/incomplete-laboratory-outcomes";
import { projectHealthProfileLaboratoryInput } from "../src/lib/health-profile-input";

function observation(overrides: Record<string, unknown> = {}) {
  return {
    observation_kind: "lab" as const,
    measurement_definition_key: "glucose_serum",
    resolution_status: "resolved",
    name: "Glucose",
    value: 90,
    unit: "mg/dL",
    ref_low: 70,
    ref_high: 99,
    raw_reference_text: "70–99",
    observed_at: "2026-08-01",
    document_id: "eh142-document",
    value_kind: "numeric",
    value_text: "90",
    ordinal: null,
    specimen: "serum",
    modifier: "none",
    ...overrides,
  };
}

function activeRevision(overrides: Record<string, unknown> = {}) {
  return {
    is_active: true,
    resolver_result: "resolved",
    verification_status: "user_verified",
    measurement_definition_key: "glucose_serum",
    resolver_evidence: {
      version: 2,
      selectedCandidateKey: "glucose_serum",
      outcome: "resolved",
    },
    ...overrides,
  };
}

function outcome(
  observationOverrides: Record<string, unknown> = {},
  revisionOverrides: Record<string, unknown> = {},
) {
  return projectLaboratoryOutcome({
    observation: observation(observationOverrides),
    relation: activeRevision(revisionOverrides),
  });
}

for (const verificationStatus of [
  "auto_verified",
  "user_verified",
  "manually_corrected",
]) {
  const projected = outcome({}, { verification_status: verificationStatus });
  assert.equal(
    projected.resolutionDetails.eligibility.assessmentEligible,
    true,
    `${verificationStatus} observations are eligible when all other gates pass`,
  );
  assert.equal(projected.resolutionDetails.eligibility.exclusions.assessment, null);
}

const pending = outcome({}, { verification_status: "pending" });
assert.equal(pending.resolutionDetails.eligibility.assessmentEligible, false);
assert.equal(
  pending.resolutionDetails.eligibility.exclusions.assessment,
  "verification_required",
);
assert.equal(
  projectHealthProfileLaboratoryInput({
    observation: observation(),
    relation: activeRevision({ verification_status: "pending" }),
    labUnitSystem: "si",
  }),
  null,
  "unverified observations cannot enter Health Profile assessment input",
);

for (const resolutionStatus of ["partial", "ambiguous", "unmapped"] as const) {
  const projected = outcome(
    {
      measurement_definition_key: resolutionStatus === "unmapped" ? null : "glucose_serum",
      resolution_status: resolutionStatus,
    },
    {
      resolver_result: resolutionStatus,
      verification_status: "pending",
      measurement_definition_key: resolutionStatus === "unmapped" ? null : "glucose_serum",
      resolver_evidence: {
        version: 2,
        selectedCandidateKey: resolutionStatus === "unmapped" ? null : "glucose_serum",
        outcome: resolutionStatus,
      },
    },
  );
  assert.equal(projected.resolutionDetails.eligibility.assessmentEligible, false);
  assert.equal(
    projected.resolutionDetails.eligibility.exclusions.assessment,
    "incomplete_resolution",
    `${resolutionStatus} observations are excluded before score evidence is evaluated`,
  );
}

const provisional = MEASUREMENT_DEFINITIONS.find(
  (definition) => definition.maturity === "provisional",
)!;
const provisionalOutcome = outcome(
  { measurement_definition_key: provisional.key, specimen: provisional.specimen },
  {
    measurement_definition_key: provisional.key,
    resolver_evidence: {
      version: 2,
      selectedCandidateKey: provisional.key,
      outcome: "resolved",
    },
  },
);
assert.equal(
  provisionalOutcome.resolutionDetails.eligibility.exclusions.assessment,
  "candidate_only_identity",
);

const withoutBinding = MEASUREMENT_DEFINITIONS.find(
  (definition) => definition.maturity === "reviewed" && definition.assessmentBindings.length === 0,
)!;
const bindingOutcome = outcome(
  { measurement_definition_key: withoutBinding.key, specimen: withoutBinding.specimen },
  {
    measurement_definition_key: withoutBinding.key,
    resolver_evidence: {
      version: 2,
      selectedCandidateKey: withoutBinding.key,
      outcome: "resolved",
    },
  },
);
assert.equal(
  bindingOutcome.resolutionDetails.eligibility.exclusions.assessment,
  "assessment_binding_ineligible",
);

const qualitative = outcome({ value_kind: "qualitative", value: null, value_text: "positive" });
assert.equal(
  qualitative.resolutionDetails.eligibility.exclusions.assessment,
  "non_numeric_value",
);

const missingValue = outcome({ value: null });
assert.equal(
  missingValue.resolutionDetails.eligibility.exclusions.assessment,
  "numeric_value_missing",
);

const invalidValue = outcome({ value: Number.NaN });
assert.equal(
  invalidValue.resolutionDetails.eligibility.exclusions.assessment,
  "numeric_value_invalid",
);

const missingRange = outcome({ raw_reference_text: "", ref_low: null, ref_high: null });
assert.equal(
  missingRange.resolutionDetails.eligibility.exclusions.assessment,
  "missing_document_reference_range",
);

const invalidRange = outcome({ ref_low: 100, ref_high: 90 });
assert.equal(
  invalidRange.resolutionDetails.eligibility.exclusions.assessment,
  "invalid_document_reference_range",
);

const oneSidedRange = outcome({ raw_reference_text: "≤ 99", ref_low: null, ref_high: 99 });
assert.equal(oneSidedRange.resolutionDetails.eligibility.assessmentEligible, true);

const directEligibility = evaluateAssessmentEligibility({
  hasActiveRevision: true,
  outcome: "resolved",
  registryBindingReady: true,
  hasReviewedAssessmentBinding: true,
  verificationStatus: "user_verified",
  valueKind: "numeric",
  value: 90,
  rawReferenceText: "70–99",
  refLow: 70,
  refHigh: 99,
});
assert.deepEqual(directEligibility, { eligible: true, exclusionReason: null });

for (const label of Object.values(ASSESSMENT_EXCLUSION_LABELS)) {
  assert.equal(label.length > 0, true, "every exclusion code has user-facing guidance");
  assert.equal(
    label.toLowerCase().includes("invalid"),
    false,
    "assessment guidance does not call the source laboratory result invalid",
  );
}

console.log("verify-eh142-assessment-eligibility: all checks passed");
