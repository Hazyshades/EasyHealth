import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");
const pipeline = source("worker/src/pipeline.ts");
const extraction = source("src/lib/documents/extraction.ts");
const biomarkerRoute = source("src/app/api/documents/[id]/biomarkers/route.ts");
const observationsRoute = source("src/app/api/documents/[id]/observations/route.ts");
const acceptanceService = source("src/lib/documents/biomarker-acceptance.ts");
const confirmRoute = source("src/app/api/documents/[id]/biomarkers/confirm-observations/route.ts");
const reprocessCommand = source("scripts/reprocess-batch.ts");
const reprocessService = source("src/lib/registry-reprocessing/service.ts");

const pipelineInsert = pipeline.search(/from\("document_extracted_biomarkers"\)\s*\.insert\(/);
assert.notEqual(pipelineInsert, -1, "initial laboratory extraction must insert source-linked extracted rows");
const pipelineMappedRows = pipeline.slice(pipelineInsert, pipeline.indexOf("const summaryModel", pipelineInsert));
assert.match(pipelineMappedRows, /mapPipelineBiomarkerEvidence\(/);
assert.match(extraction, /raw_name: biomarker\.raw_name/);
assert.match(extraction, /raw_value_text: biomarker\.value_text/);
assert.match(extraction, /raw_unit: biomarker\.unit/);
assert.match(extraction, /source_page: provenance\.page/);
assert.match(extraction, /source_text: biomarker\.source_text/);
assert.match(pipelineMappedRows, /status: "needs_review"/);
assert.doesNotMatch(
  pipelineMappedRows,
  /writeExtractedBiomarkerNormalization|write_observation_normalization_revision_v2/,
  "initial extraction must not normalize or write an observation",
);

const reviewGet = biomarkerRoute.slice(
  biomarkerRoute.indexOf("export async function GET"),
  biomarkerRoute.indexOf("export async function PATCH"),
);
assert.match(reviewGet, /buildNormalizationReview\(/, "review GET must create a non-persistent normalization preview");
assert.doesNotMatch(reviewGet, /\.insert\(|\.update\(|writeExtractedBiomarkerNormalization/, "review GET must not persist its preview");
assert.match(observationsRoute, /serializeLaboratoryOutcome\(/, "observation GET must serialize persisted laboratory outcomes");
assert.match(observationsRoute, /normalization_revision:observation_normalization_revisions/, "observation GET must read the persisted revision relation");
assert.match(observationsRoute, /\.eq\("document_id", id\)/, "document type remains scoped by the joined document record, not a laboratory row field");

for (const [name, value] of [
  ["acceptance", acceptanceService],
  ["correction", biomarkerRoute.slice(biomarkerRoute.indexOf("export async function PATCH"))],
  ["confirmation", confirmRoute],
  ["Registry batch reprocessing", reprocessService],
] as const) {
  assert.match(value, /writeExtractedBiomarkerNormalization/, `${name} must use the sole normalization writer boundary`);
}
assert.match(reprocessCommand, /applyReprocessBatch/, "the CLI may reach reprocessing only through its service boundary");
assert.equal(existsSync("src/app/api/registry"), false, "no HTTP Registry-batch administration endpoint may exist");

console.log("verify-laboratory-persistence-boundaries: all checks passed");
