import assert from "node:assert/strict";
import {
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

assert.equal(
  projectHealthProfileLaboratoryInput({
    observation: {
      name: "CRP",
      value: 0.2,
      unit: "mg/L",
      ref_low: 0,
      ref_high: 5,
      raw_reference_text: "< 5.0",
      observed_at: "2026-08-01",
      document_id: "00000000-0000-4000-8000-000000000002",
      value_kind: "numeric",
      value_text: "< 0.20",
      ordinal: null,
      specimen: "serum",
      modifier: "none",
      observation_kind: "lab",
      measurement_definition_key: "crp_serum",
      resolution_status: "resolved",
    },
    relation: null,
    labUnitSystem: "si",
  }),
  null,
);

console.log("verify-eh164-censored-results: all checks passed");
