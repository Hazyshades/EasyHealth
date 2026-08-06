/**
 * #106: an axis the document never states must not behave as stated evidence.
 *
 * `analyte-measurement-model` already requires that unknown information "MUST
 * NOT behave as positive compatibility evidence", and the resolver honours it —
 * 43 of 52 launch-corpus rows carry no specimen and all expect `partial`. The
 * rule breaks one layer earlier: the extraction model supplies a specimen the
 * report never printed, and by the time the resolver sees the row the axis looks
 * stated. `specimen_compatible` is awarded, the axis leaves `missingAxes`, and
 * because admissibility requires an empty missing-axis set, the fabricated value
 * is precisely what unlocks `resolved`.
 *
 * These checks pin the boundary: an axis value is stated only when its lexical
 * form occurs in provenance already captured for that row — its own
 * `source_text`, or the `section_context` it was printed under.
 */
import assert from "node:assert/strict";
import { resolveMeasurementDefinition } from "../src/lib/biomarkers";
import type { MeasurementResolution } from "../src/lib/biomarkers";
import { measurementInputFromExtracted } from "../src/lib/documents/normalization-review";
import {
  measurementInputFromWriterRow,
  type ExtractedBiomarkerWriterRow,
} from "../src/lib/documents/observation-normalization-writer";
import {
  auditUnstatedAxes,
  isAxisStated,
  statedAxisValue,
} from "../src/lib/documents/stated-axis-evidence";

function writerRow(
  overrides: Partial<ExtractedBiomarkerWriterRow> = {},
): ExtractedBiomarkerWriterRow {
  return {
    id: "row-1",
    biomarker_key: "alt",
    biomarker_name: "ALT (alanine aminotransferase)",
    raw_name: "ALT (alanine aminotransferase)",
    value_numeric: 28,
    value_text: null,
    value_kind: "numeric",
    ordinal: null,
    unit: "U/L",
    raw_unit: "U/L",
    reference_range: "2 - 41",
    raw_reference_range: "2 - 41",
    section_context: "Biochemistry and inflammation",
    confidence: 0.9,
    specimen: "serum",
    modifier: "none",
    source_page: 1,
    source_text: "ALT (alanine aminotransferase) 28 U/L 2 - 41",
    reported_alt_value: null,
    reported_alt_unit: null,
    raw_value_text: "28",
    method: null,
    processing_version: "2026-06-30-v1",
    ...overrides,
  };
}

/** The review-preview builder takes a narrower row shape. */
function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    biomarker_key: "alt",
    biomarker_name: "ALT (alanine aminotransferase)",
    raw_name: "ALT (alanine aminotransferase)",
    unit: "U/L",
    raw_unit: "U/L",
    reference_range: "2 - 41",
    raw_reference_range: "2 - 41",
    raw_value_text: "28",
    value_kind: "numeric",
    section_context: "Biochemistry and inflammation",
    confidence: 0.9,
    specimen: "serum",
    modifier: "none",
    method: null,
    source_text: "ALT (alanine aminotransferase) 28 U/L 2 - 41",
    ...overrides,
  };
}

function resolutionOf(input: Parameters<typeof resolveMeasurementDefinition>[0]): MeasurementResolution {
  return resolveMeasurementDefinition(input);
}

// --- 1. The reported defect, through the writer path ------------------------

const fabricatedWriterInput = measurementInputFromWriterRow(writerRow());
assert.equal(
  fabricatedWriterInput.specimen,
  null,
  "a specimen absent from source_text and section_context must not reach the resolver",
);

const fabricatedWriterResolution = resolutionOf(fabricatedWriterInput);
assert.equal(
  fabricatedWriterResolution.result,
  "partial",
  "an unstated specimen must not unlock a concrete resolution",
);
assert.ok(
  fabricatedWriterResolution.missingAxes.includes("specimen"),
  "the specimen axis must be reported as missing",
);
assert.equal(
  fabricatedWriterResolution.measurementDefinitionKey,
  null,
  "no concrete measurement key may be selected without stated specimen evidence",
);

// --- 2. The same defect through the review-preview path ---------------------

const fabricatedReviewInput = measurementInputFromExtracted(reviewRow());
assert.equal(
  fabricatedReviewInput.specimen,
  null,
  "the review preview must apply the same stated-evidence policy as the writer",
);
assert.equal(resolutionOf(fabricatedReviewInput).result, "partial");

// --- 3. A specimen stated in the row's own snippet survives -----------------

