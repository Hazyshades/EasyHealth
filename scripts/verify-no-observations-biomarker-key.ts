import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOTS = ["src", "worker", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SELF = "scripts/verify-no-observations-biomarker-key.ts";

async function filesUnder(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      files.push(...(await filesUnder(path)));
      continue;
    }
    if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) files.push(path);
  }
  return files;
}

function hasRemovedObservationIdentityAccess(source: string) {
  const directFieldAccess = /\bobservations\s*\.\s*biomarker_key\b/i;
  const supabaseQuery =
    /\.from\(\s*["'`]observations["'`]\s*\)[\s\S]{0,700}?\bbiomarker_key\b/i;
  const sqlQuery =
    /\b(?:select|insert\s+into|update|delete\s+from)\s+(?:public\.)?observations\b[\s\S]{0,700}?\bbiomarker_key\b/i;
  return directFieldAccess.test(source) || supabaseQuery.test(source) || sqlQuery.test(source);
}

async function main() {
  const violations: string[] = [];
  for (const root of ROOTS) {
    for (const file of await filesUnder(root)) {
      const displayPath = relative(process.cwd(), file).replaceAll("\\", "/");
      if (displayPath === SELF) continue;
      const source = await readFile(file, "utf8");
      if (hasRemovedObservationIdentityAccess(source)) violations.push(displayPath);
    }
  }

  if (violations.length > 0) {
    console.error(
      "Removed observations.biomarker_key access found in active runtime/tooling files:\n" +
        violations.map((file) => `- ${file}`).join("\n")
    );
    process.exitCode = 1;
  } else {
    console.log("No active observations.biomarker_key access found.");
  }
}

void main();
