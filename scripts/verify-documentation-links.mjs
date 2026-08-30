import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const repositoryRoot = resolve(".");
const trackedPaths = new Set(
  execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
);
const source = resolve("docs/README.md");
const markdown = readFileSync(source, "utf8");
const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
const failures = links
  .filter((link) => !/^(?:https?:|#|mailto:)/.test(link))
  .map((link) => ({ link, target: resolve(dirname(source), link) }))
  .filter(({ target }) => {
    const relativeTarget = relative(repositoryRoot, target).split(sep).join("/");
    if (relativeTarget.startsWith("..")) return true;
    if (trackedPaths.has(relativeTarget)) return false;
    const directoryPrefix = `${relativeTarget}/`;
    for (const trackedPath of trackedPaths) {
      if (trackedPath.startsWith(directoryPrefix)) return false;
    }
    return true;
  });

if (failures.length > 0) {
  for (const { link, target } of failures) {
    console.error(`[documentation-links] ${link} -> missing ${target}`);
  }
  process.exit(1);
}

console.log(`[documentation-links] ${links.length} links resolve`);
