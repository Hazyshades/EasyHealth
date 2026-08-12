import assert from "node:assert/strict";

import {
  analyzeCoverage,
  extractPackageScriptInvocations,
  extractVerificationFiles,
  resolvePackageScriptFiles,
  type CoverageReport,
  type SuitePolicyEntry,
  type VerificationSuitePolicy,
} from "./verify-ci-suite-coverage";

function entry(script: string, files: string[], job = "verify"): SuitePolicyEntry {
  return {
    script,
    verificationFiles: files,
    job,
    environment: "node-only",
    localOnly: false,
    owner: "coverage-contract",
    reason: "The suite is required evidence for the release gate.",
  };
}

function localEntry(script: string, files: string[]): SuitePolicyEntry {
  return {
    ...entry(script, files),
    localOnly: true,
    job: "local",
    environment: "local-only",
    reason: "The suite requires a developer-only dependency and has no CI runner.",
  };
}

function policy(suites: SuitePolicyEntry[], localOnly: SuitePolicyEntry[] = []): VerificationSuitePolicy {
  return { version: 1, suites, localOnly };
}

function assertClean(report: CoverageReport): void {
  assert.deepEqual(report.errors, [], `expected a clean coverage report, got ${report.errors.join(" | ")}`);
}

function testTransitiveScriptResolution(): void {
  const scripts = {
    "test:alpha": "tsx scripts/alpha.ts",
    "test:db": "supabase test db --local supabase/tests/db.sql",
    "test:chain": "pnpm test:alpha && pnpm run test:db",
  };
  assert.deepEqual(extractVerificationFiles(scripts["test:db"]), ["supabase/tests/db.sql"]);
  assert.deepEqual(extractPackageScriptInvocations(scripts["test:chain"]), ["test:alpha", "test:db"]);
  assert.deepEqual(resolvePackageScriptFiles("test:chain", scripts), ["scripts/alpha.ts", "supabase/tests/db.sql"]);

  const report = analyzeCoverage({
    scripts,
    workflows: {
      ".github/workflows/coverage.yml": "jobs:\n  verify:\n    steps:\n      - run: pnpm test:alpha\n      - run: pnpm test:chain\n  database:\n    steps:\n      - run: pnpm test:db\n",
    },
    policy: policy([
      entry("test:alpha", ["scripts/alpha.ts"]),
      entry("test:db", ["supabase/tests/db.sql"], "database"),
      entry("test:chain", ["scripts/alpha.ts", "supabase/tests/db.sql"]),
    ]),
  });
  assertClean(report);
  assert.equal(report.totals.covered, 3);
}

function testUnrunneredSuiteFails(): void {
  const report = analyzeCoverage({
    scripts: { "test:orphan": "tsx scripts/orphan.ts" },
    workflows: { ".github/workflows/coverage.yml": "jobs:\n  verify:\n    steps:\n      - run: pnpm typecheck\n" },
    policy: policy([entry("test:orphan", ["scripts/orphan.ts"])]),
  });
  assert.equal(report.totals.orphaned, 1);
  assert.ok(report.errors.some((error) => error.includes("test:orphan") && error.includes("missing workflow coverage")));
}

function testLocalOnlyPolicyHandling(): void {
  const scripts = { "test:local": "tsx scripts/local.ts" };
  const report = analyzeCoverage({
    scripts,
    workflows: {},
    policy: policy([], [localEntry("test:local", ["scripts/local.ts"])]),
  });
  assertClean(report);
  assert.equal(report.totals.localOnly, 1);

  const incorrectlyWired = analyzeCoverage({
    scripts,
    workflows: { ".github/workflows/coverage.yml": "jobs:\n  verify:\n    steps:\n      - run: pnpm test:local\n" },
    policy: policy([], [localEntry("test:local", ["scripts/local.ts"])]),
  });
  assert.ok(incorrectlyWired.errors.some((error) => error.includes("local-only suite has a workflow runner")));
  const stalePolicy = analyzeCoverage({
    scripts: {},
    workflows: {},
    policy: policy([], [localEntry("test:removed", ["scripts/removed.ts"])]),
  });
  assert.ok(stalePolicy.errors.some((error) => error.includes("stale CI suite policy entry: test:removed")));
}

