import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const verifierPattern = /\b(?:tsx|tsc)\b|\b(?:node|pnpm)\b[^;|\n]*(?:verify|test|check)/i;
const searchPattern = /\b(?:rg|grep|findstr)\b/i;
const maskingJoinPattern = /(?:;|\|\|)/;

function findMaskedSearch(command) {
  const parts = command.split(maskingJoinPattern);
  for (let index = 1; index < parts.length; index += 1) {
    if (searchPattern.test(parts[index]) && parts.slice(0, index).some((part) => verifierPattern.test(part))) {
      return command;
    }
  }
  return null;
}

function workflowCommands(workflow) {
  const lines = workflow.split(/\r?\n/);
  const commands = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(?:-\s*)?run:\s*(.*)$/);
    if (!match) continue;
    const indentation = match[1];
    const value = match[2];
    if (value && !/^[>|]/.test(value)) {
      commands.push({ location: `.github/workflows/measurement-registry.yml:${index + 1}`, command: value });
      continue;
    }
    const firstBodyLine = index + 1;
    const body = [];
    for (index += 1; index < lines.length && lines[index].startsWith(`${indentation}  `); index += 1) {
      body.push(lines[index].slice(indentation.length + 2));
    }
    index -= 1;
    commands.push({ location: `.github/workflows/measurement-registry.yml:${firstBodyLine}`, command: body.join("\n") });
  }
  return commands;
}

function assertDetectorContract() {
  if (!findMaskedSearch("tsx scripts/verify-example.ts; rg expected")) throw new Error("fixture with a masking semicolon was not rejected");
  if (!findMaskedSearch("tsc --noEmit || grep expected")) throw new Error("TypeScript compiler masking fixture was not rejected");
  if (findMaskedSearch("tsx scripts/verify-example.ts && rg expected")) throw new Error("fixture with a fail-fast chain was incorrectly rejected");
  const blockScalar = "steps:\n  - run: |\n      tsc --noEmit; rg expected";
  if (!workflowCommands(blockScalar).some(({ command }) => findMaskedSearch(command))) throw new Error("block scalar masking fixture was not rejected");
}

function sources() {
  const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  const workflow = readFileSync(resolve(".github/workflows/measurement-registry.yml"), "utf8");
  return [
    ...Object.entries(packageJson.scripts).map(([name, command]) => ({ location: `package.json scripts.${name}`, command })),
    ...workflowCommands(workflow),
  ];
}

assertDetectorContract();
const failures = sources().filter(({ command }) => findMaskedSearch(command)).map(({ location, command }) => `${location}: ${command}`);
if (failures.length > 0) {
  console.error("[fail-fast-verification] masking command chains detected:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("[fail-fast-verification] no masking verifier/search command chains found");
