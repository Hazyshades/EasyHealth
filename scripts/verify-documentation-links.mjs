import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("docs/README.md");
const markdown = readFileSync(source, "utf8");
const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
const failures = links
  .filter((link) => !/^(?:https?:|#|mailto:)/.test(link))
  .map((link) => ({ link, target: resolve(dirname(source), link) }))
  .filter(({ target }) => !existsSync(target));

if (failures.length > 0) {
  for (const { link, target } of failures) {
    console.error(`[documentation-links] ${link} -> missing ${target}`);
  }
  process.exit(1);
}

console.log(`[documentation-links] ${links.length} links resolve`);
