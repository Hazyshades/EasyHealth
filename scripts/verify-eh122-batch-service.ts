import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BatchVerificationRequestError,
  batchVerificationAggregateStatus,
  prepareBatchVerificationSnapshots,
} from "../src/lib/documents/batch-verification-request";

const first = {
  extractedBiomarkerId: "00000000-0000-4000-8000-000000000122",
  sourceSnapshot: "2026-08-12T00:00:00.000Z",
  activeRevisionId: null,
};
const second = {
  extractedBiomarkerId: "00000000-0000-4000-8000-000000000123",
  sourceSnapshot: "2026-08-12T00:00:00.000Z",
  activeRevisionId: "00000000-0000-4000-8000-000000000124",
};

const ordered = prepareBatchVerificationSnapshots([first, second]);
const reversed = prepareBatchVerificationSnapshots([second, first]);
assert.deepEqual(ordered.snapshots, [first, second], "snapshots are stored in a stable identifier order");
assert.equal(ordered.requestHash, reversed.requestHash, "selection order cannot change an idempotency binding");
assert.throws(
  () => prepareBatchVerificationSnapshots([first, first]),
  (error: unknown) => error instanceof BatchVerificationRequestError,
  "a repeated result id is rejected before database work",
);
assert.throws(
  () => prepareBatchVerificationSnapshots([]),
  (error: unknown) => error instanceof BatchVerificationRequestError,
  "an empty selection is a no-request error",
);

assert.equal(batchVerificationAggregateStatus([{ outcome: "verified" }]), "completed");
assert.equal(batchVerificationAggregateStatus([{ outcome: "verified" }, { outcome: "excluded" }]), "partially_completed");
assert.equal(batchVerificationAggregateStatus([{ outcome: "failed" }]), "failed");
assert.equal(batchVerificationAggregateStatus([{ outcome: "excluded" }]), "no_op");

const service = readFileSync("src/lib/documents/batch-verification-service.ts", "utf8");
assert.match(service, /aggregate_status: "executing"/, "new batch operations start in an executing state");
const operationInsertStart = service.indexOf("  const created = await supabase");
const rowProcessingStart = service.indexOf("  const rowResult = await supabase", operationInsertStart);
assert.ok(operationInsertStart >= 0, "batch operation initialization must be present");
assert.ok(rowProcessingStart > operationInsertStart, "row processing must follow operation initialization");
const initializationBlock = service.slice(operationInsertStart, rowProcessingStart);
assert.match(
  initializationBlock,
  /aggregate_status: "executing"/,
  "a new operation records executing status before row processing",
);
assert.match(
  initializationBlock,
  /if \(created\.error \|\| !created\.data\)[\s\S]*?throw new BatchVerificationError/,
  "operation initialization failure must throw before row processing",
);
assert.doesNotMatch(
  initializationBlock,
  /document_extracted_biomarkers|writeExtractedBiomarkerNormalization|batch_verification_operation_rows/,
  "initialization failure path must not mutate verification rows",
);
assert.match(service, /existing\.data\.request_hash !== hash/, "a reused operation id rejects a conflicting selection");
assert.match(service, /evaluateBatchVerificationEligibility/, "execution re-evaluates server-side eligibility rather than trusting the client");
assert.match(service, /record_status,/, "batch reads the source lifecycle state");
assert.match(service, /recordStatus: row\.record_status/, "batch policy receives the source lifecycle state");
assert.match(service, /record_status !== "active"/, "batch reversal refuses terminal source records");
assert.match(service, /writeKind: "acceptance"/, "batch verification uses the canonical acceptance writer");
assert.match(service, /activeRevision\?\.id !== row\.resulting_revision_id/, "undo excludes rows changed after the original batch");
assert.match(service, /writeKind: "verification_reversal"/, "undo uses the canonical append-only writer transition");

for (const routePath of [
  "src/app/api/documents/[id]/biomarkers/batch-verification/route.ts",
  "src/app/api/documents/[id]/biomarkers/batch-verification/reverse/route.ts",
]) {
  const route = readFileSync(routePath, "utf8");
  assert.match(route, /getSessionProfileId/, `${routePath} requires authentication`);
  assert.match(route, /assertDocumentOwner/, `${routePath} scopes work to the owning document`);
  assert.match(route, /noStoreJson/, `${routePath} prevents cached mutation responses`);
}

console.log("verify-eh122-batch-service: all checks passed");
