import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveMeasurementDefinition } from "../src/lib/biomarkers";
import {
  canonicalJson,
  REQUIRED_CANDIDATE_CORPUS_ROW_COUNT,
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
assert.equal(first.report.coverage.requiredRows, REQUIRED_CANDIDATE_CORPUS_ROW_COUNT);
assert.equal(first.report.coverage.actualRows, REQUIRED_CANDIDATE_CORPUS_ROW_COUNT);
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
for (const segments of Object.values(first.report.segments)) {
  assert.equal(
    Object.values(segments).reduce((total, segment) => total + segment.total, 0),
    REQUIRED_CANDIDATE_CORPUS_ROW_COUNT,
    "every report segmentation must account for every candidate row"
  );
}

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

const forcedAmbiguous = runRegistryV2CandidateCorpus({
  resolver: (input) => {
    const resolution = resolveMeasurementDefinition(input);
    return input.rawLabel === "Total protein"
      ? { ...resolution, result: "ambiguous", measurementDefinitionKey: null, analyteKey: null }
      : resolution;
  },
});
assert.equal(forcedAmbiguous.manifest.launchable, false, "unexpected ambiguous results must fail the expected-classification gate");
assert.equal(forcedAmbiguous.report.rows.find((row) => row.id === "total-protein")?.actualClassification, "ambiguous");
assert.equal(forcedAmbiguous.report.segments.panel.biochemistry?.ambiguous, 1, "ambiguous outcomes must remain visible in panel segments");

const processingFailure = runRegistryV2CandidateCorpus({
  resolver: (input) => {
    if (input.rawLabel === "Total protein") throw new Error("simulated candidate processor failure");
    return resolveMeasurementDefinition(input);
  },
});
assert.equal(processingFailure.manifest.launchable, false, "processing errors must block launchability");
assert.equal(processingFailure.report.metrics.processingErrors, 1);
assert.equal(processingFailure.report.processingErrors[0]?.id, "total-protein");
assert.equal(processingFailure.report.segments.panel.biochemistry?.processingErrors, 1);
assert.equal(
  processingFailure.manifest.thresholdChecks.find((check) => check.metric === "processingErrors")?.passed,
  false,
  "processing-error thresholds must be enforced"
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

const malformedClassificationRoot = temporaryCandidateRoot();
try {
  changeJson(malformedClassificationRoot, "corpus.json", (corpus) => {
    const rows = corpus.rows as Array<Record<string, unknown>>;
    (rows[0]!.expected as Record<string, unknown>).classification = "unsupported";
  });
  assert.throws(() => runRegistryV2CandidateCorpus({ root: malformedClassificationRoot }), /valid expected classification/);
} finally {
  rmSync(malformedClassificationRoot, { recursive: true, force: true });
}

const loweredCorpusRoot = temporaryCandidateRoot();
try {
  changeJson(loweredCorpusRoot, "corpus.json", (corpus) => {
    const rows = corpus.rows as Array<Record<string, unknown>>;
    rows.pop();
    corpus.requiredRowCount = REQUIRED_CANDIDATE_CORPUS_ROW_COUNT - 1;
  });
  changeJson(loweredCorpusRoot, "policy.json", (policy) => {
    policy.requiredLaunchRows = REQUIRED_CANDIDATE_CORPUS_ROW_COUNT - 1;
  });
  assert.throws(() => runRegistryV2CandidateCorpus({ root: loweredCorpusRoot }), /must remain 44/);
} finally {
  rmSync(loweredCorpusRoot, { recursive: true, force: true });
}

const missingRequiredCoverageRoot = temporaryCandidateRoot();
try {
  changeJson(missingRequiredCoverageRoot, "documents.json", (documents) => {
    delete documents.requiredCoverage;
  });
  assert.throws(() => runRegistryV2CandidateCorpus({ root: missingRequiredCoverageRoot }), /documents\.requiredCoverage is required/);
} finally {
  rmSync(missingRequiredCoverageRoot, { recursive: true, force: true });
}

const incompleteRequiredCoverageRoot = temporaryCandidateRoot();
try {
  changeJson(incompleteRequiredCoverageRoot, "documents.json", (documents) => {
    (documents.requiredCoverage as Record<string, unknown>).languages = [];
  });
  assert.throws(
    () => runRegistryV2CandidateCorpus({ root: incompleteRequiredCoverageRoot }),
    /documents\.requiredCoverage\.languages must be a non-empty string array/
  );
} finally {
  rmSync(incompleteRequiredCoverageRoot, { recursive: true, force: true });
}

const mismatchedDocumentRawRowRoot = temporaryCandidateRoot();
try {
  changeJson(mismatchedDocumentRawRowRoot, "documents/chemistry-en-west.json", (document) => {
    const rawRows = document.rawRows as Array<Record<string, unknown>>;
    rawRows[0]!.rawUnit = "mg/dL";
  });
  assert.throws(
    () => runRegistryV2CandidateCorpus({ root: mismatchedDocumentRawRowRoot }),
    /raw row is not represented in the candidate corpus/
  );
} finally {
  rmSync(mismatchedDocumentRawRowRoot, { recursive: true, force: true });
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

const invalidExtraApprovalRoot = temporaryCandidateRoot();
try {
  changeJson(invalidExtraApprovalRoot, "approvals.json", (evidence) => {
    const approvals = evidence.approvals as Array<Record<string, unknown>>;
    approvals.push({
      id: "invalid-extra-approval",
      scope: "not_a_real_scope",
      role: "registry-safety-reviewer",
      approvedBy: "Registry Safety Reviewer",
      status: "rejected",
      candidateInputHash: approvals[0]!.candidateInputHash,
      note: "Malformed approval records must not be ignored.",
    });
  });
  const invalidExtraApproval = runRegistryV2CandidateCorpus({ root: invalidExtraApprovalRoot });
  assert.equal(invalidExtraApproval.manifest.launchable, false, "invalid extra approval evidence must block launchability");
  assert.match(invalidExtraApproval.manifest.approvals.errors.join("\n"), /invalid scope/);
  assert.match(invalidExtraApproval.manifest.approvals.errors.join("\n"), /invalid status/);
} finally {
  rmSync(invalidExtraApprovalRoot, { recursive: true, force: true });
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

const workflow = readFileSync(".github/workflows/measurement-registry.yml", "utf8");
assert.match(workflow, /registry-v2-candidate-release-approvals\.json/, "CI must publish raw approval evidence");
assert.match(workflow, /registry-v2-candidate-release-reset-rollback\.md/, "CI must publish reset and rollback notes");

console.log("verify-registry-v2-candidate-corpus: all checks passed");
