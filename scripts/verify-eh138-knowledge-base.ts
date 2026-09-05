import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getKnowledgeArticleByMeasurementKey,
  getKnowledgeArticleBySlug,
  getKnowledgePanel,
  listKnowledgePanels,
  listPublishedKnowledgeArticles,
  projectKnowledgeEducationCategory,
  projectKnowledgeRelatedPanelKeys,
  searchKnowledgeEntries,
} from "../src/lib/knowledge-base/navigation";
import { getKnowledgeArticleHref } from "../src/lib/knowledge-base/links";

const EXPECTED_ROSTER = [
  {
    slug: "hemoglobin",
    category: "blood",
    relatedPanelKeys: ["cbc", "iron_studies"],
  },
  { slug: "hematocrit", category: "blood", relatedPanelKeys: ["cbc"] },
  {
    slug: "white-blood-cell-count",
    category: "blood",
    relatedPanelKeys: ["cbc"],
  },
  { slug: "platelet-count", category: "blood", relatedPanelKeys: ["cbc"] },
  { slug: "mcv", category: "blood", relatedPanelKeys: ["cbc"] },
  { slug: "glucose", category: "metabolic", relatedPanelKeys: [] },
  { slug: "hba1c", category: "metabolic", relatedPanelKeys: [] },
  { slug: "tsh", category: "thyroid", relatedPanelKeys: ["thyroid"] },
  { slug: "alt", category: "liver", relatedPanelKeys: ["liver"] },
  { slug: "creatinine-egfr", category: "kidney", relatedPanelKeys: ["kidney"] },
] as const;

const articles = listPublishedKnowledgeArticles();
assert.equal(
  articles.length,
  10,
  "the published Knowledge Base roster should stay aligned with EH-136",
);
for (const article of articles) {
  assert.equal(article.record.review.status, "published");
  assert.ok(article.record.contentVersion);
  assert.ok(article.record.review.reviewedBy);
  assert.ok(article.record.review.reviewedAt);
  assert.ok(article.record.sources.length);
  assert.equal(article.definition.maturity, "reviewed");
  assert.equal(article.definition.sourceProvenance.kind, "registry_v2_review");
}

for (const expected of EXPECTED_ROSTER) {
  const article = getKnowledgeArticleBySlug(expected.slug);
  assert.ok(article, `${expected.slug} should remain published`);
  assert.equal(article.record.category, expected.category);
  assert.deepEqual(
    [...article.record.relatedPanelKeys],
    [...expected.relatedPanelKeys],
  );
  assert.deepEqual(
    article.panels.map((panel) => panel.key),
    [...expected.relatedPanelKeys],
  );
}

const hemoglobinCanonical = searchKnowledgeEntries({ query: "Hemoglobin" });
assert.equal(hemoglobinCanonical[0]?.kind, "measurement");
if (hemoglobinCanonical[0]?.kind === "measurement") {
  assert.equal(hemoglobinCanonical[0].article.record.slug, "hemoglobin");
  assert.equal(hemoglobinCanonical[0].matchKind, "canonical");
}

const hemoglobinAlias = searchKnowledgeEntries({ query: "HGB" });
assert.equal(hemoglobinAlias[0]?.kind, "measurement");
if (hemoglobinAlias[0]?.kind === "measurement") {
  assert.equal(hemoglobinAlias[0].article.record.slug, "hemoglobin");
  assert.equal(hemoglobinAlias[0].matchKind, "alias");
  assert.equal(hemoglobinAlias[0].matchedTerm, "hgb");
}

const normalizedAlias = searchKnowledgeEntries({ query: "гемоглобин hgb" });
assert.equal(normalizedAlias[0]?.kind, "measurement");
if (normalizedAlias[0]?.kind === "measurement") {
  assert.equal(normalizedAlias[0].article.record.slug, "hemoglobin");
}

assert.deepEqual(searchKnowledgeEntries({ query: "2026" }), []);
assert.equal(searchKnowledgeEntries({ query: "" }).length, articles.length);

const bloodArticles = searchKnowledgeEntries({ category: "blood" });
assert.ok(bloodArticles.length > 0);
assert.ok(
  bloodArticles.every(
    (result) =>
      result.kind === "measurement" &&
      result.article.record.category === "blood",
  ),
);
assert.ok(
  bloodArticles.some(
    (result) =>
      result.kind === "measurement" && result.article.record.slug === "hemoglobin",
  ),
);

const metabolicArticles = searchKnowledgeEntries({ category: "metabolic" });
assert.ok(
  metabolicArticles.some(
    (result) =>
      result.kind === "measurement" && result.article.record.slug === "glucose",
  ),
);
assert.ok(
  metabolicArticles.some(
    (result) =>
      result.kind === "measurement" && result.article.record.slug === "hba1c",
  ),
);

const cbcResults = searchKnowledgeEntries({ panel: "cbc" });
assert.ok(cbcResults.length > 0);
assert.ok(
  cbcResults.every(
    (result) =>
      result.kind === "measurement" &&
      result.article.panels.some((panel) => panel.key === "cbc"),
  ),
);
assert.ok(
  cbcResults.every(
    (result) =>
      result.kind !== "measurement" ||
      result.article.definition.key !== "glucose_serum",
  ),
);
assert.ok(
  !cbcResults.some(
    (result) =>
      result.kind === "measurement" && result.article.record.slug === "glucose",
  ),
);

