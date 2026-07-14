import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const runtimeFiles = filesIn("src").filter((file) => !file.replace(/\\/g, "/").startsWith("src/lib/biomarkers/catalog/"));
const forbidden = /(?:from\s+["'][^"']*(?:biomarkers\/catalog|\.\/catalog(?:\/definitions)?)[^"']*["']|require\(["'][^"']*(?:biomarkers\/catalog|\.\/catalog(?:\/definitions)?)[^"']*["']\))/;
const offenders = runtimeFiles.filter((file) => forbidden.test(readFileSync(file, "utf8")));

assert.deepEqual(offenders, [], `Registry v1 must remain an audit fixture, not a runtime dependency:\n${offenders.join("\n")}`);
console.log("verify-no-registry-v1-runtime-imports: passed");
