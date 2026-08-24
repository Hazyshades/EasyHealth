import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  compareSnapshotRows,
  hashHealthProfileSnapshotInput,
} from "../src/lib/health-profile-snapshot-canonical";

const rows = [
  { id: "observation-b", observed_at: "2026-08-12" },
  { id: "observation-a", observed_at: "2026-08-12" },
  { id: "observation-c", observed_at: "2026-08-13" },
];

const firstOrder = [...rows].sort(compareSnapshotRows);
const secondOrder = [...rows].reverse().sort(compareSnapshotRows);
assert.deepEqual(
  firstOrder.map((row) => row.id),
  ["observation-a", "observation-b", "observation-c"],
  "equal observation timestamps are ordered by immutable ID",
);
assert.deepEqual(
  secondOrder, firstOrder, "input fetch order cannot alter canonical ordering");

const firstHash = hashHealthProfileSnapshotInput({ observations: firstOrder });
const secondHash = hashHealthProfileSnapshotInput({ observations: secondOrder });
assert.equal(firstHash, secondHash, "canonical input has a stable assessment version hash");
assert.notEqual(
  firstHash,
  hashHealthProfileSnapshotInput({ observations: [...firstOrder, { id: "observation-d", observed_at: "2026-08-14" }] }),
  "a changed observation scope produces a distinct assessment version hash",
);

const snapshotBuilder = readFileSync("src/lib/health-profile-snapshot.ts", "utf8");
const healthProfileRoute = readFileSync(
  "src/app/api/health-profile/route.ts",
  "utf8",
);
const recalculateRoute = readFileSync(
  "src/app/api/health-profile/recalculate/route.ts",
  "utf8",
);
const biomarkerRoute = readFileSync("src/app/api/biomarkers/route.ts", "utf8");
const worker = readFileSync("worker/src/index.ts", "utf8");

assert.match(
  snapshotBuilder,
  /\.sort\(compareSnapshotRows\)/,
  "the shared snapshot builder canonicalizes source ordering",
);
assert.match(
  snapshotBuilder,
  /hashHealthProfileSnapshotInput\(\{[\s\S]*?freshness_policy_version: HEALTH_PROFILE_FRESHNESS_POLICY\.version[\s\S]*?inputs,[\s\S]*?sources/,
  "the shared snapshot builder includes freshness policy identity in the canonical hash",
);
assert.match(
  healthProfileRoute,
  /order\("generated_at", \{ ascending: false \}\)[\s\S]*?maybeSingle\(\)/,
  "the Health Profile API selects the latest assessment version",
);
assert.match(
  healthProfileRoute,
  /getLatestHolisticSynthesis\(profileId\)/,
  "Health Profile reads the persisted synthesis state",
);
assert.doesNotMatch(
  healthProfileRoute,
  /forceRegenerateHolisticSynthesis|generateHolisticSynthesis/,
  "a Health Profile GET cannot generate synthesis",
);
assert.equal(
  (healthProfileRoute.match(/Cache-Control": "no-store"/g) ?? []).length >= 4,
  true,
  "Health Profile success and failure responses are not cacheable",
);
assert.equal(
  (biomarkerRoute.match(/Cache-Control": "no-store"/g) ?? []).length >= 4,
  true,
  "Biomarker success and failure responses are not cacheable",
);
assert.match(
  recalculateRoute,
  /getSessionProfileId\(\)[\s\S]*?retry_assessment_recalculation_job/,
  "manual recalculation retry is authenticated and RPC-backed",
);
assert.match(
  recalculateRoute,
  /status: "queued"/,
  "manual recalculation retry exposes queued status",
);
assert.match(
  worker,
  /claim_assessment_recalculation_job[\s\S]*?buildHealthProfileSnapshot[\s\S]*?complete_assessment_recalculation_job/,
  "the worker claims, calculates, and completes assessment jobs",
);
assert.match(
  worker,
  /complete_assessment_recalculation_job[\s\S]*?p_freshness_policy_version: snapshot\.freshnessPolicyVersion/,
  "the worker persists the snapshot freshness policy version",
);
assert.match(
  worker,
  /fail_assessment_recalculation_job[\s\S]*?p_error_code: "assessment_recalculation_failed"/,
  "assessment failures are recorded with a safe operational code",
);
assert.match(
  worker,
  /reclaim_stale_assessment_recalculation_jobs/,
  "the worker reclaims stale assessment leases before claiming work",
);

console.log("verify-eh123-assessment-recalculation: all checks passed");