import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_DEFINITIONS,
  type MeasurementDefinition,
} from "../src/lib/biomarkers";
import { MEASUREMENT_CATALOG_MANIFEST_DIGEST } from "../src/lib/biomarkers/measurement-registry-release";
import {
  BIOMARKER_DOCUMENT_PATHS,
  buildBiomarkerDocumentation,
  escapeMarkdownCell,
  getBiomarkerDocumentationCounts,
  replaceReadmeSection,
  staleBiomarkerDocumentationFiles,
  validateBiomarkerDocumentationDefinitions,
  validateBiomarkerDocumentationInputs,
  writeBiomarkerDocumentation,
  type DocumentationBaseline,
} from "./generate-biomarker-docs";
import {
  BIOMARKER_WIKI_PAGES,
  renderBiomarkerWiki,
  renderBiomarkerWikiJson,
  writeBiomarkerWiki,
} from "./export-biomarker-wiki";
import { runRegistryV2CandidateCorpusTechnical } from "./lib/registry-v2-candidate-corpus";

const root = process.cwd();
const baseline = JSON.parse(
  readFileSync(resolve(root, "registry/biomarker-registry/v2.0.0/documentation-baseline.json"), "utf8"),
) as DocumentationBaseline;
const technical = runRegistryV2CandidateCorpusTechnical({ root: resolve(root, "registry/candidate-release/v1") });
const first = buildBiomarkerDocumentation(root);
const second = buildBiomarkerDocumentation(root);
const counts = getBiomarkerDocumentationCounts();

assert.deepEqual(first, second, "unchanged runtime inputs must render byte-identically");
assert.equal(first.files.catalog.includes("generation timestamp"), false);
assert.deepEqual(staleBiomarkerDocumentationFiles(root, first), [], "owned output and README section must be current");
assert.equal(baseline.catalog.manifestVersion, MEASUREMENT_CATALOG_MANIFEST_VERSION);
assert.equal(baseline.catalog.manifestDigest, MEASUREMENT_CATALOG_MANIFEST_DIGEST);
assert.deepEqual(counts, baseline.catalog.counts, "runtime catalog counts must match the reviewed baseline");
assert.equal(technical.report.rows.length, baseline.technicalCorpus.rows);
assert.deepEqual(
  Object.fromEntries(Object.entries(technical.report.segments.language).map(([locale, segment]) => [locale, segment.total])),
  baseline.technicalCorpus.rowsByLocale,
);

