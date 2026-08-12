import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

type PackageScripts = Record<string, string>;

export type SuitePolicyEntry = {
  script: string;
  verificationFiles: string[];
  job: string;
  environment: string;
  localOnly: boolean;
  owner: string;
  reason: string;
};

export type VerificationSuitePolicy = {
  version: number;
  suites: SuitePolicyEntry[];
  localOnly: SuitePolicyEntry[];
};

type WorkflowData = {
  invokedScripts: Map<string, Set<string>>;
  reachableFiles: Map<string, Set<string>>;
  unsupportedCommands: string[];
};

type SuiteResult = {
  script: string;
  status: "covered" | "local-only" | "orphaned" | "partial" | "invalid";
  verificationFiles: string[];
  coveredFiles: string[];
  missingFiles: string[];
  jobs: string[];
  expectedJob: string | null;
  expectedEnvironment: string | null;
  errors: string[];
};

export type CoverageReport = {
  version: 1;
  workflowFiles: string[];
  totals: {
    suites: number;
    covered: number;
    localOnly: number;
    orphaned: number;
    partial: number;
    invalid: number;
  };
  suites: SuiteResult[];
  unsupportedCommands: string[];
  errors: string[];
};

export type CoverageAnalysisInput = {
  scripts: PackageScripts;
  workflows: Record<string, string>;
  policy: VerificationSuitePolicy;
};