function testIssue110JobAssignments(): void {
  const scripts = {
    "test:document-worker": "tsx scripts/document-worker.ts",
    "test:pr2-db": "supabase test db --local supabase/tests/pr2.sql",
    "test:postgrest-embeds": "tsx scripts/postgrest-embeds.ts",
    "test:eh113": "tsx scripts/eh113.ts",
    "test:eh113-db": "supabase test db --local supabase/tests/eh113.sql",
    "test:eh116": "tsx scripts/eh116.ts",
    "test:eh116-db": "supabase test db --local supabase/tests/eh116.sql",
  };
  const report = analyzeCoverage({
    scripts,
    workflows: {
      ".github/workflows/coverage.yml": "jobs:\n  verify:\n    steps:\n      - run: pnpm test:document-worker\n      - run: pnpm test:eh113\n      - run: pnpm test:eh116\n  database:\n    steps:\n      - run: pnpm test:pr2-db\n      - run: pnpm test:eh113-db\n      - run: pnpm test:eh116-db\n  integration:\n    steps:\n      - run: pnpm test:postgrest-embeds\n",
    },
    policy: policy([
      entry("test:document-worker", ["scripts/document-worker.ts"], "verify"),
      entry("test:pr2-db", ["supabase/tests/pr2.sql"], "database"),
      entry("test:postgrest-embeds", ["scripts/postgrest-embeds.ts"], "integration"),
      entry("test:eh113", ["scripts/eh113.ts"], "verify"),
      entry("test:eh113-db", ["supabase/tests/eh113.sql"], "database"),
      entry("test:eh116", ["scripts/eh116.ts"], "verify"),
      entry("test:eh116-db", ["supabase/tests/eh116.sql"], "database"),
    ]),
  });
  assertClean(report);
  for (const [script, job] of [
    ["test:document-worker", "verify"],
    ["test:pr2-db", "database"],
    ["test:postgrest-embeds", "integration"],
    ["test:eh113", "verify"],
    ["test:eh113-db", "database"],
    ["test:eh116", "verify"],
    ["test:eh116-db", "database"],
  ] as const) {
    const result = report.suites.find((suite) => suite.script === script);
    assert.ok(result);
    assert.equal(result.expectedJob, job);
    assert.deepEqual(result.jobs, [job]);
  }
}

function testUnsupportedSyntaxFailsClosed(): void {
  const report = analyzeCoverage({
    scripts: { "test:dynamic": "tsx scripts/dynamic.ts" },
    workflows: {
      ".github/workflows/coverage.yml": "jobs:\n  verify:\n    steps:\n      - run: tsx scripts/${SUITE}.ts\n",
    },
    policy: policy([entry("test:dynamic", ["scripts/dynamic.ts"])]),
  });
  assert.ok(report.unsupportedCommands.some((command) => command.includes("tsx command has no supported file operand")));
  assert.ok(report.errors.some((error) => error.includes("test:dynamic")));
}

function testExpectedJobIsEnforced(): void {
  const report = analyzeCoverage({
    scripts: { "test:db": "supabase test db --local supabase/tests/db.sql" },
    workflows: { ".github/workflows/coverage.yml": "jobs:\n  verify:\n    steps:\n      - run: pnpm test:db\n" },
    policy: policy([entry("test:db", ["supabase/tests/db.sql"], "database")]),
  });
  assert.ok(report.errors.some((error) => error.includes("expected reachable coverage in job database")));
}

function testGeneratedEvidenceSuitesAreNotSpecialCased(): void {
  const scripts = {
    "test:docs": "tsx scripts/verify-biomarker-docs.ts",
    "test:multilingual": "tsx scripts/verify-multilingual-lab-pipeline.ts",
    "test:candidate": "tsx scripts/verify-registry-v2-candidate-corpus-runner.ts",
    "test:wiki": "tsx scripts/export-biomarker-wiki.ts --render",
  };
  const report = analyzeCoverage({
    scripts,
    workflows: {
      ".github/workflows/coverage.yml": "jobs:\n  verify:\n    steps:\n      - run: pnpm test:docs\n      - run: pnpm test:multilingual\n      - run: pnpm test:candidate\n      - run: pnpm test:wiki\n",
    },
    policy: policy([
      entry("test:docs", ["scripts/verify-biomarker-docs.ts"]),
      entry("test:multilingual", ["scripts/verify-multilingual-lab-pipeline.ts"]),
      entry("test:candidate", ["scripts/verify-registry-v2-candidate-corpus-runner.ts"]),
      entry("test:wiki", ["scripts/export-biomarker-wiki.ts"]),
    ]),
  });
  assertClean(report);
  assert.deepEqual(
    report.suites.map((suite) => suite.verificationFiles),
    [
      ["scripts/verify-registry-v2-candidate-corpus-runner.ts"],
      ["scripts/verify-biomarker-docs.ts"],
      ["scripts/verify-multilingual-lab-pipeline.ts"],
      ["scripts/export-biomarker-wiki.ts"],
    ],
  );
}

function main(): void {
  testTransitiveScriptResolution();
  testUnrunneredSuiteFails();
  testLocalOnlyPolicyHandling();
  testUnsupportedSyntaxFailsClosed();
  testIssue110JobAssignments();
  testGeneratedEvidenceSuitesAreNotSpecialCased();
  console.log("verify-ci-suite-coverage-contract: all checks passed");
}

main();
