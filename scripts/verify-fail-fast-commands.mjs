import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const verifierPattern = /\b(?:tsx|node|pnpm)\b[^;|\n]*(?:verify|test|check)[^;|\n]*/i;
const searchPattern = /\b(?:rg|grep|findstr)\b/i;
const maskingJoinPattern = /(?:;|\|\|)/;

function findMaskedSearch(command) {
  const parts = command.split(maskingJoinPattern);

  for (let index = 1; index < parts.length; index += 1) {
    if (!searchPattern.test(parts[index])) continue;
    if (parts.slice(0, index).some((part) => verifierPattern.test(part))) {
      return command;
    }
  }

  return null;
}

function assertDetectorContract() {
  if (!findMaskedSearch("tsx scripts/verify-example.ts; rg expected")) {
    throw new Error("fixture with a masking semicolon was not rejected");
  }

  if (findMaskedSearch("tsx scripts/verify-example.ts && rg expected")) {
    throw new Error("fixture with a fail-fast chain was incorrectly rejected");
  }
}

function sources() {
  const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  const workflow = readFileSync(resolve(".github/workflows/measurement-registry.yml"), "utf8");

  return [
    ...Object.entries(packageJson.scripts).map(([name, command]) => ({
      location: `package.json scripts.${name}`,
      command,
    })),
    ...workflow
      .split(/\r?\n/)
      .map((line, index) => ({ line, index: index + 1 }))
      .filter(({ line }) => /^\s*run:\s*\S/.test(line))
      .map(({ line, index }) => ({
        location: `.github/workflows/measurement-registry.yml:${index}`,
        command: line.replace(/^\s*run:\s*/, ""),
      })),
  ];
}

assertDetectorContract();

const failures = sources()
  .filter(({ command }) => findMaskedSearch(command))
  .map(({ location, command }) => `${location}: ${command}`);

if (failures.length > 0) {
  console.error("[fail-fast-verification] masking command chains detected:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[fail-fast-verification] no masking verifier/search command chains found");