assert.equal(
  projectKnowledgeEducationCategory(["hemoglobin_whole_blood"]),
  "blood",
);
assert.equal(projectKnowledgeEducationCategory(["glucose_serum"]), "metabolic");
assert.equal(
  projectKnowledgeEducationCategory(["unpublished_definition"]),
  null,
);
assert.equal(projectKnowledgeEducationCategory([]), null);
assert.throws(
  () =>
    projectKnowledgeEducationCategory([
      "hemoglobin_whole_blood",
      "glucose_serum",
    ]),
  /conflicting named Body systems/,
);
assert.deepEqual(projectKnowledgeRelatedPanelKeys(["glucose_serum"]), []);
assert.deepEqual(
  [...projectKnowledgeRelatedPanelKeys(["hemoglobin_whole_blood"])],
  ["cbc", "iron_studies"],
);

const cbc = getKnowledgePanel("cbc");
assert.ok(cbc);
assert.equal(
  cbc.members[0]?.measurementDefinitionKey,
  "hemoglobin_whole_blood",
);
assert.ok(cbc.members.some((member) => member.role === "required"));
assert.ok(cbc.members.some((member) => member.role === "optional"));
assert.equal(listKnowledgePanels().length, 6);
assert.equal(getKnowledgePanel("not-a-panel"), null);

const hemoglobin = getKnowledgeArticleBySlug("hemoglobin");
assert.ok(hemoglobin);
assert.equal(
  getKnowledgeArticleHref("hemoglobin_whole_blood"),
  "/knowledge/biomarkers/hemoglobin",
);
assert.equal(
  getKnowledgeArticleByMeasurementKey("hemoglobin_whole_blood")?.record.slug,
  "hemoglobin",
);
assert.equal(
  getKnowledgeArticleByMeasurementKey("unpublished_definition"),
  null,
);
assert.equal(getKnowledgeArticleHref("unpublished_definition"), null);
assert.equal(getKnowledgeArticleBySlug("not-published"), null);
assert.equal(getKnowledgeArticleBySlug("toString"), null);
assert.equal(getKnowledgePanel("toString"), null);
assert.equal(getKnowledgeArticleHref("toString"), null);
assert.ok(
  hemoglobin?.record.sources.every((source) => /^https:\/\//.test(source.href)),
);
assert.ok(hemoglobin?.record.relatedPanelKeys.includes("cbc"));
assert.ok(hemoglobin?.panels.some((panel) => panel.key === "cbc"));
assert.ok(hemoglobin?.panels.some((panel) => panel.key === "iron_studies"));
assert.match(
  readFileSync("src/components/knowledge-base/biomarker-article.tsx", "utf8"),
  /getKnowledgeArticleBySlug\(article\.slug\)\?\.panels/,
);
assert.match(
  readFileSync("src/components/knowledge-base/biomarker-article.tsx", "utf8"),
  /Panel membership/,
);

const knowledgeSource = [
  "src/app/knowledge/layout.tsx",
  "src/app/knowledge/page.tsx",
  "src/app/knowledge/biomarkers/[slug]/page.tsx",
  "src/app/knowledge/panels/[key]/page.tsx",
  "src/components/knowledge-base/knowledge-header.tsx",
  "src/components/knowledge-base/biomarker-article.tsx",
  "src/components/knowledge-base/panel-article.tsx",
  "src/lib/knowledge-base/navigation-types.ts",
  "src/lib/knowledge-base/navigation.ts",
  "src/lib/knowledge-base/links.ts",
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

assert.doesNotMatch(knowledgeSource, /CATEGORY_BY_SLUG|RELATED_PANEL_KEYS_BY_SLUG/);
assert.doesNotMatch(
  knowledgeSource,
  /supabase|fetch\s*\(|\/api\/(?:profile|biomarkers|documents|health-profile)/i,
);
assert.doesNotMatch(
  knowledgeSource,
  /profileId|observationId|documentId|sourceDocumentId/,
);
assert.doesNotMatch(
  readFileSync("src/lib/knowledge-base/types.ts", "utf8"),
  /\bscoreRole\b|\breadiness\b|\bsystem:\s/,
);
assert.match(
  readFileSync("src/app/knowledge/page.tsx", "utf8"),
  /method="get"/,
);
assert.match(readFileSync("src/app/knowledge/page.tsx", "utf8"), /name="q"/);
assert.match(
  readFileSync("src/app/knowledge/page.tsx", "utf8"),
  /name="panel"/,
);
assert.match(
  readFileSync("src/app/knowledge/page.tsx", "utf8"),
  /searchKnowledgeEntries/,
);
assert.match(
  readFileSync("src/components/biomarker-table.tsx", "utf8"),
  /getKnowledgeArticleHref/,
);
assert.match(
  readFileSync("src/components/knowledge-base/biomarker-article.tsx", "utf8"),
  /measurement:\s*definition\.key/,
);

console.log("verify-eh138-knowledge-base: all checks passed");
