import assert from "node:assert/strict";
import { finalizeDocumentProcessing } from "../worker/src/document-completion";

async function verifyFailedJobCompletion() {
  const calls: string[] = [];
  const state = { document: "processing", job: "processing" };

  const outcome = await finalizeDocumentProcessing({
    async writeDocumentCompletion() {
      calls.push("document-completed");
      state.document = "completed";
    },
    async invalidateHealthSynthesis() {
      calls.push("synthesis-invalidated");
    },
    async writeJobCompletion() {
      calls.push("job-completion-failed");
      throw new Error("job completion write failed");
    },
    async writeFailure() {
      calls.push("failure-status-written");
      state.document = "failed";
      state.job = "failed";
    },
  });

  assert.equal(outcome, "failed");
  assert.deepEqual(calls, [
    "document-completed",
    "synthesis-invalidated",
    "job-completion-failed",
    "failure-status-written",
  ]);
  assert.deepEqual(state, { document: "failed", job: "failed" });
}

async function verifyFailedDocumentCompletion() {
  const calls: string[] = [];
  const state = { document: "processing", job: "processing" };

  const outcome = await finalizeDocumentProcessing({
    async writeDocumentCompletion() {
      calls.push("document-completion-failed");
      throw new Error("document completion write failed");
    },
    async invalidateHealthSynthesis() {
      calls.push("unexpected-synthesis-write");
    },
    async writeJobCompletion() {
      calls.push("unexpected-job-write");
    },
    async writeFailure() {
      calls.push("failure-status-written");
      state.document = "failed";
      state.job = "failed";
    },
  });

  assert.equal(outcome, "failed");
  assert.deepEqual(calls, ["document-completion-failed", "failure-status-written"]);
  assert.deepEqual(state, { document: "failed", job: "failed" });
}

async function verifySuccess() {
  const calls: string[] = [];
  const outcome = await finalizeDocumentProcessing({
    async writeDocumentCompletion() {
      calls.push("document-completed");
    },
    async invalidateHealthSynthesis() {
      calls.push("synthesis-invalidated");
    },
    async writeJobCompletion() {
      calls.push("job-completed");
    },
    async writeFailure() {
      calls.push("unexpected-failure");
    },
  });

  assert.equal(outcome, "completed");
  assert.deepEqual(calls, ["document-completed", "synthesis-invalidated", "job-completed"]);
}

async function main() {
  await verifyFailedJobCompletion();
  await verifyFailedDocumentCompletion();
  await verifySuccess();
  console.log("verify-eh105-worker-safety: all checks passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
