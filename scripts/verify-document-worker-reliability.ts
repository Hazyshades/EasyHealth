import assert from "node:assert/strict";
import {
  reclaimStaleJobs,
  type ReclaimableJob,
} from "../worker/src/job-reliability";
import {
  resolveModelCapabilities,
  temperatureForModel,
} from "../src/lib/ai/model-capabilities";
import { isWorkerOffline } from "../src/lib/documents/worker-health";

async function main() {
const staleJobs: ReclaimableJob[] = [
  {
    id: "retry-job",
    document_id: "document-a",
    profile_id: "profile-a",
    attempts: 1,
    max_attempts: 3,
    started_at: "2026-07-17T10:00:00.000Z",
  },
  {
    id: "failed-job",
    document_id: "document-b",
    profile_id: "profile-b",
    attempts: 3,
    max_attempts: 3,
    started_at: "2026-07-17T10:00:00.000Z",
  },
];
const requeued: string[] = [];
const failed: string[] = [];
let observedCutoff = "";

const summary = await reclaimStaleJobs(
  {
    async list(cutoffIso) {
      observedCutoff = cutoffIso;
      return staleJobs;
    },
    async requeue(job) {
      requeued.push(job.id);
    },
    async fail(job) {
      failed.push(job.id);
    },
  },
  {
    now: new Date("2026-07-17T10:10:00.000Z"),
    staleAfterMs: 10 * 60_000,
  },
);

assert.equal(observedCutoff, "2026-07-17T10:00:00.000Z");
assert.deepEqual(summary, { requeued: 1, failed: 1 });
assert.deepEqual(requeued, ["retry-job"]);
assert.deepEqual(failed, ["failed-job"]);

assert.equal(
  resolveModelCapabilities("deepseek", "deepseek-reasoner")
    .supportsTemperature,
  false,
);
assert.equal(
  resolveModelCapabilities("nebius_quality", "deepseek-ai/DeepSeek-V4-Pro")
    .supportsTemperature,
  false,
);
assert.equal(
  resolveModelCapabilities("nebius_fast", "meta-llama/Llama-3.3-70B-Instruct")
    .supportsTemperature,
  true,
);
assert.equal(temperatureForModel("deepseek", "deepseek-reasoner", 0), undefined);
assert.equal(
  temperatureForModel("openai", "gpt-4o-mini", 0.3),
  0.3,
);

const now = Date.parse("2026-07-17T10:00:20.000Z");
assert.equal(
  isWorkerOffline("2026-07-17T10:00:05.000Z", now, 20_000),
  false,
);
assert.equal(
  isWorkerOffline("2026-07-17T09:59:59.000Z", now, 20_000),
  true,
);
assert.equal(isWorkerOffline(null, now, 20_000), true);

console.log("verify-document-worker-reliability: all checks passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
