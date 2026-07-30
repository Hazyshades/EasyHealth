import assert from "node:assert/strict";
import {
  SAMPLE_NEWEST_LAUNCH_FIXTURES,
  buildLaunchCoverageReport,
  getMeasurementConversionPolicy,
  getReviewedAssessmentBinding,
  resolveMeasurementDefinition,
} from "../src/lib/biomarkers";
import { projectActiveRegistryV2LaboratoryBinding } from "../src/lib/documents/observation-read-boundaries";

const cbcFixtures = SAMPLE_NEWEST_LAUNCH_FIXTURES.filter((fixture) => fixture.section === "CBC");
assert.ok(cbcFixtures.length > 0, "CBC launch fixtures are required");

for (const fixture of cbcFixtures) {
  if (!fixture.expected) continue;
  const resolution = resolveMeasurementDefinition(fixture);
  assert.equal(resolution.result, fixture.expected.result, `${fixture.id}: unexpected resolver outcome`);
  if (fixture.expected.measurementDefinitionKey !== undefined) {
    assert.equal(resolution.measurementDefinitionKey, fixture.expected.measurementDefinitionKey, `${fixture.id}: unexpected concrete identity`);
  }
  for (const axis of fixture.expected.missingAxes ?? []) {
    assert.ok(resolution.missingAxes.includes(axis as never), `${fixture.id}: missing axis ${axis} was not retained`);
  }
  for (const conflict of fixture.expected.conflicts ?? []) {
    assert.ok(resolution.conflicts.includes(conflict as never), `${fixture.id}: conflict ${conflict} was not retained`);
  }
}

const report = buildLaunchCoverageReport();
assert.equal(report.cbc.unmapped, 1, "the unsupported OCR corruption must remain unmapped");
assert.ok(report.cbc.partial >= 3, "CBC incomplete-context cases must remain visible");
assert.ok(report.cbc.byMissingAxis.specimen > 0, "missing specimen must be segmented");
assert.ok(report.cbc.byMissingAxis.value_kind > 0, "missing value kind must be segmented");
assert.ok(report.cbc.byMissingAxis.method > 0, "missing method must be segmented");
assert.ok(report.cbc.byAliasMatch.alias_exact_match > 0 || report.cbc.byAliasMatch.alias_normalized_match > 0, "CBC aliases must be represented in coverage");

const partialNeutrophils = resolveMeasurementDefinition({ rawLabel: "NEU", rawUnit: "%", valueKind: "numeric" });
assert.equal(partialNeutrophils.result, "partial");
assert.equal(partialNeutrophils.measurementDefinitionKey, null);
assert.ok(partialNeutrophils.candidateKeys.includes("neutrophils_percent"));

const unsafeCandidateProjection = projectActiveRegistryV2LaboratoryBinding(
  { observation_kind: "lab", measurement_definition_key: "neutrophils_percent", resolution_status: "resolved" },
  { is_active: true, resolver_result: "partial", measurement_definition_key: "neutrophils_percent", verification_status: "pending" }
);
assert.equal(unsafeCandidateProjection.registryBindingReady, false, "partial candidate evidence cannot activate a CBC binding");
assert.equal(getMeasurementConversionPolicy(partialNeutrophils.measurementDefinitionKey ?? ""), null, "candidate evidence cannot obtain a conversion policy");
assert.equal(getReviewedAssessmentBinding(partialNeutrophils.measurementDefinitionKey), null, "candidate evidence cannot obtain an assessment binding");

const reviewedProjection = projectActiveRegistryV2LaboratoryBinding(
  { observation_kind: "lab", measurement_definition_key: "wbc_whole_blood", resolution_status: "resolved" },
  { is_active: true, resolver_result: "resolved", measurement_definition_key: "wbc_whole_blood", verification_status: "auto_verified" }
);
assert.equal(reviewedProjection.registryBindingReady, true, "an active reviewed resolved CBC revision is consumer-safe");

console.log("verify-eh113-cbc-launch-catalog: all checks passed");