const statedInSnippet = measurementInputFromWriterRow(
  writerRow({
    source_text: "ALT (alanine aminotransferase), serum 28 U/L 2 - 41",
  }),
);
assert.equal(
  statedInSnippet.specimen,
  "serum",
  "a specimen printed in the row's own snippet is stated evidence",
);
assert.equal(resolutionOf(statedInSnippet).result, "resolved");
assert.equal(
  resolutionOf(statedInSnippet).measurementDefinitionKey,
  "alt_serum_catalytic_activity",
);

// --- 4. A specimen stated only by section context survives -----------------

const statedInSection = measurementInputFromWriterRow(
  writerRow({ section_context: "Serum chemistry" }),
);
assert.equal(
  statedInSection.specimen,
  "serum",
  "a specimen stated by the section heading is stated evidence",
);
assert.equal(resolutionOf(statedInSection).result, "resolved");

// --- 5. Modifiers derived from the printed label must survive ---------------
//
// These are the axes the extractor derives from wording that IS in the label,
// so the stated-evidence policy must leave them alone.

const absoluteRow = measurementInputFromWriterRow(
  writerRow({
    biomarker_key: "neutrophils_abs",
    biomarker_name: "Neutrophils, absolute (NEU)",
    raw_name: "Neutrophils, absolute (NEU)",
    unit: "x10^9/L",
    raw_unit: "x10^9/L",
    value_numeric: 3.55,
    raw_value_text: "3.55",
    reference_range: "1.56 - 6.13",
    raw_reference_range: "1.56 - 6.13",
    specimen: "whole_blood",
    modifier: "absolute",
    section_context: "Complete blood count with manual smear microscopy + ESR",
    source_text: "Neutrophils, absolute (NEU) 3.55 x10^9/L 1.56 - 6.13",
  }),
);
assert.equal(
  absoluteRow.modifier,
  "absolute",
  "a modifier printed in the label is stated evidence and must survive",
);
assert.equal(
  absoluteRow.specimen,
  null,
  "`Complete blood count` does not contain whole-blood wording, so the specimen is not stated",
);

const directRow = measurementInputFromWriterRow(
  writerRow({
    biomarker_key: "direct_bilirubin",
    biomarker_name: "Direct bilirubin",
    raw_name: "Direct bilirubin",
    unit: "umol/L",
    raw_unit: "umol/L",
    value_numeric: 5.7,
    raw_value_text: "5.7",
    modifier: "direct",
    source_text: "Direct bilirubin 5.7 umol/L 0 - 8.7",
  }),
);
assert.equal(directRow.modifier, "direct");

// --- 6. Method keeps the behaviour EH-113 already guarantees ----------------

const statedMethod = measurementInputFromWriterRow(
  writerRow({
    biomarker_key: "neutrophils_percent",
    biomarker_name: "Neutrophils (NEU%)",
    raw_name: "Neutrophils (NEU%)",
    unit: "%",
    raw_unit: "%",
    value_numeric: 62.6,
    raw_value_text: "62.6",
    modifier: "percent",
    method: "automated",
    source_text: "Neutrophils (NEU%) automated 62.6 % 34 - 72",
  }),
);
assert.equal(
  statedMethod.method,
  "automated",
  "a method printed in the snippet is stated evidence",
);

const fabricatedMethod = measurementInputFromWriterRow(
  writerRow({ method: "manual" }),
);
assert.equal(
  fabricatedMethod.method,
  null,
  "a method absent from provenance must not reach the resolver",
);

// --- 7. Unknown/default axis values are untouched ---------------------------

const unspecifiedRow = measurementInputFromWriterRow(
  writerRow({ specimen: "unspecified", modifier: "none", method: null }),
);
assert.equal(unspecifiedRow.specimen, "unspecified");
assert.equal(unspecifiedRow.modifier, "none");
assert.equal(unspecifiedRow.method, null);

// --- 8. The predicate directly -----------------------------------------------

const chemistrySection = { sectionContext: "Biochemistry and inflammation" };

assert.equal(isAxisStated("specimen", "serum", chemistrySection), false);
assert.equal(isAxisStated("specimen", "serum", { sectionContext: "Serum chemistry" }), true);
assert.equal(isAxisStated("specimen", "serum", { sourceText: "ALT, serum 28 U/L" }), true);
assert.equal(
  isAxisStated("specimen", "whole_blood", { sectionContext: "Complete blood count" }),
  false,
  "`Complete blood count` does not lexically state whole blood",
);

