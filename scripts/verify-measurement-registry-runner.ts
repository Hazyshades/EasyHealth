import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  buildPersistedResolverDecisionTrace,
  isPersistedResolverDecisionTrace,
  MEASUREMENT_DEFINITIONS,
  classifyMeasurementDefinitionChange,
  digestMeasurementRegistryManifest,
  findAliasAdmissions,
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
assert.ok(serializeMeasurementRegistryManifest(MEASUREMENT_DEFINITIONS).includes("matchAuthority"));
assert.ok(MEASUREMENT_DEFINITIONS.every((definition) =>
  definition.aliases.every((alias) => alias.key && alias.measurementDefinitionKey === definition.key && alias.provenance.sourceRecordKey)
));
assert.ok(findAliasAdmissions({ rawLabel: "Glucose", laboratory: null }).some(({ alias }) => alias.matchAuthority === "reviewed_resolution"));
const glucose = MEASUREMENT_DEFINITIONS.find((definition) => definition.key === "glucose_serum")!;
const deprecatedGlucose = { ...glucose, aliases: glucose.aliases.map((alias) => ({ ...alias, lifecycle: "deprecated" as const })) };
assert.equal(validateMeasurementRegistry([deprecatedGlucose]).valid, true);
assert.equal(resolveMeasurementDefinition({ rawLabel: "Not a known laboratory marker" }).candidateEvidence.length, 0);
assert.equal(classifyMeasurementDefinitionChange(glucose, deprecatedGlucose).classification, "breaking");
const fuzzyDefinition = {
  ...glucose,
  aliases: [{
    ...glucose.aliases[0]!,
    key: "test:fuzzy",
    value: "Glucose",
    normalizedValue: "glucose",
    matchType: "bounded_fuzzy" as const,
    maxNormalizedEditDistance: 1 as const,
  }],
};
assert.equal(findAliasAdmissions({ rawLabel: "Glocose", laboratory: null }, [fuzzyDefinition]).length, 1);
assert.equal(findAliasAdmissions({ rawLabel: "Gloxxse", laboratory: null }, [fuzzyDefinition]).length, 0);
const scopedDefinition = {
  ...glucose,
  aliases: [{ ...glucose.aliases[0]!, key: "test:scoped", laboratory: "lab-a" }],
};
assert.equal(findAliasAdmissions({ rawLabel: "Glucose", laboratory: "lab-b" }, [scopedDefinition]).length, 0);
assert.equal(findAliasAdmissions({ rawLabel: "Glucose", laboratory: null }, [deprecatedGlucose]).length, 0);
const invalidFuzzy = {
  ...fuzzyDefinition,
  aliases: [{ ...fuzzyDefinition.aliases[0]!, key: "test:invalid-fuzzy", matchAuthority: "recognition_only" as const }],
};
assert.equal(validateMeasurementRegistry([invalidFuzzy]).valid, false);

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

const traceOptions = {
  inputEvidenceHash: "a".repeat(64),
  catalogManifestVersion: "eh115-test",
  catalogManifestDigest: "eh115-test-digest",
  resolverVersion: "eh115-test",
};
const resolvedTrace = buildPersistedResolverDecisionTrace(
  resolveMeasurementDefinition({ rawLabel: "ALT (alanine aminotransferase)", rawUnit: "U/L", specimen: "serum", valueKind: "numeric" }),
  traceOptions
);
assert.equal(resolvedTrace.outcome, "resolved");
assert.equal(resolvedTrace.decisionKind, "single_reviewed_candidate");
assert.equal(resolvedTrace.winningCandidateKey, "alt_serum_catalytic_activity");
assert.equal(JSON.stringify(resolvedTrace).includes("ALT (alanine aminotransferase)"), false);

const ambiguousTrace = buildPersistedResolverDecisionTrace(
  {
    ...resolveMeasurementDefinition({
      rawLabel: "ALT",
      rawUnit: "U/L",
      specimen: "serum",
      valueKind: "numeric",
    }),
    result: "ambiguous",
    measurementDefinitionKey: null,
    analyteKey: null,
  },
  traceOptions
);
assert.equal(ambiguousTrace.outcome, "ambiguous");
assert.equal(ambiguousTrace.decisionKind, "multiple_reviewed_candidates");
assert.equal(isPersistedResolverDecisionTrace(ambiguousTrace), true);
const nonCanonicalTrace = {
  ...ambiguousTrace,
  candidates: [...ambiguousTrace.candidates].reverse(),
};
assert.equal(isPersistedResolverDecisionTrace(nonCanonicalTrace), false);

const manualBaseResolution = resolveMeasurementDefinition({
  rawLabel: "ALT",
  rawUnit: "U/L",
  specimen: "serum",
  valueKind: "numeric",
});
const manualResolution = {
  ...manualBaseResolution,
  candidateEvidence: manualBaseResolution.candidateEvidence.map((candidate) => ({
    ...candidate,
    accepted: [...candidate.accepted, { code: "manual_selection" as const, source: "manual" as const, strength: "strong" as const, score: 3 }],
  })),
};
assert.equal(buildPersistedResolverDecisionTrace(manualResolution, traceOptions).decisionKind, "manual_selection");
assert.equal(buildPersistedResolverDecisionTrace(altPartial, traceOptions).decisionKind, "recognized_incomplete");
assert.equal(buildPersistedResolverDecisionTrace(resolveMeasurementDefinition({ rawLabel: "Patient secret 42" }), traceOptions).decisionKind, "no_matching_candidate");

console.log("verify-measurement-registry: all checks passed");