const definitionKeys = [...first.files.catalog.matchAll(/^### `([^`]+)` — /gm)].map((match) => match[1]!);
assert.equal(definitionKeys.length, baseline.catalog.counts.definitions);
assert.deepEqual([...definitionKeys].sort(), MEASUREMENT_DEFINITIONS.map((definition) => definition.key).sort());
assert.equal(new Set(definitionKeys).size, definitionKeys.length, "every definition must render exactly once");
assert.equal(
  definitionKeys.filter((key) => MEASUREMENT_DEFINITIONS.find((definition) => definition.key === key)?.maturity === "reviewed").length,
  baseline.catalog.counts.reviewedDefinitions,
);
assert.equal(
  definitionKeys.filter((key) => MEASUREMENT_DEFINITIONS.find((definition) => definition.key === key)?.maturity === "provisional").length,
  baseline.catalog.counts.provisionalDefinitions,
);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const aliases = MEASUREMENT_DEFINITIONS.flatMap((definition) => definition.aliases);
const aliasRows = first.files.aliases.split("\n").filter((line) => /^\| [^|]+ \| `[^`]+` \| `[^`]+` \|/.test(line));
assert.equal(aliasRows.length, baseline.catalog.counts.aliases, "every alias must have exactly one full governance row");
for (const alias of aliases) {
  assert.match(first.files.aliases, new RegExp("\\| [^|]+ \\| `" + escapeRegex(alias.measurementDefinitionKey) + "` \\| `" + escapeRegex(alias.key) + "` \\|"));
  assert.match(first.files.catalog, new RegExp("\\[`" + escapeRegex(alias.key) + "`(?:;|\\])"), `catalog must project alias ${alias.key}`);
}
assert.equal(aliases.filter((alias) => alias.locale === "en").length, baseline.catalog.counts.aliasesByLocale.en);
assert.equal(aliases.filter((alias) => alias.locale === "ru").length, baseline.catalog.counts.aliasesByLocale.ru);
assert.equal(aliases.filter((alias) => alias.locale === "es").length, baseline.catalog.counts.aliasesByLocale.es);

const corpusRows = first.files.corpus.split("\n").filter((line) => /^\| [^|]+ \| (en|ru|es) \|/.test(line));
assert.equal(corpusRows.length, baseline.technicalCorpus.rows, "every technical corpus row must be rendered");
assert.equal(technical.report.metrics.expectedClassificationRate, 1);
assert.equal(technical.report.metrics.falseConcreteResolutions, 0);
assert.equal(technical.report.metrics.processingErrors, 0);

assert.match(first.files.catalog, /## Reviewed panel specimen policies/);
assert.match(first.files.catalog, /`cbc_whole_blood`/);
assert.match(first.files.catalog, /specimen_from_reviewed_panel/);
assert.match(first.files.module, /cbc_whole_blood/);
assert.match(first.files.module, /specimen_from_reviewed_panel/);
assert.match(first.files.corpus, /hemoglobin-cbc-heading/);
assert.match(first.files.corpus, /glucose-cbc-heading/);
assert.doesNotMatch(first.files.catalog, /Biochemistry => serum|biochemistry heading.*serum/i);

assert.doesNotMatch(first.files.corpus, /approval|launchable/i, "technical evidence must not expose release approval state");

const reviewed = MEASUREMENT_DEFINITIONS.find((definition) => definition.assessmentBindings.length > 0)!;
const invalidBinding = {
  ...reviewed,
  assessmentBindings: reviewed.assessmentBindings.map((binding) => ({ ...binding, system: undefined })),
} as MeasurementDefinition;
assert.match(validateBiomarkerDocumentationDefinitions([invalidBinding, ...MEASUREMENT_DEFINITIONS.filter((definition) => definition.key !== reviewed.key)]).join("\n"), /missing runtime metadata/);
assert.match(validateBiomarkerDocumentationDefinitions([...MEASUREMENT_DEFINITIONS, { ...MEASUREMENT_DEFINITIONS[0]! }]).join("\n"), /Duplicate measurement definition key/);
const aliasOwner = MEASUREMENT_DEFINITIONS[0]!;
const duplicateAlias = { ...aliasOwner, aliases: [...aliasOwner.aliases, aliasOwner.aliases[0]!] } as MeasurementDefinition;
assert.match(validateBiomarkerDocumentationDefinitions([duplicateAlias, ...MEASUREMENT_DEFINITIONS.filter((definition) => definition.key !== aliasOwner.key)]).join("\n"), /Duplicate alias key/);
const invalidBaseline = structuredClone(baseline);
invalidBaseline.catalog.manifestDigest = "wrong";
assert.throws(
  () => validateBiomarkerDocumentationInputs(MEASUREMENT_DEFINITIONS, counts, invalidBaseline, technical),
  /Baseline manifest digest/,
);
assert.throws(() => replaceReadmeSection("no markers", first.readmeSection), /marker pair/);
assert.equal(escapeMarkdownCell("a|b\nc"), "a\\|b<br>c");

const tempRoot = mkdtempSync(join(root, ".tmp-biomarker-docs-"));
try {
  mkdirSync(resolve(tempRoot, "docs"), { recursive: true });
  writeFileSync(resolve(tempRoot, "docs/README.md"), `before\n<!-- generated-biomarker-docs:start -->\nold\n<!-- generated-biomarker-docs:end -->\nafter\n`, "utf8");
  writeBiomarkerDocumentation(tempRoot, first);
  const generatedReadme = readFileSync(resolve(tempRoot, "docs/README.md"), "utf8");
  assert.match(generatedReadme, /^before\n/);
  assert.match(generatedReadme, /\nafter\n$/);
  for (const path of Object.values(BIOMARKER_DOCUMENT_PATHS)) {
    writeFileSync(resolve(tempRoot, path), `${readFileSync(resolve(tempRoot, path), "utf8")}stale\n`, "utf8");
  }
  writeFileSync(resolve(tempRoot, "docs/README.md"), generatedReadme.replace("Generated biomarker reference data", "Stale biomarker reference data"), "utf8");
  const staleBefore = readFileSync(resolve(tempRoot, "docs/README.md"), "utf8");
  assert.deepEqual(
    staleBiomarkerDocumentationFiles(tempRoot, first),
    [...Object.values(BIOMARKER_DOCUMENT_PATHS), "docs/README.md (managed biomarker section)"],
    "check must report every stale owned surface",
  );
  assert.equal(readFileSync(resolve(tempRoot, "docs/README.md"), "utf8"), staleBefore, "stale checking must not mutate README");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

const wikiFirst = renderBiomarkerWiki(root);
const wikiSecond = renderBiomarkerWiki(root);
assert.deepEqual(wikiFirst, wikiSecond, "unchanged canonical docs must render byte-stable Wiki pages");
assert.deepEqual(Object.keys(wikiFirst), [...BIOMARKER_WIKI_PAGES]);
assert.equal(renderBiomarkerWikiJson(root), renderBiomarkerWikiJson(root));
const wikiStagingRoot = mkdtempSync(join(root, ".tmp-biomarker-wiki-"));
try {
  const output = resolve(wikiStagingRoot, "staging");
  writeBiomarkerWiki(output, root);
  assert.deepEqual(readdirSync(output).sort(), [...BIOMARKER_WIKI_PAGES].sort());
  for (const page of BIOMARKER_WIKI_PAGES) {
    assert.equal(readFileSync(resolve(output, page), "utf8"), wikiFirst[page]);
  }
  assert.throws(() => writeBiomarkerWiki(output, root), /must be empty/);
} finally {
  rmSync(wikiStagingRoot, { recursive: true, force: true });
}

console.log("verify-biomarker-docs: all checks passed");
