import assert from "node:assert/strict";
import {
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_DEFINITIONS,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  buildPersistedResolverDecisionTrace,
  getReviewedAssessmentBinding,
  presentObservation,
  resolveMeasurementDefinition,
  validateMeasurementRegistry,
} from "../src/lib/biomarkers";
import { MEASUREMENT_CATALOG_MANIFEST_DIGEST } from "../src/lib/biomarkers/measurement-registry-release";
import { projectActiveRegistryV2LaboratoryBinding } from "../src/lib/documents/observation-read-boundaries";
import { buildHealthProfile, getSystemForMarker } from "../src/lib/health-systems";

const validation = validateMeasurementRegistry();
assert.equal(validation.valid, true, validation.errors.join("; "));
assert.ok(MEASUREMENT_DEFINITIONS.every((definition) =>
  definition.maturity !== "reviewed" || definition.sourceProvenance.kind === "registry_v2_review"
));
const glucose = resolveMeasurementDefinition({
  rawLabel: "Glucose",
  rawUnit: "mmol/L",
  specimen: "serum",
  valueKind: "numeric",
});
assert.equal(glucose.result, "resolved");
assert.equal(glucose.measurementDefinitionKey, "glucose_serum");
const glucoseTrace = buildPersistedResolverDecisionTrace(glucose, {
  inputEvidenceHash: "f".repeat(64),
  catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
  catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  resolverVersion: MEASUREMENT_RESOLVER_VERSION,
});
const glucoseBinding = projectActiveRegistryV2LaboratoryBinding(
  {
    observation_kind: "lab",
    measurement_definition_key: "glucose_serum",
    resolution_status: "resolved",
  },
  {
    resolver_result: "resolved",
    measurement_definition_key: "glucose_serum",
    analyte_key: glucose.analyteKey,
    is_active: true,
    resolver_evidence: {
      selectedCandidateKey: "glucose_serum",
      outcome: "resolved",
    },
    input_evidence_hash: glucoseTrace.inputEvidenceHash,
    input_identity_format_version: "1",
    catalog_manifest_version: glucoseTrace.catalogManifestVersion,
    catalog_manifest_digest: glucoseTrace.catalogManifestDigest,
    resolver_version: glucoseTrace.resolverVersion,
    normalization_version: MEASUREMENT_NORMALIZATION_VERSION,
    resolver_decision_trace: glucoseTrace,
    resolver_trace_schema_version: glucoseTrace.schemaVersion,
  },
).resolvedMeasurementBinding;
assert.ok(glucoseBinding);
assert.equal(glucose.measurementDefinitionKey, "glucose_serum");

const band = resolveMeasurementDefinition({
  rawLabel: "Band neutrophils",
  rawUnit: "%",
  specimen: "whole_blood",
  method: "manual",
  valueKind: "numeric",
});
assert.equal(band.result, "resolved");
assert.equal(band.measurementDefinitionKey, "band_neutrophils_percent");

const altWithoutSpecimen = resolveMeasurementDefinition({
  rawLabel: "ALT (alanine aminotransferase)",
  rawUnit: "U/L",
  valueKind: "numeric",
});
assert.equal(altWithoutSpecimen.result, "partial");
assert.equal(altWithoutSpecimen.measurementDefinitionKey, null);
assert.ok(altWithoutSpecimen.missingAxes.includes("specimen"));
assert.ok(altWithoutSpecimen.candidateKeys.includes("alt_serum_catalytic_activity"));
assert.equal(resolveMeasurementDefinition({ rawLabel: "not-a-real-lab-row" }).result, "unmapped");

assert.equal(getSystemForMarker("ldl"), "cardiovascular");
assert.equal(getSystemForMarker("na"), "general", "raw aliases are not assessment identity");
assert.equal(getReviewedAssessmentBinding("glucose_serum")?.binding.assessmentInputKey, "glucose");
assert.equal(getReviewedAssessmentBinding("na"), null);

const converted = presentObservation(
  { resolved_measurement_binding: glucoseBinding, value: 90, unit: "mg/dL", ref_low: 70, ref_high: 99 },
  "si"
);
assert.equal(converted.converted, true);
assert.equal(converted.unit, "mmol/L");
assert.equal(glucoseBinding.conversion.type, "linear");

const rawWithoutDefinition = presentObservation(
  { value: 90, unit: "mg/dL", ref_low: 70, ref_high: 99 },
  "si"
);
assert.equal(rawWithoutDefinition.converted, false, "conversion must require a resolved reviewed binding");

const baseObservation = {
  biomarker_key: "glucose",
  measurement_definition_key: "glucose_serum",
  name: "Glucose",
  value: 5.2,
  unit: "mmol/L",
  ref_low: 3.9,
  ref_high: 5.5,
  observed_at: "2026-07-20",
  document_id: null,
  specimen: "serum",
  modifier: "none",
} as const;

const incompleteProfile = buildHealthProfile([
  { ...baseObservation, resolution_status: "partial", observation_kind: "lab" },
], []);
assert.equal(incompleteProfile.biomarker_observation_count, 0);
assert.equal(incompleteProfile.profile_display_state, "onboarding");

const instrumentalProfile = buildHealthProfile([
  { ...baseObservation, resolution_status: "resolved", observation_kind: "instrumental" },
], []);
assert.equal(instrumentalProfile.biomarker_observation_count, 0);

const resolvedProfile = buildHealthProfile([
  { ...baseObservation, resolution_status: "resolved", observation_kind: "lab" },
], []);
assert.equal(resolvedProfile.biomarker_observation_count, 1);
assert.equal(resolvedProfile.systems.find((system) => system.id === "metabolic")?.markers.length, 1);

const plasmaProfile = buildHealthProfile([
  {
    ...baseObservation,
    measurement_definition_key: "glucose_plasma",
    specimen: "plasma",
    resolution_status: "resolved",
    observation_kind: "lab",
  },
], []);
assert.equal(
  plasmaProfile.biomarker_observation_count,
  1,
  "a resolved specimen-specific Registry 2.0 definition must survive assessment binding"
);

console.log("verify-registry-v2-runtime-cutover: all checks passed");
