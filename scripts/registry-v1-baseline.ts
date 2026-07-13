import { mkdirSync, writeFileSync } from "node:fs";
import {
  buildRegistryV1Baseline,
  getRegistryV1BaselinePaths,
  verifyRegistryV1Baseline,
} from "./lib/registry-v1-baseline";

const mode = process.argv[2];

if (mode !== "--write" && mode !== "--check") {
  console.error("Usage: tsx scripts/registry-v1-baseline.ts --write|--check");
  process.exit(1);
}

if (mode === "--check") {
  const errors = verifyRegistryV1Baseline();
  if (errors.length) {
    console.error("Registry v1 baseline check failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("registry-v1-baseline: artifacts are current");
  process.exit(0);
}

const artifacts = buildRegistryV1Baseline();
const paths = getRegistryV1BaselinePaths();
mkdirSync(paths.directory, { recursive: true });
writeFileSync(paths.registry, artifacts.files["registry.json"], "utf8");
writeFileSync(paths.resolverCases, artifacts.files["resolver-cases.json"], "utf8");
writeFileSync(paths.manifest, artifacts.files["manifest.json"], "utf8");
writeFileSync(paths.audit, artifacts.files["AUDIT.md"], "utf8");
console.log(`registry-v1-baseline: wrote ${paths.directory}`);
