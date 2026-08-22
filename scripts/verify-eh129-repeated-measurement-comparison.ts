import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildMeasurementComparisonSeries,
  filterMeasurementComparisonSeries,
  type ComparisonObservation,
} from "../src/lib/biomarker-comparison";

const UUID = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

function observation(
  id: string,
  definitionKey: string,
  overrides: Partial<ComparisonObservation> = {},
): ComparisonObservation {
  return {
    id,
    name: "Glucose",
    measurement_definition_key: definitionKey,
    trend_eligible: true,
    conversion_eligible: true,
    value: 5.5,
    unit: "mmol/L",
    ref_low: 3.5,
    ref_high: 6.1,
    observed_at: "2026-01-10",
    document_id: UUID(id),
    documents: {
      id: UUID(id),
      original_filename: `${id}.pdf`,
      lab_name: "Synthetic Lab",
    },
    value_kind: "numeric",
    original_value: 99,
    original_unit: "mg/dL",
    original_ref_low: 70,
    original_ref_high: 110,
    converted: true,
    ...overrides,
  };
}

const normalized = buildMeasurementComparisonSeries([
  observation("1", "glucose", {
    observed_at: "2026-01-20",
    value: 5.5,
    original_value: 99,
    original_ref_low: 70,
    original_ref_high: 110,
  }),
  observation("2", "glucose", {
    observed_at: "2026-01-10",
    value: 5.8,
    original_value: 104,
    original_unit: "mmol/L",
    original_ref_low: 3.9,
    original_ref_high: 6.2,
    converted: false,
  }),
]);

assert.equal(normalized.length, 1, "reviewed unit variants with one displayed unit share a series");
assert.equal(normalized[0]?.normalized, true);
assert.deepEqual(
  normalized[0]?.points.map((point) => point.id),
  ["2", "1"],
  "points sort by observation date and then stable id",
);
assert.deepEqual(
  normalized[0]?.points.map((point) => [point.nativeValue, point.nativeReferenceLow, point.nativeReferenceHigh]),
  [
    [104, 3.9, 6.2],
    [99, 70, 110],
  ],
  "each point retains its document-native value and range",
);
assert.equal(normalized[0]?.points[0]?.source?.href, "/app/documents/00000000-0000-4000-8000-000000000002");
assert.equal(normalized[0]?.points[0]?.source?.laboratory, "Synthetic Lab");

const differentDefinitions = buildMeasurementComparisonSeries([
  observation("3", "rdw_cv", { name: "RDW", converted: false, conversion_eligible: false, unit: "%" }),
  observation("4", "rdw_sd", { name: "RDW", converted: false, conversion_eligible: false, unit: "fL" }),
]);
assert.equal(differentDefinitions.length, 2, "different definition keys never share a series");
assert.deepEqual(
  differentDefinitions.map((series) => series.measurementDefinitionKey).sort(),
  ["rdw_cv", "rdw_sd"],
);

const unsafeUnits = buildMeasurementComparisonSeries([
  observation("5", "free_t4", {
    name: "Free T4",
    value: 1.2,
    unit: "ng/dL",
    original_value: 1.2,
    original_unit: "ng/dL",
    converted: false,
    conversion_eligible: false,
  }),
  observation("6", "free_t4", {
    name: "Free T4",
    value: 15,
    unit: "pmol/L",
    original_value: 15,
    original_unit: "pmol/L",
    converted: false,
    conversion_eligible: false,
  }),
]);
assert.equal(unsafeUnits.length, 2, "unit variants without a reviewed conversion stay separate");
assert.equal(unsafeUnits.every((series) => series.normalized === false), true);
const sameDisplayedUnsafe = buildMeasurementComparisonSeries([
  observation("11", "glucose", {
    unit: "mmol/L",
    original_unit: "mg/dL",
    converted: false,
    conversion_eligible: false,
  }),
  observation("12", "glucose", {
    unit: "mmol/L",
    original_unit: "mmol/L",
    converted: false,
    conversion_eligible: false,
  }),
]);
assert.equal(
  sameDisplayedUnsafe.length,
  2,
  "same displayed units do not hide different native units when conversion is unavailable",
);
const unknownNativeUnit = buildMeasurementComparisonSeries([
  observation("13", "glucose", {
    unit: "mmol/L",
    original_unit: null,
    converted: false,
    conversion_eligible: false,
  }),
  observation("14", "glucose", {
    unit: "mmol/L",
    original_unit: "mmol/L",
    converted: false,
    conversion_eligible: false,
  }),
]);
assert.equal(
  unknownNativeUnit.length,
  2,
  "an unknown native unit does not merge with a known unit without conversion evidence",
);

const excluded = buildMeasurementComparisonSeries([
  observation("7", "glucose", { trend_eligible: false }),
  observation("8", "glucose", { value_kind: "qualitative", value: null }),
  observation("9", "glucose", { measurement_definition_key: null }),
  observation("10", "glucose", { observed_at: null }),
]);
assert.equal(excluded.length, 0, "unresolved, qualitative, and undated rows are not numeric series points");

const filtered = filterMeasurementComparisonSeries(normalized, {
  from: "2026-01-10",
  to: "2026-01-10",
});
assert.equal(filtered.length, 1);
assert.deepEqual(filtered[0]?.points.map((point) => point.id), ["2"], "date boundaries are inclusive");
assert.equal(
  filterMeasurementComparisonSeries(normalized, { from: "2027-01-01", to: null }).length,
  0,
  "points outside the selected date range are excluded",
);

const apiRoute = readFileSync("src/app/api/biomarkers/route.ts", "utf8");
assert.match(apiRoute, /projectActiveRegistryV2LaboratoryBinding/);
assert.match(apiRoute, /documents\(id, original_filename, lab_name(?:, archived_at)?\)/);
assert.match(apiRoute, /conversion_eligible/);
assert.match(apiRoute, /original_ref_low/);
assert.match(apiRoute, /original_ref_high/);

const page = readFileSync("src/app/app/biomarkers/page.tsx", "utf8");
assert.match(page, /buildMeasurementComparisonSeries/);
assert.match(page, /filterMeasurementComparisonSeries/);
assert.match(page, /id="comparison-from"/);
assert.match(page, /id="comparison-to"/);
assert.match(page, /Clear range/);

const comparison = readFileSync("src/lib/biomarker-comparison.ts", "utf8");
assert.match(comparison, /`\/app\/documents\/\$\{documentId\}`/);

const chart = readFileSync("src/components/biomarker-chart.tsx", "utf8");
assert.match(chart, /native_ref_low/);
assert.match(chart, /Open source/);
assert.match(chart, /href=\{point\.source\.href\}/);

console.log("verify-eh129-repeated-measurement-comparison: all checks passed");
