import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CBC_MEASUREMENT_REGRESSION_FIXTURES,
  CBC_REGRESSION_FAMILIES,
  runCbcMeasurementRegressionSuite,
} from "../src/lib/biomarkers";

const first = runCbcMeasurementRegressionSuite();
const second = runCbcMeasurementRegressionSuite();

assert.deepEqual(
  [...first.missingFamilies],
  [],
  `CBC checklist families missing fixtures: ${first.missingFamilies.join(", ")}`
);
assert.equal(
  first.failed,
  0,
  first.failures.map((failure) => `${failure.id}: ${failure.reason}`).join("\n") || "CBC fixtures failed"
);
assert.equal(first.passed, first.total, "every CBC fixture must pass");
assert.equal(first.total, CBC_MEASUREMENT_REGRESSION_FIXTURES.length);
assert.deepEqual([...first.familiesCovered], [...CBC_REGRESSION_FAMILIES]);

assert.deepEqual(
  first.rows.map((row) => ({
    id: row.id,
    classification: row.actualClassification,
    key: row.actualKey,
  })),
  second.rows.map((row) => ({
    id: row.id,
    classification: row.actualClassification,
    key: row.actualKey,
  })),
  "CBC regression suite must be deterministic"
);

assert.ok(
  first.rows.some((row) => row.id === "red-hgb-sample" && row.actualClassification === "partial"),
  "exact Hemoglobin (HGB) sample form must remain represented"
);
assert.ok(
  first.rows.some((row) => row.id === "diff-neu-percent-sample"),
  "exact NEU% sample form must remain represented"
);
assert.ok(
  first.rows.some((row) => row.id === "diff-lymph-manual-sample"),
  "manual differential sample form must remain represented"
);
assert.ok(
  first.rows.some((row) => row.family === "reticulocytes"),
  "synthetic reticulocyte fixtures are required"
);
assert.ok(
  first.rows.some((row) => row.id === "rdw-cv-resolved" && row.actualKey === "rdw_cv"),
  "RDW-CV synthetic positive fixture is required"
);

const moduleSource = readFileSync("src/lib/biomarkers/cbc-measurement-regression.ts", "utf8");
const runnerSource = readFileSync("scripts/verify-cbc-measurement-regression-runner.ts", "utf8");
assert.doesNotMatch(
  moduleSource,
  /from\s+["'][^"']*(?:biomarker-acceptance|normalization-revisions|normalization-writer|supabase)[^"']*["']/,
  "cbc-measurement-regression module must not import a runtime writer"
);
assert.doesNotMatch(
  runnerSource,
  /from\s+["'][^"']*(?:biomarker-acceptance|normalization-revisions|normalization-writer|supabase)[^"']*["']/,
  "cbc regression runner must not import a runtime writer"
);
assert.doesNotMatch(
  moduleSource,
  /\b(?:createClient|promote_observation|acceptSelected|writeFileSync|mkdirSync)\b/,
  "cbc-measurement-regression module must not mutate runtime or release evidence"
);

const familyEvidence = Object.fromEntries(
  CBC_REGRESSION_FAMILIES.map((family) => [
    family,
    first.rows.filter((row) => row.family === family && row.passed).map((row) => row.id),
  ])
);
for (const family of CBC_REGRESSION_FAMILIES) {
  assert.ok((familyEvidence[family] ?? []).length > 0, `family ${family} needs a passing fixture`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      total: first.total,
      passed: first.passed,
      families: familyEvidence,
    },
    null,
    2
  )
);
console.log("verify-cbc-measurement-regression: all checks passed");