// A punctuation-only value normalizes to "", and `includes("")` is true for
// every haystack. Real uploads store `modifier: "<"` from censored results
// such as `CRP < 0.20 mg/L`, so this hole was reachable from live data.
assert.equal(
  isAxisStated("modifier", "<", { sourceText: "C-reactive protein, quantitative < 0.20 mg/L" }),
  false,
  "a punctuation-only axis value can never be lexically evidenced",
);
assert.equal(
  isAxisStated("modifier", "less than", { sourceText: "C-reactive protein, quantitative < 0.20 mg/L" }),
  false,
  "the comparator spelled out is still not printed by the document",
);

// Hyphen, underscore and space are the same separator, as `snakeCaseToken`
// treats them. `Post-prandial` states `post_prandial`.
assert.equal(
  isAxisStated("modifier", "post_prandial", { label: "Post-prandial glucose" }),
  true,
  "a hyphen in the printed label states an underscored axis value",
);
assert.equal(
  isAxisStated("specimen", "whole_blood", { sourceText: "Haemoglobin, whole-blood 140 g/L" }),
  true,
  "a hyphenated specimen in the document states the stored key",
);
assert.equal(
  isAxisStated("specimen", "whole_blood", { sourceText: "Hemoglobin, whole blood 156 g/L" }),
  true,
);
assert.equal(
  isAxisStated("specimen", "serum", { sourceText: "АЛТ, сыворотка 28 Ед/л" }),
  true,
  "the Cyrillic stem already recognised by inferSpecimen must count as stated",
);

// Unknown/default values assert nothing, so there is nothing to strip.
for (const unknown of ["unspecified", "none", "unknown", "", "  "]) {
  assert.equal(
    isAxisStated("specimen", unknown, chemistrySection),
    true,
    `${JSON.stringify(unknown)} asserts nothing and must pass through`,
  );
}
assert.equal(isAxisStated("method", null, chemistrySection), true);
assert.equal(isAxisStated("method", undefined, chemistrySection), true);

// A row with no captured provenance at all cannot state anything.
assert.equal(isAxisStated("specimen", "serum", {}), false);
assert.equal(isAxisStated("specimen", "serum", { sourceText: null, sectionContext: null }), false);

assert.equal(statedAxisValue("specimen", "serum", chemistrySection), null);
assert.equal(statedAxisValue("specimen", "serum", { sectionContext: "Serum chemistry" }), "serum");

// --- 9. The document auditor (the static gate) -------------------------------

const auditRows = [
  {
    id: "r1",
    biomarker_name: "ALT (alanine aminotransferase)",
    raw_name: "ALT (alanine aminotransferase)",
    section_context: "Biochemistry and inflammation",
    source_text: "ALT (alanine aminotransferase) 28 U/L 2 - 41",
    specimen: "serum",
    modifier: "none",
    method: null,
  },
  {
    id: "r2",
    biomarker_name: "Hemoglobin (HGB)",
    raw_name: "Hemoglobin (HGB)",
    section_context: "Complete blood count with manual smear microscopy + ESR",
    source_text: "Hemoglobin (HGB) 156 g/L 132 - 166",
    specimen: "whole_blood",
    modifier: "none",
    method: null,
  },
  {
    id: "r3",
    biomarker_name: "Glucose",
    raw_name: "Glucose",
    section_context: "Serum chemistry",
    source_text: "Glucose 4.1 mmol/L 3.05 - 6.1",
    specimen: "serum",
    modifier: "none",
    method: null,
  },
  {
    id: "r4",
    biomarker_name: "Neutrophils, absolute (NEU)",
    raw_name: "Neutrophils, absolute (NEU)",
    section_context: "Complete blood count",
    source_text: "Neutrophils, absolute (NEU) 3.55 x10^9/L",
    specimen: "unspecified",
    modifier: "absolute",
    method: null,
  },
];

const findings = auditUnstatedAxes(auditRows);
assert.deepEqual(
  findings.map((finding) => finding.rowId).sort(),
  ["r1", "r2"],
  "only rows whose concrete axis is unevidenced may be reported",
);
assert.deepEqual(findings.find((f) => f.rowId === "r1")!.inferences, [
  { axis: "specimen", discarded: "serum" },
]);
assert.deepEqual(
  auditUnstatedAxes([auditRows[2]!, auditRows[3]!]),
  [],
  "a section-stated specimen and a label-stated modifier are clean",
);
assert.deepEqual(auditUnstatedAxes([]), []);

console.log("verify-stated-axis-evidence: all checks passed");
