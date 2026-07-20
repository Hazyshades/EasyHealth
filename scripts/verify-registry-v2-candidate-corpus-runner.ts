import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveMeasurementDefinition } from "../src/lib/biomarkers";
import {
  canonicalJson,
  runRegistryV2CandidateCorpus,
} from "./lib/registry-v2-candidate-corpus";

const candidateRoot = resolve("registry/candidate-release/v1");

function temporaryCandidateRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "easyhealth-registry-v2-corpus-"));
  cpSync(candidateRoot, root, { recursive: true });
  return root;
}

function changeJson(root: string, name: string, change: (value: Record<string, unknown>) => void): void {
  const path = join(root, name);
  const value = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  change(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const first = runRegistryV2CandidateCorpus();
const second = runRegistryV2CandidateCorpus();

assert.equal(first.manifest.launchable, true, "committed candidate evidence must satisfy the release gate");
assert.equal(first.report.coverage.requiredRows, 44);
assert.equal(first.report.coverage.actualRows, 44);
assert.ok(first.report.coverage.missingContextNegativeCount > 0, "missing-context negatives must remain represented");
assert.ok(first.report.coverage.deidentifiedDocumentCount >= 4, "representative de-identified document fixtures are required");
assert.ok(first.report.coverage.specialtyDocumentCount > 0, "specialty document coverage is required");
assert.deepEqual(first.report.coverage.languages, ["en", "ru"]);
assert.equal(first.report.metrics.rawPreservationRate, 1);
assert.equal(first.report.metrics.expectedClassificationRate, 1);
assert.equal(first.report.metrics.falseConcreteResolutions, 0);
assert.equal(first.report.metrics.processingErrors, 0);
assert.ok(first.report.rows.some((row) => row.expectedClassification === "partial" && row.contextAvailability === "missing"));
assert.ok(first.report.manualCorrections.some((row) => row.id === "alt"));
assert.ok(first.report.assessmentImpact.some((row) => row.definitionKey === "glucose_serum"));
assert.ok(
  first.report.assessmentImpact.some(
    (impact) => impact.definitionKey === "alt_serum_catalytic_activity" && impact.source === "manual_correction"
  ),
  "manual corrections with score impact must be present in the assessment-impact segment"
);
assert.ok(first.manifest.approvalEvidenceHash.match(/^[a-f0-9]{64}$/));
assert.ok(first.manifest.candidateInputHash.match(/^[a-f0-9]{64}$/));
assert.ok(first.manifest.manifestHash.match(/^[a-f0-9]{64}$/));
assert.deepEqual(canonicalJson(first), canonicalJson(second), "same inputs must produce byte-for-byte reproducible output");
assert.deepEqual(first.manifest.thresholdChecks.map((check) => check.passed), Array(first.manifest.thresholdChecks.length).fill(true));

const runnerSource = readFileSync("scripts/lib/registry-v2-candidate-corpus.ts", "utf8");
assert.doesNotMatch(
  runnerSource,
  /from\s+["'][^"']*(?:biomarker-acceptance|normalization-revisions|normalization-writer|supabase)[^"']*["']/,
  "candidate runner must not import a runtime writer"
);
assert.doesNotMatch(runnerSource, /\b(?:writeFileSync|mkdirSync|rmSync)\b/, "candidate runner must not write release evidence itself");
let mutationCalled = false;
assert.throws(
  () => runRegistryV2CandidateCorpus({ mutationAttempt: () => { mutationCalled = true; } }),
  /rejects runtime mutation attempts/
);
assert.equal(mutationCalled, false, "a mutation callback must be rejected before invocation");

const forcedFalseResolution = runRegistryV2CandidateCorpus({
  resolver: (input) => ({
    ...resolveMeasurementDefinition(input),
    result: "resolved",
    measurementDefinitionKey: "glucose_serum",
    analyteKey: "glucose",
  }),
});
assert.equal(forcedFalseResolution.manifest.launchable, false, "false concrete resolutions must block launchability");
assert.ok(forcedFalseResolution.report.metrics.falseConcreteResolutions > 0);
assert.equal(
  forcedFalseResolution.manifest.thresholdChecks.find((check) => check.metric === "falseConcreteResolutions")?.passed,
  false
);

const missingFixtureRoot = temporaryCandidateRoot();
try {
  rmSync(join(missingFixtureRoot, "documents", "cbc-ru-north.json"));
  assert.throws(() => runRegistryV2CandidateCorpus({ root: missingFixtureRoot }), /Required document fixture is missing/);
} finally {
  rmSync(missingFixtureRoot, { recursive: true, force: true });
}

const unclassifiedRoot = temporaryCandidateRoot();
try {
  changeJson(unclassifiedRoot, "corpus.json", (corpus) => {
    const rows = corpus.rows as Array<Record<string, unknown>>;
    delete rows[0]!.expected;
  });
  assert.throws(() => runRegistryV2CandidateCorpus({ root: unclassifiedRoot }), /valid expected classification/);
} finally {
  rmSync(unclassifiedRoot, { recursive: true, force: true });
}

const missingApprovalRoot = temporaryCandidateRoot();
try {
  changeJson(missingApprovalRoot, "approvals.json", (evidence) => {
    const approvals = evidence.approvals as Array<Record<string, unknown>>;
    approvals[0]!.status = "pending";
  });
  const missingApproval = runRegistryV2CandidateCorpus({ root: missingApprovalRoot });
  assert.equal(missingApproval.manifest.launchable, false, "missing approval evidence must block launchability");
  assert.match(missingApproval.manifest.approvals.errors.join("\n"), /false-concrete-resolution approval/);
} finally {
  rmSync(missingApprovalRoot, { recursive: true, force: true });
}

const missingScoreApprovalRoot = temporaryCandidateRoot();
try {
  changeJson(missingScoreApprovalRoot, "approvals.json", (evidence) => {
    const approvals = evidence.approvals as Array<Record<string, unknown>>;
    evidence.approvals = approvals.filter((approval) => approval.bindingKey !== "alt_serum_catalytic_activity");
  });
  const missingScoreApproval = runRegistryV2CandidateCorpus({ root: missingScoreApprovalRoot });
  assert.equal(missingScoreApproval.manifest.launchable, false, "unapproved score-affecting bindings must block launchability");
  assert.match(missingScoreApproval.manifest.approvals.errors.join("\n"), /score-affecting approval for alt_serum_catalytic_activity/);
} finally {
  rmSync(missingScoreApprovalRoot, { recursive: true, force: true });
}

const staleApprovalRoot = temporaryCandidateRoot();
try {
  changeJson(staleApprovalRoot, "corpus.json", (corpus) => {
    const rows = corpus.rows as Array<Record<string, unknown>>;
    rows[0]!.rawValueText = "68";
  });
  const staleApproval = runRegistryV2CandidateCorpus({ root: staleApprovalRoot });
  assert.equal(staleApproval.manifest.launchable, false, "approval evidence must be bound to the exact candidate inputs");
  assert.match(staleApproval.manifest.approvals.errors.join("\n"), /bound to a different candidate input hash/);
} finally {
  rmSync(staleApprovalRoot, { recursive: true, force: true });
}

const missingReleaseArtifactRoot = temporaryCandidateRoot();
try {
  rmSync(join(missingReleaseArtifactRoot, "reset-rollback.md"));
  assert.throws(() => runRegistryV2CandidateCorpus({ root: missingReleaseArtifactRoot }), /Required reset\/rollback notes are missing/);
} finally {
  rmSync(missingReleaseArtifactRoot, { recursive: true, force: true });
}

console.log("verify-registry-v2-candidate-corpus: all checks passed");
