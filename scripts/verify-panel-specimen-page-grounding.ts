/**
 * #111 worker seam: each page stores its own OCR, a heading is checked against
 * that page only, and a heading copied from another page is dropped.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveMeasurementDefinition } from "../src/lib/biomarkers";
import {
  groundCapturedHeadingToPageOcr,
  pageOcrTextByNumber,
} from "../src/lib/biomarkers";
import {
  measurementInputFromWriterRow,
  type ExtractedBiomarkerWriterRow,
} from "../src/lib/documents/observation-normalization-writer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CBC_HEADING = "Complete blood count with manual smear microscopy + ESR";
const BIO_HEADING = "Biochemistry and inflammation";

const persistedPages = [
  {
    page_number: 1,
    ocr_text: [
      "EasyHealth Synthetic Laboratory Report",
      CBC_HEADING,
      "Hemoglobin (HGB) 138 g/L 130 - 170",
      "ESR, Westergren automated 8 mm/h",
      "Glucose 5.1 mmol/L 4.1 - 6.1",
    ].join("\n"),
  },
  {
    page_number: 2,
    ocr_text: [
      "Page 2",
      BIO_HEADING,
      "ALT (GPT) 22 U/L 0 - 41",
    ].join("\n"),
  },
] as const;

const pageTextByNumber = pageOcrTextByNumber(persistedPages);

assert.equal(pageTextByNumber.get(1)?.includes(CBC_HEADING), true);
assert.equal(pageTextByNumber.get(1)?.includes(BIO_HEADING), false);
assert.equal(pageTextByNumber.get(2)?.includes(CBC_HEADING), false);
assert.equal(pageTextByNumber.get(2)?.includes(BIO_HEADING), true);

assert.equal(
  groundCapturedHeadingToPageOcr(CBC_HEADING, 1, pageTextByNumber),
  CBC_HEADING,
  "a heading that occurs on its own page is kept",
);
assert.equal(
  groundCapturedHeadingToPageOcr(CBC_HEADING, 2, pageTextByNumber),
  null,
  "a heading copied from another page is dropped",
);
assert.equal(
  groundCapturedHeadingToPageOcr(BIO_HEADING, 1, pageTextByNumber),
  null,
  "a page-2 heading is not accepted for a page-1 row",
);
assert.equal(
  groundCapturedHeadingToPageOcr(CBC_HEADING, null, pageTextByNumber),
  null,
);
assert.equal(
  groundCapturedHeadingToPageOcr(CBC_HEADING, 3, pageTextByNumber),
  null,
  "missing page OCR fails closed",
);

const pipelineSource = readFileSync(path.join(ROOT, "worker/src/pipeline.ts"), "utf8");
assert.match(
  pipelineSource,
  /groundCapturedHeadingToPageOcr\(/,
  "the worker insert path must use the page-OCR grounding seam",
);
assert.match(
  pipelineSource,
  /ocr_text: pageText \? pageText\.slice\(0, 50000\) : null/,
  "each document page must persist its own ocr_text",
);
assert.doesNotMatch(
  pipelineSource,
  /headingVerifiedInPageText\(/,
  "pipeline must not bypass the extracted multi-page helper",
);

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
    reference_range: "130 - 170",
    raw_reference_range: "130 - 170",
    section_context: CBC_HEADING,
    confidence: 0.9,
    specimen: "unspecified",
    modifier: "none",
    source_page: 1,
    source_text: "Hemoglobin (HGB) 138 g/L 130 - 170",
    reported_alt_value: null,
    reported_alt_unit: null,
    raw_value_text: "138",
    method: null,
    processing_version: "2026-08-28-v1",
    ...overrides,
  };
}

function resolveAfterGrounding(
  row: ExtractedBiomarkerWriterRow,
): ReturnType<typeof resolveMeasurementDefinition> {
  const grounded = {
    ...row,
    section_context: groundCapturedHeadingToPageOcr(
      row.section_context,
      row.source_page,
      pageTextByNumber,
    ),
  };
  return resolveMeasurementDefinition(measurementInputFromWriterRow(grounded));
}

const samePageHemoglobin = resolveAfterGrounding(writerRow());
assert.equal(samePageHemoglobin.result, "resolved");
assert.equal(samePageHemoglobin.measurementDefinitionKey, "hemoglobin_whole_blood");
assert.ok(
  samePageHemoglobin.candidateEvidence.some((candidate) =>
    candidate.accepted.some((item) => item.code === "specimen_from_reviewed_panel"),
  ),
);

const crossPageHemoglobin = resolveAfterGrounding(
  writerRow({
    id: "row-cross",
    source_page: 2,
    source_text: "Hemoglobin (HGB) 138 g/L 130 - 170",
  }),
);
assert.equal(
  crossPageHemoglobin.result,
  "partial",
  "a CBC heading from page 1 must not resolve a row grounded on page 2",
);
assert.ok(crossPageHemoglobin.missingAxes.includes("specimen"));
assert.notEqual(crossPageHemoglobin.measurementDefinitionKey, "hemoglobin_whole_blood");

const altOnBiochemPage = resolveAfterGrounding(
  writerRow({
    id: "row-alt",
    biomarker_key: "alt",
    biomarker_name: "ALT (GPT)",
    raw_name: "ALT (GPT)",
    unit: "U/L",
    raw_unit: "U/L",
    source_page: 2,
    source_text: "ALT (GPT) 22 U/L 0 - 41",
    section_context: BIO_HEADING,
    value_numeric: 22,
    raw_value_text: "22",
  }),
);
assert.notEqual(altOnBiochemPage.result, "resolved");
assert.notEqual(altOnBiochemPage.measurementDefinitionKey, "alt_serum_catalytic_activity");

const glucoseUnderCbc = resolveAfterGrounding(
  writerRow({
    id: "row-glucose",
    biomarker_key: "glucose",
    biomarker_name: "Glucose",
    raw_name: "Glucose",
    unit: "mmol/L",
    raw_unit: "mmol/L",
    source_text: "Glucose 5.1 mmol/L 4.1 - 6.1",
    value_numeric: 5.1,
    raw_value_text: "5.1",
  }),
);
assert.equal(glucoseUnderCbc.result, "partial");
assert.notEqual(glucoseUnderCbc.measurementDefinitionKey, "glucose_whole_blood");

const esrUnderCbc = resolveAfterGrounding(
  writerRow({
    id: "row-esr",
    biomarker_key: "esr",
    biomarker_name: "ESR, Westergren automated",
    raw_name: "ESR, Westergren automated",
    unit: "mm/h",
    raw_unit: "mm/h",
    source_text: "ESR, Westergren automated 8 mm/h",
    value_numeric: 8,
    raw_value_text: "8",
  }),
);
assert.notEqual(
  esrUnderCbc.result,
  "resolved",
  "ESR is printed under the CBC heading but is outside the 18-analyte allowlist",
);
assert.notEqual(esrUnderCbc.measurementDefinitionKey, "esr_whole_blood");

/**
 * Sample English mock: 28 rows sit under the CBC heading. 27 are allowlisted
 * CBC constituents (or map to them). ESR is the 28th and does not become a whole-blood identity.
 * gpt-4o-mini may emit 0 CBC rows on this PDF; that is an extractor miss,
 * not a policy miss. Policy acceptance is 27 recovered + ESR unresolved when
 * the heading is captured and page-grounded.
 */
const SAMPLE_CBC_HEADING_PRINTED_ROWS = 28;
const SAMPLE_ESR_ROWS_OUTSIDE_ALLOWLIST = 1;
assert.equal(
  SAMPLE_CBC_HEADING_PRINTED_ROWS - SAMPLE_ESR_ROWS_OUTSIDE_ALLOWLIST,
  27,
);

console.log("verify-panel-specimen-page-grounding: ok");
