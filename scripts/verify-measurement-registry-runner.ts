import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  MEASUREMENT_DEFINITIONS,
  digestMeasurementRegistryManifest,
  normalizeMeasurementUnit,
  resolveMeasurementDefinition,
  serializeMeasurementRegistryManifest,
  validateMeasurementRegistry,
} from "../src/lib/biomarkers";
import { acceptancePathForResolution, decideAutomaticPromotion } from "../src/lib/documents/normalization-policy";

const validation = validateMeasurementRegistry();
assert.equal(validation.valid, true, validation.errors.join("; "));
assert.ok(MEASUREMENT_DEFINITIONS.some((definition) => definition.maturity === "reviewed"));
assert.ok(MEASUREMENT_DEFINITIONS.every((definition) =>
  definition.maturity !== "reviewed" || definition.sourceProvenance.kind === "registry_v2_review"
));
assert.match(readFileSync("supabase/migrations/025_registry_v2_hard_cutover.sql", "utf8"), /'partial'/);
assert.equal(digestMeasurementRegistryManifest([...MEASUREMENT_DEFINITIONS].reverse()), MEASUREMENT_CATALOG_MANIFEST_DIGEST);
assert.ok(serializeMeasurementRegistryManifest(MEASUREMENT_DEFINITIONS).includes("assessmentBindings"));
assert.deepEqual(normalizeMeasurementUnit("U/L"), { raw: "U/L", normalizedUnit: "u/l", dimension: "catalytic_activity_concentration" });

for (const enzyme of ["alt", "ast", "alp", "ggt"] as const) {
  const resolved = resolveMeasurementDefinition({ rawLabel: enzyme, rawUnit: "U/L", specimen: "serum", valueKind: "numeric" });
  assert.equal(resolved.result, "resolved");
  assert.equal(resolved.measurementDefinitionKey, `${enzyme}_serum_catalytic_activity`);
}

const altPartial = resolveMeasurementDefinition({ rawLabel: "ALT (alanine aminotransferase)", rawUnit: "U/L", valueKind: "numeric" });
assert.equal(altPartial.result, "partial");
assert.equal(altPartial.analyteKey, null, "incomplete evidence must not infer a concrete analyte identity");
assert.ok(altPartial.missingAxes.includes("specimen"));
assert.equal(acceptancePathForResolution(altPartial), "raw");

const opisthorchis = resolveMeasurementDefinition({ rawLabel: "anti-Opisthorchis felineus IgG, qualitative ELISA", valueKind: "qualitative" });
assert.equal(opisthorchis.result, "partial");
assert.equal(opisthorchis.analyteKey, "opisthorchis_felineus_igg");
assert.equal(resolveMeasurementDefinition({ rawLabel: "Not a known laboratory marker" }).result, "unmapped");

const fastingWithoutModifier = resolveMeasurementDefinition({ rawLabel: "FPG", rawUnit: "mmol/L", specimen: "plasma", valueKind: "numeric" });
assert.equal(fastingWithoutModifier.result, "partial");
assert.ok(fastingWithoutModifier.missingAxes.includes("modifier"));

const glucoseWithoutSpecimen = resolveMeasurementDefinition({ rawLabel: "Glucose", rawUnit: "mmol/L", valueKind: "numeric" });
assert.equal(glucoseWithoutSpecimen.result, "partial");
assert.ok(glucoseWithoutSpecimen.missingAxes.includes("specimen"));
assert.deepEqual(decideAutomaticPromotion({ resolution: altPartial, mappingClassification: "compatibility_preserving", qualityGateApproved: true }), { allowed: false, reason: "resolver_not_resolved" });

console.log("verify-measurement-registry: all checks passed");
