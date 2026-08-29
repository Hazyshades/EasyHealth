/**
 * #111: a reviewed panel heading may supply a specimen after the stated-evidence
 * filter, and only for the analytes the policy allowlists.
 */
import assert from "node:assert/strict";
import { resolveMeasurementDefinition } from "../src/lib/biomarkers";
import {
  CBC_WHOLE_BLOOD_PANEL_POLICY,
  headingMatchesForm,
  headingVerifiedInPageText,
  matchReviewedPanelSpecimenPolicy,
  PANEL_SPECIMEN_POLICIES,
  uncoveredCapturedHeadings,
} from "../src/lib/biomarkers";
import {
  digestMeasurementRegistryManifest,
  serializeMeasurementRegistryManifest,
} from "../src/lib/biomarkers/measurement-registry-release";
import { measurementInputFromExtracted } from "../src/lib/documents/normalization-review";
import {
  measurementInputFromWriterRow,
  type ExtractedBiomarkerWriterRow,
} from "../src/lib/documents/observation-normalization-writer";

const CBC_HEADING = "Complete blood count with manual smear microscopy + ESR";

function writerRow(
  overrides: Partial<ExtractedBiomarkerWriterRow> = {},
): ExtractedBiomarkerWriterRow {
  return {
    id: "row-1",
    biomarker_key: "hemoglobin",
    biomarker_name: "Hemoglobin (HGB)",
    raw_name: "Hemoglobin (HGB)",
    value_numeric: 138,
    value_text: null,
    value_kind: "numeric",
    ordinal: null,
    unit: "g/L",
    raw_unit: "g/L",
    reference_range: "120 - 160",
    raw_reference_range: "120 - 160",
    section_context: CBC_HEADING,
    confidence: 0.9,
    specimen: "unspecified",
    modifier: "none",
    source_page: 1,
    source_text: "Hemoglobin (HGB) 138 g/L 120 - 160",
    reported_alt_value: null,
    reported_alt_unit: null,
    raw_value_text: "138",
    method: null,
    processing_version: "2026-08-28-v1",
    ...overrides,
  };
}

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    biomarker_key: "hemoglobin",
    biomarker_name: "Hemoglobin (HGB)",
    raw_name: "Hemoglobin (HGB)",
    unit: "g/L",
    raw_unit: "g/L",
    reference_range: "120 - 160",
    raw_reference_range: "120 - 160",
    raw_value_text: "138",
    value_kind: "numeric",
    section_context: CBC_HEADING,
    confidence: 0.9,
    specimen: "unspecified",
    modifier: "none",
    method: null,
    source_text: "Hemoglobin (HGB) 138 g/L 120 - 160",
    ...overrides,
  };
}

const hemoglobinInput = measurementInputFromWriterRow(writerRow());
assert.equal(hemoglobinInput.specimen, "whole_blood");
assert.equal(hemoglobinInput.specimenSource, "reviewed_panel_policy");
const hemoglobin = resolveMeasurementDefinition(hemoglobinInput);
assert.equal(hemoglobin.result, "resolved");
assert.equal(hemoglobin.measurementDefinitionKey, "hemoglobin_whole_blood");
assert.ok(
  hemoglobin.candidateEvidence.some((candidate) =>
    candidate.accepted.some((item) => item.code === "specimen_from_reviewed_panel"),
  ),
  "policy-derived specimen must appear in accepted evidence",
);
assert.ok(
  !hemoglobin.candidateEvidence.some((candidate) =>
    candidate.accepted.some((item) => item.code === "specimen_compatible"),
  ),
  "a policy-derived specimen must not also be recorded as stated",
);

const reviewHemoglobin = resolveMeasurementDefinition(measurementInputFromExtracted(reviewRow()));
assert.equal(reviewHemoglobin.measurementDefinitionKey, "hemoglobin_whole_blood");

for (const [key, name, unit] of [
  ["glucose", "Glucose", "mmol/L"],
  ["hba1c", "HbA1c", "%"],
] as const) {
  const input = measurementInputFromWriterRow(
    writerRow({
      biomarker_key: key,
      biomarker_name: name,
      raw_name: name,
      unit,
      raw_unit: unit,
      source_text: `${name} 5.1 ${unit}`,
      raw_value_text: "5.1",
      value_numeric: 5.1,
    }),
  );
  assert.notEqual(input.specimen, "whole_blood", `${key} must not inherit whole blood from a CBC heading`);
  assert.notEqual(input.specimenSource, "reviewed_panel_policy");
  const resolution = resolveMeasurementDefinition(input);
  assert.equal(resolution.result, "partial", `${key} under a CBC heading stays partial`);
  assert.ok(resolution.missingAxes.includes("specimen"), `${key} must report specimen missing`);
  assert.notEqual(resolution.measurementDefinitionKey, `${key}_whole_blood`);
}

