import assert from "node:assert/strict";
import {
  MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  buildPageOcrArtifact,
  getAnalyte,
  getMeasurementDefinitionsForAnalyte,
  isPageOcrArtifact,
  observationIdentityKey,
  parseLabValueCell,
  presentObservation,
  resolveMeasurementDefinition,
  serializeMeasurementRegistryManifest,
  validateMeasurementRegistry,
} from "../src/lib/biomarkers";
import { buildHealthProfile, computeSystemStateScore, getSystemForMarker } from "../src/lib/health-systems";

function approx(actual: number, expected: number, epsilon = 0.05) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} ≈ ${expected}`);
}

const neutrophilPercent = resolveMeasurementDefinition({ rawLabel: "Neutrophils", rawUnit: "%", specimen: "whole_blood" });
assert.equal(neutrophilPercent.result, "resolved");
assert.equal(neutrophilPercent.measurementDefinitionKey, "neutrophils_percent");
assert.equal(resolveMeasurementDefinition({ rawLabel: "Neutrophils" }).result, "partial");
assert.equal(resolveMeasurementDefinition({ rawLabel: "RDW", rawUnit: "fL" }).result, "partial");
assert.equal(getMeasurementDefinitionsForAnalyte("glucose").length, 4);
assert.ok(getAnalyte("neutrophils"));
assert.equal(validateMeasurementRegistry().valid, true);
assert.equal(MEASUREMENT_CATALOG_MANIFEST_DIGEST.length, 64);
assert.equal(
  serializeMeasurementRegistryManifest(getMeasurementDefinitionsForAnalyte("glucose")),
  serializeMeasurementRegistryManifest([...getMeasurementDefinitionsForAnalyte("glucose")].reverse())
);

assert.equal(getSystemForMarker("crp"), "inflammation");
assert.equal(getSystemForMarker("vitamin_d"), "nutrients");
assert.equal(getSystemForMarker("sodium"), "kidney");
assert.equal(getSystemForMarker("unknown_raw_key"), "general");

const glucoseSi = presentObservation(
  { measurement_definition_key: "glucose_serum", value: 90, unit: "mg/dL", ref_low: 70, ref_high: 99 },
  "si"
);
assert.equal(glucoseSi.converted, true);
approx(glucoseSi.value, 90 * 0.0555);

const ldlSi = presentObservation(
  { measurement_definition_key: "ldl_serum", value: 100, unit: "mg/dL", ref_low: null, ref_high: null },
  "si"
);
approx(ldlSi.value, 100 * 0.0259);

const profile = buildHealthProfile([
  { biomarker_key: "ldl", measurement_definition_key: "ldl_serum", name: "LDL", value: 90, unit: "mg/dL", ref_low: 0, ref_high: 100, observed_at: "2026-01-01", document_id: null, specimen: "serum" },
  { biomarker_key: "hdl", measurement_definition_key: "hdl_serum", name: "HDL", value: 55, unit: "mg/dL", ref_low: 40, ref_high: 100, observed_at: "2026-01-01", document_id: null, specimen: "serum" },
  { biomarker_key: "triglycerides", measurement_definition_key: "triglycerides_serum", name: "Triglycerides", value: 100, unit: "mg/dL", ref_low: 0, ref_high: 150, observed_at: "2026-01-01", document_id: null, specimen: "serum" },
], []);
const cardiovascular = profile.systems.find((system) => system.id === "cardiovascular");
assert.equal(cardiovascular?.scoreability, "scoreable");
assert.ok(cardiovascular?.state_score != null);
assert.ok(computeSystemStateScore("cardiovascular", cardiovascular?.markers ?? []) != null);

const negative = parseLabValueCell("Negative");
assert.equal(negative?.value_kind, "ordinal");
assert.equal(negative?.ordinal, 0);
assert.notEqual(observationIdentityKey("creatinine", "serum", "none"), observationIdentityKey("creatinine", "urine", "none"));

const ocrArtifact = buildPageOcrArtifact({ engine: "pdf-text", page_number: 1, full_text: "Glucose 90" });
assert.equal(isPageOcrArtifact(ocrArtifact), true);

console.log("verify-biomarkers: all checks passed");
