import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ALIAS_MAP } from "../src/lib/biomarkers/normalize";
import { BIOMARKER_DEFINITIONS } from "../src/lib/biomarkers/catalog/definitions";
import {
  buildRegistryV1Baseline,
  canonicalJson,
  compareStableStrings,
  getRegistryV1BaselinePaths,
  verifyRegistryV1Baseline,
  verifyRegistryV1Snapshot,
} from "./lib/registry-v1-baseline";

const first = buildRegistryV1Baseline();
const second = buildRegistryV1Baseline();

assert.equal(canonicalJson(first.registry), canonicalJson(second.registry), "baseline registry must be deterministic");
assert.equal(first.manifest.contentDigests.registryJson, second.manifest.contentDigests.registryJson);
assert.equal(compareStableStrings("z", "\u00e4"), -1, "baseline ordering must not use locale-sensitive collation");
assert.ok(first.registry.effectiveAliasMap.length > 0, "effective Map entries must be serialized explicitly");
assert.notEqual(JSON.stringify(ALIAS_MAP), canonicalJson(first.registry.effectiveAliasMap).trim(), "Map JSON serialization must not be used");
assert.equal(verifyRegistryV1Snapshot(first.registry).length, 0);
assert.equal(verifyRegistryV1Snapshot(first.registry, BIOMARKER_DEFINITIONS.slice(1)).some((error) => error.includes("unknown canonical key")), true);

assert.throws(
  () => buildRegistryV1Baseline({ definitions: [BIOMARKER_DEFINITIONS[0]!, BIOMARKER_DEFINITIONS[0]!] }),
  /Duplicate canonical biomarker key/
);

const changedAliases = new Map(ALIAS_MAP);
changedAliases.set("neutrophils", "neutrophils_percent");
const changed = buildRegistryV1Baseline({ aliasMap: changedAliases });
assert.notEqual(
  canonicalJson(first.registry),
  canonicalJson(changed.registry),
  "effective alias outcome changes must affect the baseline"
);
assert.equal(
  changed.registry.effectiveAliasMap.find((entry) => entry.alias === "neutrophils")?.canonicalKey,
  "neutrophils_percent"
);

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "easyhealth-registry-v1-"));
const temporaryPaths = getRegistryV1BaselinePaths(temporaryRoot);
mkdirSync(temporaryPaths.directory, { recursive: true });
writeFileSync(temporaryPaths.registry, first.files["registry.json"], "utf8");
writeFileSync(temporaryPaths.resolverCases, first.files["resolver-cases.json"], "utf8");
writeFileSync(temporaryPaths.manifest, first.files["manifest.json"], "utf8");
writeFileSync(temporaryPaths.audit, first.files["AUDIT.md"], "utf8");
assert.deepEqual(verifyRegistryV1Baseline(temporaryRoot), []);
writeFileSync(temporaryPaths.audit, `${first.files["AUDIT.md"]}\nStale audit summary.\n`, "utf8");
assert.ok(
  verifyRegistryV1Baseline(temporaryRoot).some((error) => error.includes("Stale baseline artifact") && error.includes("AUDIT.md")),
  "stale audit content must fail read-only baseline verification"
);
rmSync(temporaryRoot, { recursive: true, force: true });

assert.deepEqual(verifyRegistryV1Baseline(), [], "committed Registry v1 baseline must be current");

console.log("verify-registry-v1-baseline: all checks passed");
