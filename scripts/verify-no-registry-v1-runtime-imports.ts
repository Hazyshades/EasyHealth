import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["src", "worker", "scripts"];
const SELF = "scripts/verify-no-registry-v1-runtime-imports.ts";
const FROZEN_FIXTURE_DIRECTORY = "src/lib/biomarkers/catalog/";
const AUDIT_TOOLING = new Set([
  "scripts/lib/registry-v1-baseline.ts",
  "scripts/registry-v1-baseline.ts",
  "scripts/verify-registry-v1-baseline-runner.ts",
]);

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [path] : [];
  });
}

function normalizedPath(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function isAllowlisted(path: string): boolean {
  return path.startsWith(FROZEN_FIXTURE_DIRECTORY) || AUDIT_TOOLING.has(path) || path === SELF;
}

const forbiddenImport = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\(|\bexport\s+(?:[^'";]*?\s+from\s*)?)["'][^"']*(?:launch-(?:catalog|registry)|biomarkers\/catalog|(?:^|\/)catalog(?:\/definitions)?|registry\/biomarker-registry\/v1)[^"']*["']/i;
const forbiddenLegacyRuntimeSymbol = /\b(?:LAUNCH_CATALOG_MIGRATION_RECORDS|getLaunch(?:CatalogRecord|Conversion|ScoreRole|Specimen|System)|listLaunchCoverageKeys|resolveLaunchCatalogKey)\b/;

const offenders = ROOTS
  .flatMap(filesIn)
  .map((path) => ({ path: normalizedPath(path), source: readFileSync(path, "utf8") }))
  .filter(({ path }) => !isAllowlisted(path))
  .flatMap(({ path, source }) => {
    const reasons = [
      ...(forbiddenImport.test(source) ? ["forbidden Registry v1 or generated-catalog import"] : []),
      ...(forbiddenLegacyRuntimeSymbol.test(source) ? ["forbidden generated-catalog runtime symbol"] : []),
    ];
    return reasons.map((reason) => `${path}: ${reason}`);
  });

assert.deepEqual(
  offenders,
  [],
  `Registry v1 must remain a frozen audit fixture outside the runtime dependency graph:\n${offenders.join("\n")}`
);
console.log("verify-no-registry-v1-runtime-imports: passed");
