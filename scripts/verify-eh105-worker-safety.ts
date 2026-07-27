import assert from "node:assert/strict";
import { finalizeDocumentProcessing } from "../worker/src/document-completion";

// PR2: non-instrumental completion is one guarded database transaction
// (complete_document_processing_attempt). A completion failure must route
// through the guarded failure transition; success performs no extra writes.

async function verifyFailedCompletion() {
  const calls: string[] = [];
  const state = { document: "processing", job: "processing" };

  const outcome = await finalizeDocumentProcessing({
    async complete() {
      calls.push("completion-failed");
      throw new Error("completion transaction failed");
    },
    async writeFailure() {
      calls.push("failure-status-written");
      state.document = "failed";
      state.job = "failed";
    },
  });

  assert.equal(outcome, "failed");
  assert.deepEqual(calls, ["completion-failed", "failure-status-written"]);
  assert.deepEqual(state, { document: "failed", job: "failed" });
}

async function verifySuccess() {
  const calls: string[] = [];
  const outcome = await finalizeDocumentProcessing({
    async complete() {
      calls.push("completed");
    },
    async writeFailure() {
      calls.push("unexpected-failure");
    },
  });

  assert.equal(outcome, "completed");
  assert.deepEqual(calls, ["completed"]);
}

async function verifyFailureWriteErrorPropagates() {
  await assert.rejects(
    finalizeDocumentProcessing({
      async complete() {
        throw new Error("completion transaction failed");
      },
      async writeFailure() {
        throw new Error("failure transition also failed");
      },
    }),
    /failure transition also failed/
  );
}

async function main() {
  await verifyFailedCompletion();
  await verifySuccess();
  await verifyFailureWriteErrorPropagates();
  console.log("verify-eh105-worker-safety: all checks passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