assert.equal(
  matchReviewedPanelSpecimenPolicy("Liver chemistry", "hemoglobin"),
  null,
  "unrecognised heading yields no policy",
);
assert.equal(matchReviewedPanelSpecimenPolicy(null, "hemoglobin"), null);
assert.equal(matchReviewedPanelSpecimenPolicy(CBC_HEADING, "glucose"), null);

const statedSerum = measurementInputFromWriterRow(
  writerRow({
    specimen: "serum",
    source_text: "Hemoglobin (HGB), serum 138 g/L 120 - 160",
  }),
);
assert.equal(statedSerum.specimen, "serum");
assert.equal(statedSerum.specimenSource, "stated");
const statedResolution = resolveMeasurementDefinition(statedSerum);
assert.ok(
  statedResolution.candidateEvidence.some((candidate) =>
    candidate.accepted.some((item) => item.code === "specimen_compatible"),
  ) || statedResolution.result !== "resolved",
  "a stated specimen is not rewritten into the panel evidence code",
);

const guessedSerum = measurementInputFromWriterRow(
  writerRow({
    specimen: "serum",
    source_text: "Hemoglobin (HGB) 138 g/L 120 - 160",
  }),
);
assert.equal(guessedSerum.specimen, "whole_blood");
assert.equal(guessedSerum.specimenSource, "reviewed_panel_policy");
assert.equal(
  resolveMeasurementDefinition(guessedSerum).measurementDefinitionKey,
  "hemoglobin_whole_blood",
);

assert.ok(headingMatchesForm(CBC_HEADING, "complete blood count"));
assert.ok(headingMatchesForm("ОАК", "оак"));
assert.ok(headingVerifiedInPageText(CBC_HEADING, `Header\n${CBC_HEADING}\nHemoglobin`));
assert.equal(headingVerifiedInPageText(CBC_HEADING, "Complete blood count"), false);
assert.equal(headingVerifiedInPageText(CBC_HEADING, null), false);

const digestWith = digestMeasurementRegistryManifest();
const digestWithout = digestMeasurementRegistryManifest(undefined, undefined, []);
assert.notEqual(digestWith, digestWithout, "adding a policy must move the catalog digest");
assert.equal(
  digestMeasurementRegistryManifest(),
  digestWith,
  "unrelated serialization must be stable",
);
assert.ok(serializeMeasurementRegistryManifest().includes("cbc_whole_blood"));

assert.deepEqual(
  uncoveredCapturedHeadings([
    { heading: CBC_HEADING, count: 28 },
    { heading: "Biochemistry and inflammation", count: 16 },
  ]).map((row) => row.heading),
  ["Biochemistry and inflammation"],
);

assert.ok(!CBC_WHOLE_BLOOD_PANEL_POLICY.appliesToAnalytes.includes("glucose"));
assert.ok(!CBC_WHOLE_BLOOD_PANEL_POLICY.appliesToAnalytes.includes("hba1c"));
assert.equal(PANEL_SPECIMEN_POLICIES.length, 1);

const cbcWeightRows: Array<{ key: string; label: string; unit: string }> = [
  { key: "hemoglobin", label: "Hemoglobin (HGB)", unit: "g/L" },
  { key: "hematocrit", label: "Hematocrit (HCT)", unit: "%" },
  { key: "rbc", label: "Red blood cells (RBC)", unit: "x10^12/L" },
  { key: "wbc", label: "White blood cells (WBC)", unit: "x10^9/L" },
  { key: "platelets", label: "Platelets (PLT)", unit: "x10^9/L" },
  { key: "mcv", label: "Mean corpuscular volume (MCV)", unit: "fL" },
  { key: "mch", label: "Mean corpuscular hemoglobin (MCH)", unit: "pg" },
  { key: "mchc", label: "Mean corpuscular hemoglobin concentration (MCHC)", unit: "g/L" },
];
const belowBar: string[] = [];
for (const row of cbcWeightRows) {
  const resolution = resolveMeasurementDefinition(
    measurementInputFromWriterRow(
      writerRow({
        biomarker_key: row.key,
        biomarker_name: row.label,
        raw_name: row.label,
        unit: row.unit,
        raw_unit: row.unit,
        source_text: `${row.label} 10 ${row.unit}`,
      }),
    ),
  );
  const selected = resolution.candidateEvidence.find(
    (candidate) => candidate.candidateKey === resolution.measurementDefinitionKey,
  );
  const policyScore = selected?.accepted.find((item) => item.code === "specimen_from_reviewed_panel")?.score;
  assert.equal(policyScore, 8, `${row.key} policy weight`);
  if (resolution.result === "resolved" && (selected?.score ?? 0) < 55) {
    belowBar.push(`${row.key}:${selected?.score}`);
  }
}
assert.deepEqual(belowBar, [], `policy weight 8 must keep CBC constituents above the bar: ${belowBar.join(", ")}`);

console.log("verify-panel-specimen-policy: ok");
