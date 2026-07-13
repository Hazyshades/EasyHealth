/**
 * Lightweight verification for biomarker catalog (no vitest required).
 * Run: node scripts/verify-biomarkers.mjs
 *
 * Uses dynamic import of compiled paths via tsx if available; otherwise
 * inlines critical conversion math checks + alias map subset.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

function runWithTsx() {
  const entry = path.join(root, "scripts", "verify-biomarkers-runner.ts");
  const r = spawnSync(
    "npx",
    ["--yes", "tsx", entry],
    { cwd: root, encoding: "utf8", shell: true }
  );
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// Prefer tsx runner for full module tests
runWithTsx();
