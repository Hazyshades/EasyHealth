import assert from "node:assert/strict";
import {
  applyMeasurementOverride,
  codeFor,
  isMeasurementOverride,
  parseMeasurementOverride,
  validateMeasurementCorrection,
  type BaseMeasurement,
} from "../src/lib/documents/observation-measurement-correction";
import {
  buildExtractedReviewRow,
  type ExtractedReviewRowInput,
} from "../src/lib/documents/observation-review-workspace";
import type { LaboratoryResolutionDetails } from "../src/lib/documents/incomplete-laboratory-outcomes";

const base: BaseMeasurement = {
  value: 31,
  valueText: null,
  valueKind: "numeric",
  ordinal: null,
  unit: "U/L",
  refLow: 0,
  refHigh: 41,
  observedAt: "2026-08-01",
};

const valid = validateMeasurementCorrection({
  base,
  override: {
    value: 32,
    ref_high: 42,
    observed_at: "2026-08-02",
  },
  correctionReason: "The printed result is 32, not 31.",
  now: new Date("2026-08-09T12:00:00Z"),
});
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.deepEqual(valid.measurement, {
    ...base,
    value: 32,
    refHigh: 42,
    observedAt: "2026-08-02",
  });
  assert.equal(valid.losesDefinitionBinding, false);
}

// Overrides compose against raw extraction, not against a previous correction.
assert.deepEqual(
  applyMeasurementOverride(base, { ref_high: 45 }),
  { ...base, refHigh: 45 },
);

const noReason = validateMeasurementCorrection({
  base,
  override: { value: 32 },
  correctionReason: "   ",
});
assert.equal(noReason.ok, false);
if (!noReason.ok) assert.equal(noReason.code, "correction_reason_required");

const unknownField = parseMeasurementOverride({ specimen: "serum" });
assert.equal(unknownField.ok, false);
if (!unknownField.ok) assert.equal(unknownField.code, "override_unknown_field");
assert.equal(codeFor("stale_revision_conflict"), 409);
assert.equal(codeFor("unit_dimension_conflict"), 400);
assert.equal(codeFor("not_a_correction_code"), null);
assert.equal(isMeasurementOverride({ value: 32 }), true);
assert.equal(isMeasurementOverride({ value_kind: "numeric" }), false);
assert.equal(isMeasurementOverride({ ref_low: 50, ref_high: 40 }), false);

const invertedRange = validateMeasurementCorrection({
  base,
  override: { ref_low: 50, ref_high: 40 },
  correctionReason: "The report has a reversed range.",
});
assert.equal(invertedRange.ok, false);
if (!invertedRange.ok) assert.equal(invertedRange.code, "reference_range_inverted");

const futureDate = validateMeasurementCorrection({
  base,
  override: { observed_at: "2026-08-10" },
  correctionReason: "Correcting the report date.",
  now: new Date("2026-08-09T12:00:00Z"),
});
assert.equal(futureDate.ok, false);
if (!futureDate.ok) assert.equal(futureDate.code, "observed_at_in_future");

const censoredNumeric = validateMeasurementCorrection({
  base,
  override: { value_text: "< 0.20" },
  correctionReason: "Keeping the comparator exactly as printed.",
});
assert.equal(censoredNumeric.ok, false);
if (!censoredNumeric.ok) assert.equal(censoredNumeric.code, "censored_value_requires_text");

const incompatibleUnit = validateMeasurementCorrection({
  base,
  override: { unit: "mg/dL" },
  correctionReason: "The report uses a different unit.",
  boundDefinitionKey: "alt_serum_catalytic_activity",
});
assert.equal(incompatibleUnit.ok, false);
if (!incompatibleUnit.ok) assert.equal(incompatibleUnit.code, "unit_dimension_conflict");

const acknowledgedUnitLoss = validateMeasurementCorrection({
  base,
  override: { unit: "mg/dL" },
  correctionReason: "The report uses a different unit.",
  boundDefinitionKey: "alt_serum_catalytic_activity",
  acknowledgeDefinitionLoss: true,
});
assert.equal(acknowledgedUnitLoss.ok, true);
if (acknowledgedUnitLoss.ok) assert.equal(acknowledgedUnitLoss.losesDefinitionBinding, true);

function resolutionDetails(): LaboratoryResolutionDetails {
  return {
    source: "active_revision",
    outcome: "resolved",
    verificationStatus: "auto_verified",
    mappingConfidence: 0.9,
    mappingConfidenceBand: "high",
    missingAxes: [],
    minimalMissingAxes: [],
    conflictCodes: [],
    supportCodes: [],
    candidateCount: 1,
    incompleteReason: null,
    versions: {
      catalog: "2026-08-01.0",
      resolver: "5",
      normalization: "4",
      trace: 1,
      compatibilityPolicy: "1",
    },
    eligibility: {
      trendEligible: true,
      conversionEligible: true,
      reportEligible: true,
      structuredContextEligible: true,
      assessmentEligible: true,
      exclusions: {
        trend: null,
        conversion: null,
        report: null,
        structuredContext: null,
        assessment: null,
      },
    },
  };
}

const reviewRow = buildExtractedReviewRow({
  id: "extracted-eh119",
  biomarker_name: "Alanine aminotransferase",
  raw_name: "ALT",
  value_numeric: 31,
  value_text: null,
  value_kind: "numeric",
  unit: "U/L",
  raw_unit: "U/L",
  raw_value_text: "31 U/L",
  reference_range: "0-41",
  raw_reference_range: "0-41",
  specimen: "serum",
  modifier: "none",
  method: null,
  confidence: 0.9,
  source_page: 1,
  source_text: "ALT 32 U/L",
  status: "needs_review",
  normalization: {
    result: "resolved",
    mappingConfidenceBand: "high",
    registryBindingReady: true,
    resolutionDetails: resolutionDetails(),
    activeRevision: {
      verification_status: "user_verified",
      measurement_override: {
        value: 32,
        unit: "U/L",
        ref_low: 0,
        ref_high: 42,
        observed_at: "2026-08-02",
      },
    },
  },
} satisfies ExtractedReviewRowInput);
assert.equal(reviewRow.userCorrected, true);
assert.equal(reviewRow.rawEvidence.value, "31 U/L");
assert.deepEqual(reviewRow.rawEvidence.correctedMeasurement, {
  value: "32 U/L",
  unit: "U/L",
  referenceText: "0 - 42",
  observedAt: "2026-08-02",
});
assert.equal(
  JSON.stringify(reviewRow).includes('"value":32'),
  false,
  "the review projection must not replace raw evidence with the correction",
);

console.log("EH-119 observation correction checks passed");
