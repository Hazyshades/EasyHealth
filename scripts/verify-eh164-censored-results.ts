import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COMPARATOR_MODIFIER_TOKENS,
  coerceClinicalModifier,
  inferModifier,
  isCensoredLabValueCell,
  parseLabValueCell,
} from "../src/lib/biomarkers";
import { parsePipelineExtraction } from "../src/lib/documents/extraction";
import { baseMeasurementFromExtractedRow } from "../src/lib/documents/observation-measurement-correction";
import { buildMeasurementComparisonSeries } from "../src/lib/biomarker-comparison";
import { evaluateAssessmentEligibility } from "../src/lib/health-profile-assessment-eligibility";
import { projectHealthProfileLaboratoryInput } from "../src/lib/health-profile-input";
import { parseLabNumber } from "../src/lib/schemas/biomarkers";
import { buildHealthProfile } from "../src/lib/health-systems";

const lessThan = parseLabValueCell("< 0.20");
assert.equal(lessThan?.value_kind, "text");
assert.equal(lessThan?.value, null);
assert.equal(lessThan?.value_text, "< 0.20");
assert.equal(isCensoredLabValueCell("< 0.20"), true);

const greaterThan = parseLabValueCell("> 10");
assert.equal(greaterThan?.value_kind, "text");
assert.equal(greaterThan?.value, null);
assert.equal(greaterThan?.value_text, "> 10");

const lte = parseLabValueCell("≤0.05");
assert.equal(lte?.value_kind, "text");
assert.equal(lte?.value, null);

const gte = parseLabValueCell(">= 10");
assert.equal(gte?.value_kind, "text");
assert.equal(gte?.value, null);

const dipstick = parseLabValueCell("2+");
assert.equal(dipstick?.value_kind, "ordinal");
assert.equal(dipstick?.value_text, "2+");
assert.equal(dipstick?.ordinal, 3);
assert.equal(isCensoredLabValueCell("2+"), false);

const numeric = parseLabValueCell("0.20");
assert.equal(numeric?.value_kind, "numeric");
assert.equal(numeric?.value, 0.2);

assert.equal(coerceClinicalModifier("<"), "none");
assert.equal(coerceClinicalModifier("less than"), "none");
assert.equal(coerceClinicalModifier("greater than"), "none");
assert.equal(inferModifier("crp", "CRP", "<"), "none");
assert.equal(inferModifier("glucose", "Glucose", "fasting"), "fasting");

const auditSql = readFileSync(new URL("./audit-eh164-censored-results.sql", import.meta.url), "utf8");
for (const comparatorToken of Object.keys(COMPARATOR_MODIFIER_TOKENS)) {
  assert.equal(
    auditSql.includes(`'${comparatorToken}'`),
    true,
    `audit SQL must include comparator modifier ${comparatorToken}`,
  );
}
const extracted = parsePipelineExtraction({
  biomarkers: [
    {
      raw_name: "CRP",
      value: "< 0.20",
      unit: "mg/L",
      modifier: "<",
      source_text: "CRP < 0.20 mg/L",
    },
  ],
});
assert.equal(extracted.biomarkers.length, 1);
assert.equal(extracted.biomarkers[0]?.value_kind, "text");
assert.equal(extracted.biomarkers[0]?.value, null);
assert.equal(extracted.biomarkers[0]?.value_text, "< 0.20");
assert.equal(extracted.biomarkers[0]?.modifier, "none");

assert.equal(parseLabNumber("< 0.20"), 0.2, "reference-bound parsing may still read a numeric bound");

const correctionBase = baseMeasurementFromExtractedRow(
  {
    value_numeric: 0.2,
    value_text: "< 0.20",
    value_kind: "numeric",
    ordinal: null,
    unit: "mg/L",
    reference_range: "< 5.0",
    raw_reference_range: "< 5.0",
    raw_value_text: "< 0.20",
  },
  "2026-08-01",
);
assert.equal(correctionBase.value, null);
assert.equal(correctionBase.valueKind, "text");
assert.equal(correctionBase.valueText, "< 0.20");

const series = buildMeasurementComparisonSeries([
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "CRP",
    measurement_definition_key: "crp_serum",
    trend_eligible: true,
    value: 0.2,
    unit: "mg/L",
    ref_low: 0,
    ref_high: 5,
    observed_at: "2026-08-01",
    document_id: "00000000-0000-4000-8000-000000000002",
    value_kind: "numeric",
    value_text: "< 0.20",
  },
]);
assert.equal(series.length, 0, "comparator-bearing rows are not plotted");

const eligibility = evaluateAssessmentEligibility({
  hasActiveRevision: true,
  outcome: "resolved",
  registryBindingReady: true,
  hasReviewedAssessmentBinding: true,
  verificationStatus: "user_verified",
  valueKind: "numeric",
  value: 0.2,
  valueText: "< 0.20",
  rawReferenceText: "< 5.0",
  refLow: 0,
  refHigh: 5,
});
assert.equal(eligibility.eligible, false);
assert.equal(eligibility.exclusionReason, "non_numeric_value");

const censoredObservation = {
  name: "Fasting glucose",
  value: 0.2,
  unit: "mg/dL",
  ref_low: 70,
  ref_high: 99,
  raw_reference_text: "70–99",
  observed_at: "2026-08-01",
  document_id: "00000000-0000-4000-8000-000000000002",
  value_kind: "numeric",
  value_text: "< 0.20",
  ordinal: null,
  specimen: "serum",
  modifier: "fasting",
  observation_kind: "lab" as const,
  measurement_definition_key: "fasting_glucose",
  resolution_status: "resolved",
};
const censoredRelation = {
  resolver_result: "resolved",
  verification_status: "user_verified",
  measurement_definition_key: "fasting_glucose",
  is_active: true,
  resolver_evidence: {
    version: 2,
    selectedCandidateKey: "fasting_glucose",
    outcome: "resolved",
  },
};
const censoredInput = projectHealthProfileLaboratoryInput({
  observation: censoredObservation,
  relation: censoredRelation,
  labUnitSystem: "si",
});
assert.equal(censoredInput?.biomarker_key, "fasting_glucose");
assert.equal(censoredInput?.value, null);
assert.equal(censoredInput?.value_kind, "text");
assert.equal(censoredInput?.value_text, "< 0.20");

const unverifiedCensoredInput = projectHealthProfileLaboratoryInput({
  observation: censoredObservation,
  relation: { ...censoredRelation, verification_status: "pending" },
  labUnitSystem: "si",
});
assert.equal(unverifiedCensoredInput, null);

const censoredProfile = buildHealthProfile(
  censoredInput ? [censoredInput] : [],
  [{
    id: "00000000-0000-4000-8000-000000000002",
    original_filename: "censored-fasting-glucose.pdf",
    observed_at: "2026-08-01",
    lab_name: "Fixture laboratory",
    document_type: "lab_result",
  }],
  {
    freshnessAsOf: "2026-08-01",
    freshnessEvaluatedAt: "2026-08-01T00:00:00.000Z",
  },
);
const metabolic = censoredProfile.systems.find((system) => system.id === "metabolic");
const glucoseReadiness = metabolic?.score_readiness.reasons.find((reason) =>
  reason.present_keys.includes("fasting_glucose"),
);
assert.equal(glucoseReadiness?.code, "invalid");
assert.equal(metabolic?.state_score, null);

console.log("verify-eh164-censored-results: all checks passed");
