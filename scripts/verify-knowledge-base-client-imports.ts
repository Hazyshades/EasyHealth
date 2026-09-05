import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");

const CLIENT_ENTRYPOINTS = [
  "src/components/biomarker-table.tsx",
  "src/lib/knowledge-base/links.ts",
  "src/lib/knowledge-base/markdown-adapter.ts",
  "src/lib/knowledge-base/admission.ts",
  "src/components/knowledge-base/signed-in-measurement-adapter.tsx",
  "src/components/knowledge-base/knowledge-panel-article-page.tsx",
  "src/app/app/knowledge/panels/cbc/page.tsx",
] as const;

const FORBIDDEN = [
  'from "node:fs"',
  "from 'node:fs'",
  "from \"./content\"",
  "from './content'",
  'from "@/lib/knowledge-base/content"',
  "readFileSync",
];

for (const relative of CLIENT_ENTRYPOINTS) {
  const source = readFileSync(path.join(ROOT, relative), "utf8");
  for (const token of FORBIDDEN) {
    assert.doesNotMatch(
      source,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${relative} must not import the markdown filesystem loader (${token})`,
    );
  }
}

console.log("verify-knowledge-base-client-imports: all checks passed");
