import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inspect } from "node:util";
import {
  EH147_PACK_VERSION,
  canonicalPackPayload,
  evaluateGoldenCase,
  listGoldenCases,
  packHash,
  type AdmissionExpectation,
  type GoldenCase,
  type ProfileExpectation,
} from "./eh147-golden-pack";
import { HEALTH_PROFILE_SCORE_ALGORITHM_VERSION } from "../src/lib/health-systems";

const ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "QA", "eh-147", "fixtures");
const EXPECTED_PATH = path.join(FIXTURE_DIR, "expected.json");
const PACK_PATH = path.join(FIXTURE_DIR, "pack.json");
const APPROVALS_PATH = path.join(ROOT, "QA", "eh-147", "approvals.json");

type ExpectedFile = {
  packVersion: string;
  algorithmVersion: string;
  cases: Record<string, ProfileExpectation | AdmissionExpectation>;
};

type ApprovalFile = {
  packVersion: string;
  packHash: string | null;
  approvals: Array<{
    role: string;
    status: "approved" | "pending";
    packHash: string;
    approvedAt: string | null;
    note: string;
  }>;
};

const args = new Set(process.argv.slice(2));
const writeExpected = args.has("--write-expected");
const technicalOnly = args.has("--technical-check") || (!args.has("--check") && !writeExpected);
const productCheck = args.has("--check");
const writeReport = args.has("--report");

function readExpected(): ExpectedFile {
  return JSON.parse(readFileSync(EXPECTED_PATH, "utf8")) as ExpectedFile;
}

function isProfileExpectation(
  value: ProfileExpectation | AdmissionExpectation,
): value is ProfileExpectation {
  return "systems" in value;
}

function assertInvariants(goldenCase: GoldenCase, actual: ProfileExpectation | AdmissionExpectation) {
  if (goldenCase.id === "complete-in-range-eight-systems" && isProfileExpectation(actual)) {
    for (const system of [
      "cardiovascular",
      "metabolic",
      "thyroid",
      "liver",
      "kidney",
      "blood",
      "nutrients",
    ]) {
      assert.equal(actual.systems[system]?.scoreability, "scoreable", `${system} must be scoreable`);
      assert.notEqual(actual.systems[system]?.state_score, null, `${system} must have a score`);
    }
    assert.equal(actual.systems.inflammation?.scoreability, "non_scoreable");
    assert.equal(actual.systems.inflammation?.state_score, null);
  }

  if (goldenCase.id === "complete-out-of-range-eight-systems" && isProfileExpectation(actual)) {
    const inRange = readExpected().cases["complete-in-range-eight-systems"];
    if (!isProfileExpectation(inRange)) throw new Error("in-range expected missing");
    for (const system of Object.keys(actual.systems)) {
      if (system === "inflammation") continue;
      const outScore = actual.systems[system]?.state_score;
      const inScore = inRange.systems[system]?.state_score;
      if (typeof outScore === "number" && typeof inScore === "number") {
        assert.ok(outScore < inScore, `${system} out-of-range score must be lower`);
      }
    }
  }

  if (goldenCase.family === "si-us-units" && isProfileExpectation(actual)) {
    assert.equal(actual.markers?.fasting_glucose?.status, "in_range");
    assert.equal(actual.systems.metabolic?.scoreability, "scoreable");
    if (goldenCase.labUnitSystem === "si") {
      assert.equal(actual.markers?.fasting_glucose?.unit, "mmol/L");
      assert.equal(actual.markers?.fasting_glucose?.converted, true);
    }
    if (goldenCase.labUnitSystem === "us") {
      assert.equal(actual.markers?.fasting_glucose?.unit, "mg/dL");
      assert.equal(actual.markers?.fasting_glucose?.converted, false);
    }
  }

  if (goldenCase.family === "missing-group" && isProfileExpectation(actual)) {
    const system = goldenCase.id.replace("missing-group-", "");
    assert.equal(actual.systems[system]?.scoreability, "incomplete");
    assert.equal(actual.systems[system]?.state_score, null);
    assert.ok(actual.systems[system]?.readiness_codes.includes("missing"));
  }

  if (goldenCase.id === "inflammation-crp-factual-only" && isProfileExpectation(actual)) {
    assert.equal(actual.systems.inflammation?.scoreability, "non_scoreable");
    assert.equal(actual.systems.inflammation?.state_score, null);
  }

  if (goldenCase.id === "correction-pending-excluded" && !isProfileExpectation(actual)) {
    assert.equal(actual.eligible, false);
    assert.equal(actual.exclusionReason, "verification_required");
  }

  if (goldenCase.id === "correction-manually-corrected-admitted" && !isProfileExpectation(actual)) {
    assert.equal(actual.eligible, true);
    assert.equal(actual.exclusionReason, null);
  }

  if (goldenCase.id === "invalid-inverted-document-range" && !isProfileExpectation(actual)) {
    assert.equal(actual.eligible, false);
    assert.equal(actual.exclusionReason, "invalid_document_reference_range");
  }

  if (goldenCase.id === "invalid-missing-document-range" && !isProfileExpectation(actual)) {
    assert.equal(actual.eligible, false);
    assert.equal(actual.exclusionReason, "missing_document_reference_range");
  }
}

