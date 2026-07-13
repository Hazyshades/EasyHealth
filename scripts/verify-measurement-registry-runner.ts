import assert from "node:assert/strict";
import {
  buildMeasurementRegistryRelease,
  classifyMeasurementDefinitionChange,
  digestMeasurementRegistryManifest,
  MEASUREMENT_DEFINITIONS,
  MEASUREMENT_REGISTRY_DIGEST,
  resolveMeasurementDefinition,
  serializeMeasurementRegistryManifest,
  validateMeasurementRegistry,
} from "../src/lib/biomarkers";
import {
  compatibleManualDefinitions,
  decideAutomaticPromotion,
} from "../src/lib/documents/normalization-policy";

const validation = validateMeasurementRegistry();
assert.equal(validation.valid, true, validation.errors.join("; "));
assert.equal(MEASUREMENT_REGISTRY_DIGEST.length, 64);
assert.equal(
  digestMeasurementRegistryManifest([...MEASUREMENT_DEFINITIONS].reverse()),
  MEASUREMENT_REGISTRY_DIGEST,
  "manifest ordering must not affect its digest"
);

const changedAliasDefinitions = MEASUREMENT_DEFINITIONS.map((definition) =>
  definition.key === "neutrophils_percent"
    ? {
        ...definition,
        aliases: [
          ...definition.aliases,
          {
            value: "neu_pct",
            normalizedValue: "neu_pct",
            source: "fixture" as const,
            matchType: "ocr_variant" as const,
          },
        ],
      }
    : definition
);
assert.notEqual(
  digestMeasurementRegistryManifest(changedAliasDefinitions),
  MEASUREMENT_REGISTRY_DIGEST,
  "alias policy changes must affect the digest"
);

const changedDefinition = changedAliasDefinitions.find(
  (definition) => definition.key === "neutrophils_percent"
);
const originalDefinition = MEASUREMENT_DEFINITIONS.find(
  (definition) => definition.key === "neutrophils_percent"
);
assert.ok(changedDefinition && originalDefinition);
assert.equal(
  classifyMeasurementDefinitionChange(originalDefinition, changedDefinition).classification,
  "review_required"
);

const assessmentChanged = {
  ...originalDefinition,
  assessmentCompatibility: "compatible" as const,
};
assert.equal(
  classifyMeasurementDefinitionChange(originalDefinition, assessmentChanged).classification,
  "breaking"
);

const release = buildMeasurementRegistryRelease({
  previousDefinitions: MEASUREMENT_DEFINITIONS,
  regressionFixtures: [{ name: "verify-measurement-registry-runner", status: "passed" }],
});
assert.equal(release.manifestDigest, MEASUREMENT_REGISTRY_DIGEST);
assert.ok(release.changedDefinitions.every((change) => change.classification));
assert.ok(serializeMeasurementRegistryManifest(MEASUREMENT_DEFINITIONS).includes("analyteKey"));

const neutrophilPercentInput = {
  rawLabel: "Neutrophils",
  rawUnit: "%",
  specimen: "whole_blood",
};
assert.deepEqual(
  compatibleManualDefinitions(neutrophilPercentInput).map((definition) => definition.key),
  ["neutrophils_percent"],
  "manual review must not offer definitions with a hard unit conflict"
);
const percentResolution = resolveMeasurementDefinition(neutrophilPercentInput);
assert.deepEqual(
  decideAutomaticPromotion({
    resolution: percentResolution,
    mappingClassification: "compatibility_preserving",
    activeRevision: { verification_status: "manually_corrected" },
    mode: "promote",
    qualityGateApproved: true,
  }),
  { allowed: false, reason: "manual_decision_protected" }
);
assert.deepEqual(
  decideAutomaticPromotion({
    resolution: percentResolution,
    mappingClassification: "compatibility_preserving",
    mode: "promote",
    qualityGateApproved: false,
  }),
  { allowed: false, reason: "quality_gate_not_approved" }
);

console.log("verify-measurement-registry: all checks passed");
