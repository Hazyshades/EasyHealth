import assert from "node:assert/strict";
import {
  MEASUREMENT_CATALOG_MANIFEST_RELEASE,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  evaluateSpecimenCompatibility,
  evaluateUnitCompatibility,
  evaluateValueKindCompatibility,
  getMeasurementDefinition,
  normalizeMeasurementUnit,
  parseLabValueCell,
  presentObservation,
  resolveMeasurementDefinition,
  validateMeasurementRegistry,
  type MeasurementDefinition,
  type MeasurementUnitPolicy,
  type ResolverResult,
} from "../src/lib/biomarkers";
import {
  projectActiveRegistryV2LaboratoryBinding,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "../src/lib/documents/observation-read-boundaries";
import {
  buildNormalizationResolutionPayload,
  measurementInputFromWriterRow,
  type ExtractedBiomarkerWriterRow,
} from "../src/lib/documents/observation-normalization-writer";
import {
  REQUIRED_CANDIDATE_CORPUS_ROW_COUNT,
  runRegistryV2CandidateCorpus,
} from "./lib/registry-v2-candidate-corpus";

const ambiguousUnitPolicy: MeasurementUnitPolicy = {
  dimensions: ["molar_concentration", "mass_concentration"],
  acceptedUnits: ["mmol/l", "mg/dl"],
  canonicalUnit: "mmol/l",
  conversionPolicyRef: "registry-2.0:test",
  missingUnitPolicy: "ambiguous",
};
const rejectUnitPolicy: MeasurementUnitPolicy = {
  ...ambiguousUnitPolicy,
  missingUnitPolicy: "reject",
};
const displayOnlyPolicy: MeasurementUnitPolicy = {
  dimensions: [],
  acceptedUnits: [],
  canonicalUnit: null,
  conversionPolicyRef: null,
  missingUnitPolicy: "display_only",
};

const unitCases = [
  {
    name: "ambiguous missing",
    result: evaluateUnitCompatibility(ambiguousUnitPolicy, normalizeMeasurementUnit(null)),
    disposition: "missing",
    code: "unit_missing",
    selectable: true,
  },
  {
    name: "rejected missing",
    result: evaluateUnitCompatibility(rejectUnitPolicy, normalizeMeasurementUnit(null)),
    disposition: "missing",
    code: "unit_missing",
    selectable: false,
  },
  {
    name: "display-only missing",
    result: evaluateUnitCompatibility(displayOnlyPolicy, normalizeMeasurementUnit(null)),
    disposition: "compatible",
    code: "unit_not_required",
    selectable: true,
  },
  {
    name: "accepted normalized unit",
    result: evaluateUnitCompatibility(ambiguousUnitPolicy, normalizeMeasurementUnit("mmol/L")),
    disposition: "compatible",
    code: "unit_compatible",
    selectable: true,
  },
  {
    name: "wrong unit family",
    result: evaluateUnitCompatibility(ambiguousUnitPolicy, normalizeMeasurementUnit("%")),
    disposition: "conflict",
    code: "unit_dimension_conflict",
    selectable: false,
  },
  {
    name: "rejected token in supported family",
    result: evaluateUnitCompatibility(ambiguousUnitPolicy, normalizeMeasurementUnit("g/L")),
    disposition: "conflict",
    code: "unit_not_accepted",
    selectable: false,
  },
  {
    name: "unknown observed token",
    result: evaluateUnitCompatibility(ambiguousUnitPolicy, normalizeMeasurementUnit("widgets/L")),
    disposition: "conflict",
    code: "unit_unsupported",
    selectable: false,
  },
] as const;
for (const testCase of unitCases) {
  assert.equal(testCase.result.disposition, testCase.disposition, testCase.name);
  assert.equal(testCase.result.evidence.code, testCase.code, testCase.name);
  assert.equal(testCase.result.selectable, testCase.selectable, testCase.name);
}

const valueKindCases = [
  ["numeric", "numeric", "compatible", "value_kind_compatible"],
  ["numeric", null, "missing", "value_kind_missing"],
  ["numeric", "qualitative", "conflict", "value_kind_conflict"],
  ["numeric", "ordinal", "conflict", "value_kind_conflict"],
  ["qualitative", "qualitative", "compatible", "value_kind_compatible"],
  ["qualitative", "ordinal", "compatible", "value_kind_compatible"],
  ["ordinal", "qualitative", "compatible", "value_kind_compatible"],
] as const;
for (const [expected, observed, disposition, code] of valueKindCases) {
  const result = evaluateValueKindCompatibility(expected, observed);
  assert.ok(result);
  assert.equal(result.disposition, disposition, `${expected}/${observed}`);
  assert.equal(result.evidence.code, code, `${expected}/${observed}`);
}
const parsedNegative = parseLabValueCell("Negative");
assert.equal(parsedNegative?.value_kind, "ordinal");
const parsedNegativeCompatibility = evaluateValueKindCompatibility(
  "qualitative",
  parsedNegative?.value_kind
);
assert.ok(parsedNegativeCompatibility);
assert.equal(parsedNegativeCompatibility.disposition, "compatible");

const specimenCases = [
  ["serum", "serum", "compatible", "specimen_compatible"],
  ["serum", null, "missing", "specimen_missing"],
  ["serum", "plasma", "conflict", "specimen_conflict"],
  ["whole_blood", "urine", "conflict", "specimen_conflict"],
  ["urine", "whole_blood", "conflict", "specimen_conflict"],
  ["serum", "saliva", "conflict", "specimen_unsupported"],
] as const;
for (const [expected, observed, disposition, code] of specimenCases) {
  const result = evaluateSpecimenCompatibility(expected, observed);
  assert.ok(result);
  assert.equal(result.disposition, disposition, `${expected}/${observed}`);
  assert.equal(result.evidence.code, code, `${expected}/${observed}`);
}

const missingUnit = resolveMeasurementDefinition({
  rawLabel: "Glucose",
  specimen: "serum",
  valueKind: "numeric",
});
assert.equal(missingUnit.result, "partial");
assert.ok(missingUnit.missingAxes.includes("unit"));
assert.ok(missingUnit.candidateEvidence.some((candidate) =>
  candidate.missing.some((item) => item.code === "unit_missing")
));

const missingValueKind = resolveMeasurementDefinition({
  rawLabel: "Glucose",
  rawUnit: "mmol/L",
  specimen: "serum",
});
assert.equal(missingValueKind.result, "partial");
assert.ok(missingValueKind.missingAxes.includes("value_kind"));

const resolvedGlucose = resolveMeasurementDefinition({
  rawLabel: "Glucose",
  rawUnit: "mmol/L",
  specimen: "serum",
  valueKind: "numeric",
});
assert.equal(resolvedGlucose.result, "resolved");
assert.equal(resolvedGlucose.measurementDefinitionKey, "glucose_serum");

const percentAgainstAbsolute = resolveMeasurementDefinition({
  rawLabel: "Neutrophils absolute",
  rawUnit: "%",
  specimen: "whole_blood",
  valueKind: "numeric",
});
assert.ok(percentAgainstAbsolute.conflicts.includes("unit_dimension_conflict"));
assert.equal(percentAgainstAbsolute.measurementDefinitionKey, null);
const absoluteAgainstPercent = resolveMeasurementDefinition({
  rawLabel: "Neutrophils percent",
  rawUnit: "10^9/L",
  specimen: "whole_blood",
  valueKind: "numeric",
});
assert.ok(absoluteAgainstPercent.conflicts.includes("unit_dimension_conflict"));
assert.equal(absoluteAgainstPercent.measurementDefinitionKey, null);

const urineAgainstBlood = resolveMeasurementDefinition({
  rawLabel: "Glucose",
  rawUnit: "mmol/L",
  specimen: "urine",
  valueKind: "numeric",
});
assert.ok(urineAgainstBlood.conflicts.includes("specimen_conflict"));
assert.equal(urineAgainstBlood.measurementDefinitionKey, null);
const bloodAgainstUrine = resolveMeasurementDefinition({
  rawLabel: "UACR",
  rawUnit: "mg/g",
  specimen: "serum",
  valueKind: "numeric",
});
assert.ok(bloodAgainstUrine.conflicts.includes("specimen_conflict"));
assert.equal(bloodAgainstUrine.measurementDefinitionKey, null);

const glucoseDefinition = getMeasurementDefinition("glucose_serum");
assert.ok(glucoseDefinition);
const tieDefinition = (key: string): MeasurementDefinition => ({
  ...glucoseDefinition,
  key,
  aliases: [
    {
      ...glucoseDefinition.aliases[0]!,
      key: `${key}:alias`,
      measurementDefinitionKey: key,
      value: "Tie analyte",
      normalizedValue: "tie_analyte",
    },
  ],
});
const tied = resolveMeasurementDefinition(
  {
    rawLabel: "Tie analyte",
    rawUnit: "mmol/L",
    specimen: "serum",
    valueKind: "numeric",
  },
  [tieDefinition("tie_a"), tieDefinition("tie_b")]
);
assert.equal(tied.result, "ambiguous");
assert.equal(tied.measurementDefinitionKey, null);
assert.deepEqual(tied.candidateKeys, ["tie_a", "tie_b"]);

const relation = (
  result: ResolverResult,
  measurementDefinitionKey: string | null,
  selectedCandidateKey: string | null,
  isActive = true,
  outcome: ResolverResult = result
): RegistryV2NormalizationRevisionReadBoundary => ({
  resolver_result: result,
  measurement_definition_key: measurementDefinitionKey,
  is_active: isActive,
  resolver_evidence: {
    version: 2,
    compatibilityPolicyVersion: MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
    selectedCandidateKey,
    outcome,
  },
});
const observation = {
  observation_kind: "lab",
  measurement_definition_key: "glucose_serum",
  resolution_status: "resolved",
};
const resolvedBinding = projectActiveRegistryV2LaboratoryBinding(
  observation,
  relation("resolved", "glucose_serum", "glucose_serum")
);
assert.equal(resolvedBinding.registryBindingReady, true);
assert.ok(resolvedBinding.resolvedMeasurementBinding);
const converted = presentObservation(
  {
    resolved_measurement_binding: resolvedBinding.resolvedMeasurementBinding,
    value: 90,
    unit: "mg/dL",
    ref_low: 70,
    ref_high: 99,
  },
  "si"
);
assert.equal(converted.converted, true);
assert.equal(converted.unit, "mmol/L");

const deniedBindings = [
  ["partial", relation("partial", null, "glucose_serum")],
  ["ambiguous", relation("ambiguous", null, "glucose_serum")],
  ["unmapped", relation("unmapped", null, null)],
  ["provisional", relation("resolved", "sample_alt_sample", "sample_alt_sample")],
  ["inactive", relation("resolved", "glucose_serum", "glucose_serum", false)],
  ["mismatched trace", relation("resolved", "glucose_serum", "glucose_plasma")],
  ["trace outcome mismatch", relation("resolved", "glucose_serum", "glucose_serum", true, "partial")],
  ["missing axis evidence", relation("partial", null, "glucose_serum")],
  ["conflicted evidence", relation("partial", null, "glucose_serum")],
] as const;
for (const [name, revision] of deniedBindings) {
  const projected = projectActiveRegistryV2LaboratoryBinding(observation, revision);
  assert.equal(projected.measurementDefinitionKey, null, name);
  assert.equal(projected.resolvedMeasurementBinding, null, name);
  const native = presentObservation(
    { value: 90, unit: "mg/dL", ref_low: 70, ref_high: 99 },
    "si"
  );
  assert.equal(native.converted, false, name);
  assert.equal(native.value, 90, name);
  assert.equal(native.unit, "mg/dL", name);
}

const historicalTraceBinding = projectActiveRegistryV2LaboratoryBinding(
  observation,
  {
    resolver_result: "resolved",
    measurement_definition_key: "glucose_serum",
    is_active: true,
    resolver_evidence: {
      version: 1,
      selectedCandidateKey: "glucose_serum",
      outcome: "resolved",
    },
  }
);
assert.equal(historicalTraceBinding.registryBindingReady, true);

const writerRow: ExtractedBiomarkerWriterRow = {
  id: "eh111-synthetic-alt",
  biomarker_key: "alt",
  biomarker_name: "ALT",
  raw_name: "ALT",
  value_numeric: 28,
  value_text: "28",
  value_kind: "numeric",
  ordinal: null,
  unit: "U/L",
  raw_unit: "U/L",
  reference_range: "0-40",
  raw_reference_range: "0-40",
  section_context: "Liver panel",
  confidence: 0.99,
  specimen: "serum",
  modifier: null,
  source_page: 1,
  source_text: "ALT 28 U/L",
  reported_alt_value: null,
  reported_alt_unit: null,
  raw_value_text: "28",
  processing_version: "eh111-smoke",
};
const writerInput = measurementInputFromWriterRow(writerRow);
assert.equal(writerInput.rawUnit, "U/L");
assert.equal(writerInput.valueKind, "numeric");
assert.equal(writerInput.specimen, "serum");
const writerResolution = resolveMeasurementDefinition(writerInput);
assert.equal(writerResolution.result, "resolved");
const persistencePayload = buildNormalizationResolutionPayload(
  writerInput,
  writerResolution
);
assert.equal(persistencePayload.resolver_version, MEASUREMENT_RESOLVER_VERSION);
assert.equal(persistencePayload.normalization_version, MEASUREMENT_NORMALIZATION_VERSION);
assert.equal(
  persistencePayload.resolver_evidence.compatibilityPolicyVersion,
  MEASUREMENT_COMPATIBILITY_POLICY_VERSION
);
const readAfterPublication = projectActiveRegistryV2LaboratoryBinding(
  {
    observation_kind: "lab",
    measurement_definition_key: persistencePayload.measurement_definition_key,
    resolution_status: persistencePayload.resolver_result,
  },
  {
    resolver_result: persistencePayload.resolver_result,
    measurement_definition_key: persistencePayload.measurement_definition_key,
    is_active: true,
    resolver_evidence: persistencePayload.resolver_evidence,
  }
);
assert.equal(readAfterPublication.registryBindingReady, true);
assert.equal(
  readAfterPublication.measurementDefinitionKey,
  persistencePayload.measurement_definition_key
);

const incompleteWriterInput = { ...writerInput, specimen: null };
const incompleteWriterResolution = resolveMeasurementDefinition(incompleteWriterInput);
assert.equal(incompleteWriterResolution.result, "partial");
const incompletePayload = buildNormalizationResolutionPayload(
  incompleteWriterInput,
  incompleteWriterResolution
);
const incompleteRead = projectActiveRegistryV2LaboratoryBinding(
  {
    observation_kind: "lab",
    measurement_definition_key: incompletePayload.measurement_definition_key,
    resolution_status: incompletePayload.resolver_result,
  },
  {
    resolver_result: incompletePayload.resolver_result,
    measurement_definition_key: incompletePayload.measurement_definition_key,
    is_active: true,
    resolver_evidence: incompletePayload.resolver_evidence,
  }
);
assert.equal(incompleteRead.registryBindingReady, false);
assert.equal(incompleteRead.measurementDefinitionKey, null);
assert.equal(incompleteRead.resolvedMeasurementBinding, null);

const corpus = runRegistryV2CandidateCorpus();
assert.equal(corpus.report.coverage.actualRows, REQUIRED_CANDIDATE_CORPUS_ROW_COUNT);
assert.equal(corpus.report.coverage.requiredRows, REQUIRED_CANDIDATE_CORPUS_ROW_COUNT);
assert.equal(corpus.report.metrics.expectedClassificationRate, 1);
assert.equal(corpus.report.metrics.falseConcreteResolutions, 0);
assert.equal(corpus.report.metrics.processingErrors, 0);

assert.equal(
  MEASUREMENT_CATALOG_MANIFEST_RELEASE.catalogManifestVersion,
  MEASUREMENT_CATALOG_MANIFEST_VERSION
);
assert.equal(
  MEASUREMENT_CATALOG_MANIFEST_RELEASE.resolverVersion,
  MEASUREMENT_RESOLVER_VERSION
);
assert.equal(
  MEASUREMENT_CATALOG_MANIFEST_RELEASE.normalizationVersion,
  MEASUREMENT_NORMALIZATION_VERSION
);
assert.equal(
  MEASUREMENT_CATALOG_MANIFEST_RELEASE.compatibilityPolicyVersion,
  MEASUREMENT_COMPATIBILITY_POLICY_VERSION
);

const validation = validateMeasurementRegistry();
assert.equal(validation.valid, true, validation.errors.join("; "));
console.log(`verify-eh111-clinical-compatibility: ${unitCases.length} unit, ${valueKindCases.length} value-kind, ${specimenCases.length} specimen, ${corpus.report.coverage.actualRows} corpus cases passed with zero false concrete resolutions`);
