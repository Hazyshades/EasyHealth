import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const writer = source("src/lib/documents/observation-normalization-writer.ts");
const acceptance = source("src/lib/documents/biomarker-acceptance.ts");
const acceptanceRoute = source("src/app/api/documents/[id]/biomarkers/accept/route.ts");
const correctionRoute = source("src/app/api/documents/[id]/biomarkers/route.ts");
const confirmationRoute = source(
  "src/app/api/documents/[id]/biomarkers/confirm-observations/route.ts"
);
const normalizationRevisions = source("src/lib/documents/normalization-revisions.ts");
const documentViewer = source("src/components/documents/document-viewer.tsx");

assert.match(
  writer,
  /\.rpc\(\s*["']write_observation_normalization_revision_v2["']/,
  "the service writer must use the atomic v2 writer RPC"
);
assert.match(
  acceptance,
  /writeExtractedBiomarkerNormalization\(/,
  "ids[] acceptance must delegate each selected row to the writer service"
);
assert.match(
  acceptanceRoute,
  /result\.failures\.length\s*\?\s*207\s*:\s*200/,
  "multi-row acceptance must report independent row failures without undoing successes"
);
assert.match(
  correctionRoute,
  /writeExtractedBiomarkerNormalization\(/,
  "manual correction must use the writer service"
);
assert.match(
  confirmationRoute,
  /writeExtractedBiomarkerNormalization\(/,
  "confirmation must use the writer service for source-backed observations"
);
assert.match(
  documentViewer,
  /payload\.failures\?\.length/,
  "document review must surface partial atomic-writer failures instead of treating HTTP 207 as a full success"
);

for (const [name, value] of [
  ["acceptance route", acceptanceRoute],
  ["correction route", correctionRoute],
  ["confirmation route", confirmationRoute],
  ["normalization revision service", normalizationRevisions],
] as const) {
  assert.doesNotMatch(
    value,
    /(?:promoteNormalizationRevision|promote_observation_normalization_revision(?:_v2)?)/,
    `${name} must not invoke a promotion RPC directly`
  );
}

assert.doesNotMatch(
  acceptance,
  /\.from\(\s*["']observations["']\s*\)/,
  "acceptance must not write observations outside the atomic writer"
);
assert.doesNotMatch(
  correctionRoute,
  /\.from\(\s*["']observations["']\s*\)/,
  "correction must not write observations outside the atomic writer"
);
assert.doesNotMatch(
  correctionRoute,
  /\.from\(\s*["']document_extracted_biomarkers["']\s*\)\s*\.update\(/,
  "correction must not update extracted-row status outside the atomic writer"
);

console.log("verify-eh106-writer-boundary: passed");
