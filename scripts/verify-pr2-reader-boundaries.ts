import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const detailRoute = read("src/app/api/documents/[id]/route.ts");
const observationsRoute = read("src/app/api/documents/[id]/observations/route.ts");
const structured = read("src/lib/documents/structured-context.ts");
const reports = read("src/lib/reports.ts");
const pipeline = read("worker/src/pipeline.ts");
const index = read("worker/src/index.ts");
const migration037 = read(
  "supabase/migrations/037_pr2_instrumental_atomic_publication.sql"
);
const resetCli = read("scripts/eh105-pr2-reset.ts");

assert.match(detailRoute, /document_extracted_findings/);
assert.match(detailRoute, /purgeDocumentInstrumentalPublicationState/);
assert.match(observationsRoute, /isCurrentDocumentObservation/);
assert.match(structured, /document_extracted_findings/);
assert.match(reports, /document_extracted_findings/);

assert.match(pipeline, /prepare_instrumental_publication/);
assert.match(pipeline, /finalize_instrumental_publication/);
assert.doesNotMatch(pipeline, /replace_document_instrumental_observations/);
assert.match(index, /claim_document_processing_job/);

assert.match(
  migration037,
  /create view public\.document_extracted_findings[\s\S]*security_invoker = true/
);
assert.match(migration037, /drop function if exists public\.replace_document_instrumental_observations/);
assert.match(migration037, /pr2_reset_instrumental_publication_state/);

assert.match(resetCli, /EH105_PR2_DISPOSABLE/);
assert.match(resetCli, /EH105_PR2_ALLOW_RESET/);
assert.match(resetCli, /p_confirm_disposable_reset:\s*true/);

console.log("verify-pr2-reader-boundaries: all checks passed");
