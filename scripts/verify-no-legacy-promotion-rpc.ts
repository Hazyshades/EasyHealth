import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOTS = ["src", "worker", "scripts", "supabase/tests", ".github"];
const EXTENSION_OK: Record<string, true> = {
  ".ts": true,
  ".tsx": true,
  ".js": true,
  ".mjs": true,
  ".cjs": true,
  ".sql": true,
  ".yml": true,
  ".yaml": true,
};
const SELF = "scripts/verify-no-legacy-promotion-rpc.ts";

/** Historical migrations and the Phase B drop migration may mention the legacy name. */
const ALLOWLIST_PREFIXES = [
  "supabase/migrations/021_measurement_registry_governance.sql",
  "supabase/migrations/031_eh104_phase_a_resolution_verification.sql",
  "supabase/migrations/034_eh104_phase_b_enforcement.sql",
  "supabase/tests/eh104_observation_resolution_verification.sql",
  "scripts/verify-no-legacy-promotion-rpc.ts",
  "scripts/verify-eh104-phase-b-boundary.ts",
  "scripts/verify-eh106-writer-boundary.ts",
  "openspec/",
  "QA/",
];

const LEGACY_CALL = /\bpromote_observation_normalization_revision\s*\(/g;
const LEGACY_NAME = /\bpromote_observation_normalization_revision\b/g;
const V2_NAME = /promote_observation_normalization_revision_v2/g;

async function filesUnder(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "archive"
      ) {
        continue;
      }
      files.push(...(await filesUnder(path)));
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf("."));
    if (EXTENSION_OK[ext]) files.push(path);
  }
  return files;
}

async function main() {
  const violations: string[] = [];
  for (const root of ROOTS) {
    for (const file of await filesUnder(root)) {
      const displayPath = relative(process.cwd(), file).replaceAll("\\", "/");
      if (
        displayPath === SELF ||
        ALLOWLIST_PREFIXES.some(
          (prefix) => displayPath === prefix || displayPath.startsWith(prefix)
        )
      ) {
        continue;
      }
      const source = await readFile(file, "utf8");
      const withoutV2 = source.replace(V2_NAME, "PROMOTE_V2_PLACEHOLDER");
      const callHits = [...withoutV2.matchAll(LEGACY_CALL)];
      const nameHits = [...withoutV2.matchAll(LEGACY_NAME)];
      const count = callHits.length > 0 ? callHits.length : nameHits.length;
      if (count > 0) {
        violations.push(`${displayPath} (${count})`);
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      "Legacy promote_observation_normalization_revision references found outside allowlisted migrations:\n" +
        violations.map((file) => `- ${file}`).join("\n")
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "No active legacy promote_observation_normalization_revision callers found."
  );
}

void main();
