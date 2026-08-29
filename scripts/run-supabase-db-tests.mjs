#!/usr/bin/env node
/**
 * Run pgTAP files through Supabase CLI.
 *
 * CI keeps `supabase test db --local` after `supabase db start`.
 * Worktrees that share `supabase_db_easyhealth` on 127.0.0.1:54322 can fail
 * `--local` with LegacyDbConnectError; retry `--db-url` without `--local`,
 * then docker exec. Never runs `supabase db reset`.
 * A CLI or docker TAP failure is a failed suite, not a connect fallback.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONNECT_FAILURE =
  /LegacyDbConnectError|LegacyDockerRunError|LegacyTestDbMutuallyExclusiveFlagsError|failed to connect to postgres|mkdir \/run\/desktop\/mnt\/host/i;
const CLI_TAP_PASS = /Result:\s+PASS|All tests successful/i;
const CLI_TAP_FAIL = /Result:\s+FAIL|Failed tests/i;

const files = process.argv.slice(2).filter((arg) => arg !== "--");
if (files.length === 0) {
  process.stderr.write("usage: node scripts/run-supabase-db-tests.mjs <sql-file...>\n");
  process.exit(2);
}

const container = process.env.SUPABASE_DB_CONTAINER || "supabase_db_easyhealth";
const useShell = process.platform === "win32";
const supabaseBin = process.platform === "win32" ? "supabase.cmd" : "supabase";
const dockerBin = process.platform === "win32" ? "docker.exe" : "docker";

function explicitDbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  if (process.env.SUPABASE_TEST_DB_URL) return process.env.SUPABASE_TEST_DB_URL;
  if (process.env.DATABASE_URL?.startsWith("postgres")) return process.env.DATABASE_URL;
  return null;
}

function sharedLocalDbUrl() {
  const password = process.env.POSTGRES_PASSWORD || "postgres";
  const host = process.env.SUPABASE_DB_HOST || "127.0.0.1";
  const port = process.env.SUPABASE_DB_PORT || "54322";
  const user = process.env.POSTGRES_USER || "postgres";
  const database = process.env.POSTGRES_DB || "postgres";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function redactUrl(url) {
  return url.replace(/:([^:@/]+)@/, ":***@");
}

function run(bin, args, options = {}) {
  return spawnSync(bin, args, {
    encoding: "utf8",
    shell: useShell,
    windowsHide: true,
    ...options,
  });
}

function combinedText(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`;
}

function printCaptured(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(`${result.error.message}\n`);
}

function cliSucceeded(result) {
  const text = combinedText(result);
  if (CLI_TAP_FAIL.test(text)) return false;
  return (result.status ?? 1) === 0 && CLI_TAP_PASS.test(text);
}

function dockerTapSucceeded(result) {
  const text = combinedText(result);
  if ((result.status ?? 1) !== 0) return false;
  if (CLI_TAP_FAIL.test(text) || /^not ok\b/m.test(text)) return false;
  if (CLI_TAP_PASS.test(text)) return true;
  const plan = text.match(/^1\.\.(\d+)\s*$/m);
  if (!plan) return false;
  const expected = Number(plan[1]);
  const oks = [...text.matchAll(/^ok\b/gm)].length;
  return expected > 0 && oks >= expected;
}

function looksLikeConnectFailure(result) {
  const text = combinedText(result);
  if (CLI_TAP_FAIL.test(text) || /^not ok\b/m.test(text)) return false;
  if (CONNECT_FAILURE.test(text)) return true;
  if (result.error?.code === "ENOENT") return true;
  if ((result.status ?? 1) !== 0 && !CLI_TAP_PASS.test(text)) return true;
  return false;
}

function runCli(flagArgs) {
  const result = run(supabaseBin, ["test", "db", ...flagArgs, ...files]);
  if (result.error?.code === "ENOENT") {
    process.stderr.write(`supabase CLI not found (${supabaseBin})\n`);
  }
  return result;
}

function attemptCli(flagArgs) {
  const result = runCli(flagArgs);
  if (cliSucceeded(result)) {
    printCaptured(result);
    process.exit(0);
  }
  return result;
}

function failCliWithoutFallback(result) {
  printCaptured(result);
  process.exit(result.status ?? 1);
}

function runDockerFallback() {
  process.stderr.write(
    `run-supabase-db-tests: CLI still cannot connect; docker exec -i ${container} psql\n`,
  );
  for (const file of files) {
    const sql = readFileSync(file);
    const dockerResult = run(
      dockerBin,
      ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
      { input: sql, shell: false },
    );
    if (dockerResult.error?.code === "ENOENT") {
      process.stderr.write("docker not found; cannot fall back to in-container psql\n");
      process.exit(1);
    }
    printCaptured(dockerResult);
    if (!dockerTapSucceeded(dockerResult)) {
      process.stderr.write(
        `run-supabase-db-tests: docker pgTAP did not report a passing TAP plan for ${file}\n`,
      );
      process.exit(dockerResult.status && dockerResult.status !== 0 ? dockerResult.status : 1);
    }
  }
  process.exit(0);
}

const forcedUrl = explicitDbUrl();
if (forcedUrl) {
  process.stderr.write(`run-supabase-db-tests: using --db-url ${redactUrl(forcedUrl)}\n`);
  const result = attemptCli(["--db-url", forcedUrl]);
  if (!looksLikeConnectFailure(result)) failCliWithoutFallback(result);
  runDockerFallback();
}

const localResult = attemptCli(["--local"]);
if (!looksLikeConnectFailure(localResult)) failCliWithoutFallback(localResult);

const fallbackUrl = sharedLocalDbUrl();
process.stderr.write(
  `run-supabase-db-tests: --local could not run pgTAP; retrying --db-url ${redactUrl(fallbackUrl)}\n`,
);
const urlResult = attemptCli(["--db-url", fallbackUrl]);
if (!looksLikeConnectFailure(urlResult)) failCliWithoutFallback(urlResult);

runDockerFallback();
