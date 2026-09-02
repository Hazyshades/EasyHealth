import assert from "node:assert/strict";
import {
  getKnowledgeArticle,
  getKnowledgeArticlePath,
  listPublishedKnowledgeArticleRecords,
  validateKnowledgeBaseManifest,
} from "../src/lib/knowledge-base/content";

const EXPECTED_ROSTER = [
  {
    slug: "hemoglobin",
    measurementDefinitionKeys: ["hemoglobin_whole_blood"],
    panelKeys: ["cbc", "iron_studies"],
  },
  {
    slug: "hematocrit",
    measurementDefinitionKeys: ["hematocrit_whole_blood"],
    panelKeys: ["cbc"],
  },
  {
    slug: "white-blood-cell-count",
    measurementDefinitionKeys: ["wbc_whole_blood"],
    panelKeys: ["cbc"],
  },
  {
    slug: "platelet-count",
    measurementDefinitionKeys: ["platelets_whole_blood"],
    panelKeys: ["cbc"],
  },
  {
    slug: "mcv",
    measurementDefinitionKeys: ["mcv_whole_blood"],
    panelKeys: ["cbc"],
  },
  {
    slug: "glucose",
    measurementDefinitionKeys: ["glucose_serum", "glucose_plasma", "glucose_whole_blood"],
    panelKeys: [],
  },
  {
    slug: "hba1c",
    measurementDefinitionKeys: ["hba1c_whole_blood"],
    panelKeys: [],
  },
  {
    slug: "tsh",
    measurementDefinitionKeys: ["tsh_serum"],
    panelKeys: ["thyroid"],
  },
  {
    slug: "alt",
    measurementDefinitionKeys: ["alt_serum_catalytic_activity"],
    panelKeys: ["liver"],
  },
  {
    slug: "creatinine-egfr",
    measurementDefinitionKeys: ["creatinine_serum", "egfr"],
    panelKeys: ["kidney"],
  },
] as const;

const REQUIRED_HEADINGS = [
  "What it measures",
  "Aliases",
  "Common units",
  "Specimen",
  "Panel membership",
  "Related measurements",
  "Interpretation factors",
  "Sources",
] as const;

const UNSAFE_COPY_PATTERNS = [
  {
    label: "universal range claim",
    pattern: /\b(?:the|a|an|normal|healthy|standard|typical)\s+(?:reference\s+)?range\s+(?:is|are|of|:)?\s*\d/i,
  },
  {
    label: "diagnostic conclusion",
    pattern: /\b(?:this|that|the|your)\s+(?:result|value|number|test)\s+(?:means|shows|confirms|proves|indicates)\s+(?:you have|a diagnosis|disease|diabetes|kidney disease)/i,
  },
  {
    label: "treatment instruction",
    pattern: /\b(?:take|stop|start|change|adjust|increase|decrease)\s+(?:your\s+)?(?:medication|medicine|treatment|dose|supplement|insulin|drug)s?\b/i,
  },
  {
    label: "test-order prompt",
    pattern: /\b(?:order|request|schedule)\s+(?:a|an|the)?\s*(?:test|lab|blood test)\b/i,
  },
] as const;

const errors = validateKnowledgeBaseManifest();
assert.deepEqual(errors, [], errors.join("\n"));

const published = listPublishedKnowledgeArticleRecords();
assert.equal(published.length, EXPECTED_ROSTER.length, "EH-136 must expose exactly ten published records");
assert.deepEqual(
  published.map((article) => article.slug),
  EXPECTED_ROSTER.map((article) => article.slug),
  "published articles must use the deterministic EH-136 order",
);

const seenPaths = new Set<string>();
for (const [index, expected] of EXPECTED_ROSTER.entries()) {
  const record = published[index];
  assert.ok(record, `missing roster record at index ${index}`);
  assert.equal(record.slug, expected.slug);
  assert.equal(record.locale, "en");
  assert.equal(record.status, "published");
  assert.equal(record.reviewStatus, "reviewed");
  assert.match(record.contentVersion, /^\d+\.\d+\.\d+$/);
  assert.notEqual(record.reviewedBy.trim(), "");
  assert.match(record.reviewedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(record.sourceIds.length > 0, `${record.slug} must cite at least one source`);
  assert.ok(
    record.measurementDefinitionKeys.length > 0,
    `${record.slug} must reference at least one Registry definition`,
  );
  assert.deepEqual(record.measurementDefinitionKeys, expected.measurementDefinitionKeys);
  assert.deepEqual(record.panelKeys, expected.panelKeys);

  const article = getKnowledgeArticle(record.slug);
  assert.ok(article, `${record.slug} must have a published article body`);
  assert.equal(article.body.trim().length > 0, true);
  assert.deepEqual(
    article.measurementDefinitions.map((definition) => definition.key),
    expected.measurementDefinitionKeys,
  );
  assert.equal(article.sources.length, record.sourceIds.length);
  assert.equal(article.panels.length, record.panelKeys.length);

  for (const heading of REQUIRED_HEADINGS) {
    const headingPattern = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
    assert.match(article.body, headingPattern, `${record.slug} is missing heading: ${heading}`);
  }

  for (const { label, pattern } of UNSAFE_COPY_PATTERNS) {
    assert.doesNotMatch(article.body, pattern, `${record.slug} contains an unsafe ${label}`);
  }

  const articlePath = getKnowledgeArticlePath(record.slug);
  assert.equal(seenPaths.has(articlePath), false, `duplicate public path: ${articlePath}`);
  seenPaths.add(articlePath);
}

assert.equal(getKnowledgeArticle("not-an-eh136-page"), null, "unpublished or unknown slugs must not load");
assert.deepEqual(
  [...seenPaths],
  EXPECTED_ROSTER.map((article) => getKnowledgeArticlePath(article.slug)),
  "public paths must remain deterministic",
);

console.log(`EH-136 Knowledge Base verification passed: ${published.length} pages`);
for (const article of published) console.log(`- ${article.slug}`);
