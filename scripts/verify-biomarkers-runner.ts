import assert from "node:assert/strict";
import {
  buildPageOcrArtifact,
  buildPersistedResolverDecisionTrace,
  getAnalyte,
  getMeasurementDefinitionsForAnalyte,
  isPageOcrArtifact,
  observationIdentityKey,
  parseLabValueCell,
  presentObservation,
  resolveMeasurementDefinition,
  validateMeasurementRegistry,
} from "../src/lib/biomarkers";
import {
  MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  serializeMeasurementRegistryManifest,
} from "../src/lib/biomarkers/measurement-registry-release";
import {
  buildHealthProfile,
  getSystemForMarker,
} from "../src/lib/health-systems";
import { projectActiveRegistryV2LaboratoryBinding } from "../src/lib/documents/observation-read-boundaries";

function approx(actual: number, expected: number, epsilon = 0.05) {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ${actual} ≈ ${expected}`,
  );
}
function resolvedBinding(measurementDefinitionKey: string) {
  const resolution = resolveMeasurementDefinition(
    measurementDefinitionKey === "glucose_serum"
      ? {
          rawLabel: "Glucose",
          rawUnit: "mg/dL",
          specimen: "serum",
          valueKind: "numeric",
        }
      : {
          rawLabel: "LDL",
          rawUnit: "mg/dL",
          specimen: "serum",
          valueKind: "numeric",
        },
  );
  assert.equal(resolution.result, "resolved");
  assert.equal(resolution.measurementDefinitionKey, measurementDefinitionKey);
  const trace = buildPersistedResolverDecisionTrace(resolution, {
    inputEvidenceHash: "a".repeat(64),
    catalogManifestVersion: "catalog-test",
    catalogManifestDigest: "d".repeat(64),
    resolverVersion: "resolver-test",
  });
  const binding = projectActiveRegistryV2LaboratoryBinding(
    {
      observation_kind: "lab",
      measurement_definition_key: measurementDefinitionKey,
      resolution_status: "resolved",
    },
    {
      resolver_result: "resolved",
      measurement_definition_key: measurementDefinitionKey,
      analyte_key: resolution.analyteKey,
      verification_status: "user_verified",
      is_active: true,
      input_evidence_hash: trace.inputEvidenceHash,
      input_identity_format_version: "1",
      catalog_manifest_version: trace.catalogManifestVersion,
      catalog_manifest_digest: trace.catalogManifestDigest,
      resolver_version: trace.resolverVersion,
      normalization_version: "normalization-test",
      resolver_decision_trace: trace,
      resolver_trace_schema_version: trace.schemaVersion,
    },
  ).resolvedMeasurementBinding;
  assert.ok(binding);
  return binding;
}

const neutrophilPercent = resolveMeasurementDefinition({
  rawLabel: "Neutrophils",
  rawUnit: "%",
  specimen: "whole_blood",
  valueKind: "numeric",
});
assert.equal(neutrophilPercent.result, "resolved");
assert.equal(neutrophilPercent.measurementDefinitionKey, "neutrophils_percent");
assert.equal(
  resolveMeasurementDefinition({ rawLabel: "Neutrophils" }).result,
  "partial",
);
assert.equal(
  resolveMeasurementDefinition({ rawLabel: "RDW", rawUnit: "fL" }).result,
  "partial",
);
assert.equal(getMeasurementDefinitionsForAnalyte("glucose").length, 6);
assert.ok(getAnalyte("neutrophils"));
assert.equal(validateMeasurementRegistry().valid, true);
assert.equal(MEASUREMENT_CATALOG_MANIFEST_DIGEST.length, 64);
assert.equal(
  serializeMeasurementRegistryManifest(
    getMeasurementDefinitionsForAnalyte("glucose"),
  ),
  serializeMeasurementRegistryManifest(
    [...getMeasurementDefinitionsForAnalyte("glucose")].reverse(),
  ),
);

assert.equal(getSystemForMarker("crp"), "inflammation");
assert.equal(getSystemForMarker("vitamin_d"), "nutrients");
assert.equal(getSystemForMarker("sodium"), "kidney");
assert.equal(getSystemForMarker("unknown_raw_key"), "general");

const glucoseSi = presentObservation(
  {
    resolved_measurement_binding: resolvedBinding("glucose_serum"),
    value: 90,
    unit: "mg/dL",
    ref_low: 70,
    ref_high: 99,
  },
  "si",
);
assert.equal(glucoseSi.converted, true);
approx(glucoseSi.value, 90 * 0.0555);

const ldlSi = presentObservation(
  {
    resolved_measurement_binding: resolvedBinding("ldl_serum"),
    value: 100,
    unit: "mg/dL",
    ref_low: null,
    ref_high: null,
  },
  "si",
);
approx(ldlSi.value, 100 * 0.0259);

const profile = buildHealthProfile(
  [
    {
      biomarker_key: "ldl",
      measurement_definition_key: "ldl_serum",
      name: "LDL",
      value: 90,
      unit: "mg/dL",
      ref_low: 0,
      ref_high: 100,
      observed_at: "2026-01-01",
      document_id: null,
      specimen: "serum",
    },
    {
      biomarker_key: "hdl",
      measurement_definition_key: "hdl_serum",
      name: "HDL",
      value: 55,
      unit: "mg/dL",
      ref_low: 40,
      ref_high: 100,
      observed_at: "2026-01-01",
      document_id: null,
      specimen: "serum",
    },
    {
      biomarker_key: "triglycerides",
      measurement_definition_key: "triglycerides_serum",
      name: "Triglycerides",
      value: 100,
      unit: "mg/dL",
      ref_low: 0,
      ref_high: 150,
      observed_at: "2026-01-01",
      document_id: null,
      specimen: "serum",
    },
  ],
  [],
);
const cardiovascular = profile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.equal(cardiovascular?.scoreability, "scoreable");
assert.ok(cardiovascular?.state_score != null);

const negative = parseLabValueCell("Negative");
assert.equal(negative?.value_kind, "ordinal");
assert.equal(negative?.ordinal, 0);
assert.notEqual(
  observationIdentityKey("creatinine", "serum", "none"),
  observationIdentityKey("creatinine", "urine", "none"),
);

const ocrArtifact = buildPageOcrArtifact({
  engine: "pdf-text",
  page_number: 1,
  full_text: "Glucose 90",
});
assert.equal(isPageOcrArtifact(ocrArtifact), true);
const evidenceInput = {
  rawLabel: "ALT",
  rawUnit: "U/L",
  specimen: "serum",
  valueKind: "numeric" as const,
};
const evidenceResolution = resolveMeasurementDefinition(evidenceInput);
assert.equal(evidenceResolution.result, "resolved");
assert.equal(evidenceResolution.decisionTrace.version, 2);
assert.equal(
  evidenceResolution.decisionTrace.selectedCandidateKey,
  evidenceResolution.measurementDefinitionKey,
);
assert.deepEqual(
  resolveMeasurementDefinition(evidenceInput),
  evidenceResolution,
);

const valueKindConflict = resolveMeasurementDefinition({
  ...evidenceInput,
  valueKind: "qualitative" as const,
});
assert.equal(valueKindConflict.result, "partial");
assert.ok(valueKindConflict.conflicts.includes("value_kind_conflict"));
assert.equal(
  resolveMeasurementDefinition({
    rawLabel: "",
    proposedKey: "alt_serum_catalytic_activity",
  }).result,
  "unmapped",
);

console.log("verify-biomarkers: all checks passed");