const FILE_TOKEN_PATTERN = /(?:^|[\s"'`(])((?:\.{0,2}\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.(?:ts|tsx|mts|sql))(?=$|[\s"'`),;&|])/g;
const PACKAGE_SCRIPT_PATTERN = /\bpnpm\s+(?:run\s+)?([A-Za-z0-9][A-Za-z0-9:_-]*)/g;
const SUPPORTED_FILE_EXTENSIONS = /\.(?:ts|tsx|mts|sql)$/;
const WORKFLOW_FILE_EXTENSIONS = new Set([".yml", ".yaml"]);

function normalizeRepoPath(value: string): string {
  const normalized = value
    .trim()
    .replace(/^['"`]|['"`]$/g, "")
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");
  return path.posix.normalize(normalized);
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function extractVerificationFiles(command: string): string[] {
  const files: string[] = [];
  for (const match of command.matchAll(FILE_TOKEN_PATTERN)) {
    const candidate = normalizeRepoPath(match[1]);
    if (SUPPORTED_FILE_EXTENSIONS.test(candidate)) files.push(candidate);
  }
  return sortedUnique(files);
}

export function extractPackageScriptInvocations(command: string): string[] {
  const scripts: string[] = [];
  for (const match of command.matchAll(PACKAGE_SCRIPT_PATTERN)) scripts.push(match[1]);
  return sortedUnique(scripts);
}

export function resolvePackageScriptFiles(
  scriptName: string,
  scripts: PackageScripts,
  stack: string[] = [],
): string[] {
  if (!scripts[scriptName]) return [];
  if (stack.includes(scriptName)) {
    throw new Error(`package script cycle: ${[...stack, scriptName].join(" -> ")}`);
  }

  const command = scripts[scriptName];
  const files = extractVerificationFiles(command);
  for (const child of extractPackageScriptInvocations(command)) {
    if (!scripts[child]) continue;
    files.push(...resolvePackageScriptFiles(child, scripts, [...stack, scriptName]));
  }
  return sortedUnique(files);
}

function stripShellComment(line: string): string {
  if (line.trimStart().startsWith("#")) return "";
  return line.replace(/\s+#.*$/, "");
}

function addMapValue(map: Map<string, Set<string>>, key: string, value: string): void {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

function processWorkflowCommand(
  workflowPath: string,
  job: string,
  command: string,
  scripts: PackageScripts,
  data: WorkflowData,
): void {
  const normalizedCommand = command
    .split(/\r?\n/)
    .map(stripShellComment)
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!normalizedCommand) return;

  const invokedScripts = extractPackageScriptInvocations(normalizedCommand);
  for (const scriptName of invokedScripts) {
    if (!scripts[scriptName]) {
      if (/^(?:test|verify|check):/.test(scriptName)) {
        data.unsupportedCommands.push(
          `${workflowPath} [${job}]: unknown package script ${scriptName}`,
        );
      }
      continue;
    }
    addMapValue(data.invokedScripts, scriptName, job);
    let files: string[];
    try {
      files = resolvePackageScriptFiles(scriptName, scripts);
    } catch (error) {
      data.unsupportedCommands.push(
        `${workflowPath} [${job}]: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    for (const file of files) addMapValue(data.reachableFiles, file, job);
  }

  for (const file of extractVerificationFiles(normalizedCommand)) {
    addMapValue(data.reachableFiles, file, job);
  }

  if (/\btsx\b/.test(normalizedCommand) && extractVerificationFiles(normalizedCommand).length === 0) {
    data.unsupportedCommands.push(`${workflowPath} [${job}]: tsx command has no supported file operand`);
  }
  if (/\bsupabase\s+test\s+db\b/.test(normalizedCommand) && extractVerificationFiles(normalizedCommand).length === 0) {
    data.unsupportedCommands.push(
      `${workflowPath} [${job}]: supabase database test has no supported SQL file operand`,
    );
  }
}

export function parseWorkflowText(
  workflowPath: string,
  workflowText: string,
  scripts: PackageScripts,
): WorkflowData {
  const data: WorkflowData = {
    invokedScripts: new Map(),
    reachableFiles: new Map(),
    unsupportedCommands: [],
  };
  const lines = workflowText.split(/\r?\n/);
  let currentJob = "unknown";
  let blockRun: { indent: number; lines: string[] } | null = null;

  const flushRun = (): void => {
    if (!blockRun) return;
    processWorkflowCommand(workflowPath, currentJob, blockRun.lines.join("\n"), scripts, data);
    blockRun = null;
  };

  for (const line of lines) {
    const indentation = line.match(/^\s*/)?.[0].length ?? 0;
    if (blockRun && (line.trim() === "" || indentation > blockRun.indent)) {
      blockRun.lines.push(line.trim());
      continue;
    }
    if (blockRun) flushRun();

    const jobMatch = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (jobMatch) {
      currentJob = jobMatch[1];
      continue;
    }

    const runMatch = line.match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    if (!runMatch) continue;
    const runIndent = runMatch[1].length;
    const runValue = runMatch[2].trim();
    if (runValue === "|" || runValue === ">" || runValue === "|-" || runValue === ">-") {
      blockRun = { indent: runIndent, lines: [] };
    } else {
      processWorkflowCommand(workflowPath, currentJob, runValue, scripts, data);
    }
  }
  flushRun();
  return data;
}

function validatePolicy(policy: VerificationSuitePolicy): string[] {
  const errors: string[] = [];
  if (policy.version !== 1) errors.push(`unsupported CI suite policy version: ${String(policy.version)}`);
  const allEntries = [...policy.suites, ...policy.localOnly];
  const seen = new Set<string>();
  for (const entry of allEntries) {
    if (seen.has(entry.script)) errors.push(`duplicate CI suite policy entry: ${entry.script}`);
    seen.add(entry.script);
    if (!entry.script.startsWith("test:")) errors.push(`policy entry is not a test script: ${entry.script}`);
    if (!entry.verificationFiles.length) errors.push(`policy entry has no verification files: ${entry.script}`);
    if (!entry.job) errors.push(`policy entry has no job: ${entry.script}`);
    if (!entry.environment) errors.push(`policy entry has no environment: ${entry.script}`);
    if (!entry.owner) errors.push(`policy entry has no owner: ${entry.script}`);
    if (!entry.reason) errors.push(`policy entry has no reason: ${entry.script}`);
  }
  for (const entry of policy.suites) {
    if (entry.localOnly) errors.push(`required suite is marked local-only: ${entry.script}`);
  }
  for (const entry of policy.localOnly) {
    if (!entry.localOnly) errors.push(`local-only entry must set localOnly=true: ${entry.script}`);
  }
  return errors;
}

function equalPathSets(left: string[], right: string[]): boolean {
  const leftSet = new Set(left.map(normalizeRepoPath));
  const rightSet = new Set(right.map(normalizeRepoPath));
  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

function policyMaps(policy: VerificationSuitePolicy): {
  required: Map<string, SuitePolicyEntry>;
  localOnly: Map<string, SuitePolicyEntry>;
} {
  return {
    required: new Map(policy.suites.map((entry) => [entry.script, entry])),
    localOnly: new Map(policy.localOnly.map((entry) => [entry.script, entry])),
  };
}

export function analyzeCoverage(input: CoverageAnalysisInput): CoverageReport {
  const workflowFiles = Object.keys(input.workflows).sort((left, right) => left.localeCompare(right));
  const workflowData: WorkflowData = {
    invokedScripts: new Map(),
    reachableFiles: new Map(),
    unsupportedCommands: [],
  };
  for (const workflowPath of workflowFiles) {
    const parsed = parseWorkflowText(workflowPath, input.workflows[workflowPath], input.scripts);
    for (const [script, jobs] of parsed.invokedScripts) {
      for (const job of jobs) addMapValue(workflowData.invokedScripts, script, job);
    }
    for (const [file, jobs] of parsed.reachableFiles) {
      for (const job of jobs) addMapValue(workflowData.reachableFiles, file, job);
    }
    workflowData.unsupportedCommands.push(...parsed.unsupportedCommands);
  }

  const policyErrors = validatePolicy(input.policy);
  const { required, localOnly } = policyMaps(input.policy);
  const scripts = Object.keys(input.scripts)
    .filter((name) => name.startsWith("test:"))
    .sort((left, right) => left.localeCompare(right));
  const policyEntries = new Set([...required.keys(), ...localOnly.keys()]);
  const errors = [...policyErrors];

  for (const script of policyEntries) {
    if (!input.scripts[script]) errors.push(`stale CI suite policy entry: ${script}`);
  }

  const suiteResults: SuiteResult[] = scripts.map((script) => {
    const suiteErrors: string[] = [];
    const policyEntry = required.get(script) ?? localOnly.get(script) ?? null;
    let verificationFiles: string[] = [];
    try {
      verificationFiles = resolvePackageScriptFiles(script, input.scripts);
    } catch (error) {
      suiteErrors.push(error instanceof Error ? error.message : String(error));
    }
    const coveredFiles = verificationFiles.filter((file) => workflowData.reachableFiles.has(file));
    const missingFiles = verificationFiles.filter((file) => !workflowData.reachableFiles.has(file));
    const jobs = sortedUnique(
      coveredFiles.flatMap((file) => [...(workflowData.reachableFiles.get(file) ?? new Set<string>())]),
    );
    const expectedJob = policyEntry?.localOnly ? null : policyEntry?.job ?? null;
    const expectedEnvironment = policyEntry?.environment ?? null;

    if (policyEntry && !equalPathSets(verificationFiles, policyEntry.verificationFiles)) {
      suiteErrors.push(
        `policy verification files differ for ${script}: expected ${policyEntry.verificationFiles.join(", ") || "<none>"}; resolved ${verificationFiles.join(", ") || "<none>"}`,
      );
    }

    if (policyEntry?.localOnly) {
      if (!verificationFiles.length) suiteErrors.push(`no verification files resolved for ${script}`);
      if (coveredFiles.length > 0) suiteErrors.push(`local-only suite has a workflow runner: ${script}`);
      return {
        script,
        status: suiteErrors.length ? "invalid" : "local-only",
        verificationFiles,
        coveredFiles,
        missingFiles,
        jobs,
        expectedJob,
        expectedEnvironment,
        errors: suiteErrors,
      };
    }

    if (!verificationFiles.length) suiteErrors.push(`no verification files resolved for ${script}`);
    if (missingFiles.length) suiteErrors.push(`missing workflow coverage: ${missingFiles.join(", ")}`);
    if (policyEntry && !jobs.includes(policyEntry.job)) {
      suiteErrors.push(`expected reachable coverage in job ${policyEntry.job}; found ${jobs.join(", ") || "<none>"}`);
    }

    const status: SuiteResult["status"] = suiteErrors.length
      ? missingFiles.length === verificationFiles.length
        ? "orphaned"
        : "partial"
      : "covered";
    return {
      script,
      status,
      verificationFiles,
      coveredFiles,
      missingFiles,
      jobs,
      expectedJob,
      expectedEnvironment,
      errors: suiteErrors,
    };
  });

  for (const suite of suiteResults) {
    for (const error of suite.errors) errors.push(`${suite.script}: ${error}`);
  }
  errors.push(...workflowData.unsupportedCommands);

  const totals = {
    suites: suiteResults.length,
    covered: suiteResults.filter((suite) => suite.status === "covered").length,
    localOnly: suiteResults.filter((suite) => suite.status === "local-only").length,
    orphaned: suiteResults.filter((suite) => suite.status === "orphaned").length,
    partial: suiteResults.filter((suite) => suite.status === "partial").length,
    invalid: suiteResults.filter((suite) => suite.status === "invalid").length,
  };

  return {
    version: 1,
    workflowFiles,
    totals,
    suites: suiteResults,
    unsupportedCommands: sortedUnique(workflowData.unsupportedCommands),
    errors: sortedUnique(errors),
  };
}

function discoverWorkflowFiles(root: string): string[] {
  const workflowRoot = path.join(root, ".github", "workflows");
  if (!statSync(workflowRoot, { throwIfNoEntry: false })) return [];
  return readdirSync(workflowRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && WORKFLOW_FILE_EXTENSIONS.has(path.extname(entry.name)))
    .map((entry) => path.join(workflowRoot, entry.name));
}

function loadPolicy(root: string): VerificationSuitePolicy {
  return JSON.parse(
    readFileSync(path.join(root, "ci", "verification-suite-policy.json"), "utf8"),
  ) as VerificationSuitePolicy;
}

function runCli(): void {
  const root = process.cwd();
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts?: PackageScripts;
  };
  const scripts = packageJson.scripts ?? {};
  const workflowPaths = discoverWorkflowFiles(root);
  const workflows = Object.fromEntries(
    workflowPaths.map((workflowPath) => [
      path.relative(root, workflowPath).replaceAll("\\", "/"),
      readFileSync(workflowPath, "utf8"),
    ]),
  );
  const report = analyzeCoverage({ scripts, workflows, policy: loadPolicy(root) });
  const asJson = process.argv.includes("--json");
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `CI suite coverage: ${report.totals.covered} covered, ${report.totals.localOnly} local-only, ${report.totals.orphaned} orphaned, ${report.totals.partial} partial, ${report.totals.invalid} invalid`,
    );
    for (const suite of report.suites) {
      console.log(`[${suite.status}] ${suite.script} -> ${suite.verificationFiles.join(", ")}`);
    }
    if (report.errors.length) {
      console.error("Coverage errors:");
      for (const error of report.errors) console.error(`- ${error}`);
    }
  }
  if (report.errors.length) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("verify-ci-suite-coverage.ts")) runCli();