function dumpExpected(cases: GoldenCase[]) {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const expectedById: ExpectedFile["cases"] = {};
  for (const goldenCase of cases) {
    expectedById[goldenCase.id] = evaluateGoldenCase(goldenCase);
  }
  const payload: ExpectedFile = {
    packVersion: EH147_PACK_VERSION,
    algorithmVersion: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
    cases: expectedById,
  };
  writeFileSync(EXPECTED_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(
    PACK_PATH,
    `${JSON.stringify(
      {
        packVersion: EH147_PACK_VERSION,
        algorithmVersion: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
        caseIds: cases.map((goldenCase) => goldenCase.id),
        packHash: packHash(cases, expectedById),
      },
      null,
      2,
    )}\n`,
  );
  return expectedById;
}

const cases = listGoldenCases();
if (writeExpected) {
  dumpExpected(cases);
  console.log(`wrote ${EXPECTED_PATH}`);
  process.exit(0);
}

const expectedFile = readExpected();
assert.equal(expectedFile.packVersion, EH147_PACK_VERSION);
assert.equal(expectedFile.algorithmVersion, HEALTH_PROFILE_SCORE_ALGORITHM_VERSION);

const failed: string[] = [];
for (const goldenCase of cases) {
  try {
    const actual = evaluateGoldenCase(goldenCase);
    const expected = expectedFile.cases[goldenCase.id];
    assert.ok(expected, `missing committed expectation for ${goldenCase.id}`);
    assert.deepEqual(actual, expected, `${goldenCase.id} drifted from committed expectation`);
    assertInvariants(goldenCase, actual);
  } catch (error) {
    failed.push(goldenCase.id);
    console.error(goldenCase.id);
    console.error(error instanceof Error ? error.message : inspect(error));
  }
}

const hash = packHash(cases, expectedFile.cases);
const report = {
  packVersion: EH147_PACK_VERSION,
  algorithmVersion: HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
  packHash: hash,
  caseCount: cases.length,
  failedCaseIds: failed,
  families: [...new Set(cases.map((goldenCase) => goldenCase.family))],
};

if (writeReport) {
  writeFileSync(path.join(ROOT, "QA", "eh-147", "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
assert.equal(failed.length, 0, `EH-147 golden mismatches: ${failed.join(", ")}`);
assert.deepEqual(
  canonicalPackPayload(cases, expectedFile.cases).cases.map((item) => item.id),
  [...cases.map((goldenCase) => goldenCase.id)].sort((left, right) => left.localeCompare(right)),
);

if (productCheck) {
  const approvals = JSON.parse(readFileSync(APPROVALS_PATH, "utf8")) as ApprovalFile;
  const matching = approvals.approvals.find(
    (approval) =>
      approval.role === "Clinical Product" &&
      approval.status === "approved" &&
      approval.packHash === hash,
  );
  assert.ok(
    matching,
    `EH-147 product check failed: no Clinical Product approval bound to pack hash ${hash}`,
  );
}

if (technicalOnly) {
  console.log("EH-147 technical check passed");
}
