import assert from "node:assert/strict";
import {
  applyMeasurementOverride,
  codeFor,
  isMeasurementOverride,
  parseMeasurementOverride,
  validateMeasurementCorrection,
  type BaseMeasurement,
} from "../src/lib/documents/observation-measurement-correction";

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

assert.deepEqual(
  applyMeasurementOverride(base, { ref_high: 45 }),
  { ...base, refHigh: 45 },
  "an absent field stays at its raw extracted value",
);
assert.deepEqual(
  applyMeasurementOverride(base, { ref_low: null }),
  { ...base, refLow: null },
  "explicit null clears a correctable field without changing raw evidence",
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
const invalidDate = parseMeasurementOverride({ observed_at: "2026-02-30" });
assert.equal(invalidDate.ok, false);
if (!invalidDate.ok) assert.equal(invalidDate.code, "observed_at_invalid");
assert.equal(isMeasurementOverride({ value: 32 }), true);
assert.equal(isMeasurementOverride({ value_kind: "numeric" }), false);
assert.equal(isMeasurementOverride({ ref_low: 50, ref_high: 40 }), false);

const numericWithoutValue = validateMeasurementCorrection({
  base,
  override: { value: null, value_kind: "numeric" },
  correctionReason: "The result was not printed.",
});
assert.equal(numericWithoutValue.ok, false);
if (!numericWithoutValue.ok) assert.equal(numericWithoutValue.code, "value_kind_requires_value");

const textWithoutValue = validateMeasurementCorrection({
  base,
  override: { value_kind: "text", value_text: "   " },
  correctionReason: "The result was textual.",
});
assert.equal(textWithoutValue.ok, false);
if (!textWithoutValue.ok) assert.equal(textWithoutValue.code, "value_kind_requires_text");

const numericKindWithoutValueField = validateMeasurementCorrection({
  base,
  override: { value_kind: "numeric" },
  correctionReason: "The result was restated as numeric.",
});
assert.equal(numericKindWithoutValueField.ok, false);
if (!numericKindWithoutValueField.ok) {
  assert.equal(numericKindWithoutValueField.code, "value_kind_requires_value");
}

const textKindWithoutTextField = validateMeasurementCorrection({
  base,
  override: { value_kind: "text" },
  correctionReason: "The result was restated as printed text.",
});
assert.equal(textKindWithoutTextField.ok, false);
if (!textKindWithoutTextField.ok) {
  assert.equal(textKindWithoutTextField.code, "value_kind_requires_text");
}

const textKindRetainsNumericValue = validateMeasurementCorrection({
  base,
  override: { value_kind: "text", value_text: "< 0.20" },
  correctionReason: "The comparator must remain text.",
});
assert.equal(textKindRetainsNumericValue.ok, false);
if (!textKindRetainsNumericValue.ok) {
  assert.equal(textKindRetainsNumericValue.code, "value_kind_requires_text");
  assert.equal(textKindRetainsNumericValue.field, "value");
}

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
  override: { value_text: "< 0.20", value_kind: "text", value: null },
  correctionReason: "Keeping the comparator exactly as printed.",
});
assert.equal(censoredNumeric.ok, true);
if (censoredNumeric.ok) {
  assert.equal(censoredNumeric.measurement.value, null);
  assert.equal(censoredNumeric.measurement.valueKind, "text");
  assert.equal(censoredNumeric.measurement.valueText, "< 0.20");
}

const censoredAsNumeric = validateMeasurementCorrection({
  base,
  override: { value_text: "< 0.20" },
  correctionReason: "Keeping the comparator exactly as printed.",
});
assert.equal(censoredAsNumeric.ok, false);
if (!censoredAsNumeric.ok) assert.equal(censoredAsNumeric.code, "censored_value_requires_text");

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

assert.equal(codeFor("stale_revision_conflict"), 409);
assert.equal(codeFor("unit_dimension_conflict"), 400);
assert.equal(codeFor("correction_requires_reviewed_concrete_definition"), 422);
assert.equal(codeFor("invalid_normalization_resolution_payload"), 422);
assert.equal(codeFor("not_a_correction_code"), null);

console.log("EH-119 measurement override checks passed");
