import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const header = readFileSync(resolve("src/components/layout/page-header.tsx"), "utf8");
if (!header.includes("title: string") || !header.includes("<h1")) {
  console.error("[page-header] title must be required and rendered as h1");
  process.exit(1);
}

const expected = {
  "src/app/app/settings/page.tsx": 'title="Settings"',
  "src/app/app/settings/ai/page.tsx": 'title="AI provider"',
  "src/app/app/account/page.tsx": 'title="Account"',
};
for (const [file, title] of Object.entries(expected)) {
  if (!readFileSync(resolve(file), "utf8").includes(title)) {
    console.error(`[page-header] ${file} is missing ${title}`);
    process.exit(1);
  }
}

console.log("[page-header] required headings use visible h1 titles");
