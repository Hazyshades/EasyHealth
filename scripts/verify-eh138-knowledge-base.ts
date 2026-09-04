import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getKnowledgeArticleByMeasurementKey,
  getKnowledgeArticleBySlug,
  getKnowledgePanel,
  listKnowledgePanels,
  listPublishedKnowledgeArticles,
  searchKnowledgeEntries,
} from "../src/lib/knowledge-base";
import { getKnowledgeArticleHref } from "../src/lib/knowledge-base/links";

const articles = listPublishedKnowledgeArticles();
assert.equal(
  articles.length,
  11,
  "the initial reviewed article set should be stable",
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
assert.deepEqual(hemoglobin?.record.relatedPanelKeys, ["cbc"]);
assert.ok(hemoglobin?.panels.some((panel) => panel.key === "cbc"));
assert.ok(hemoglobin?.panels.some((panel) => panel.key === "iron_studies"));
assert.match(
  readFileSync("src/components/knowledge-base/measurement-article.tsx", "utf8"),
  /relatedPanelKeys/,
);
assert.match(
  readFileSync("src/components/knowledge-base/measurement-article.tsx", "utf8"),
  /Panel membership/,
);

const knowledgeSource = [
  "src/app/knowledge/layout.tsx",
  "src/app/knowledge/page.tsx",
  "src/app/knowledge/biomarkers/[slug]/page.tsx",
  "src/app/knowledge/panels/[key]/page.tsx",
  "src/components/knowledge-base/knowledge-header.tsx",
  "src/components/knowledge-base/measurement-article.tsx",
  "src/components/knowledge-base/panel-article.tsx",
  "src/lib/knowledge-base/articles.ts",
  "src/lib/knowledge-base/catalog.ts",
  "src/lib/knowledge-base/links.ts",
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

assert.doesNotMatch(
  knowledgeSource,
  /supabase|fetch\s*\(|\/api\/(?:profile|biomarkers|documents|health-profile)/i,
);
assert.doesNotMatch(
  knowledgeSource,
  /profileId|observationId|documentId|sourceDocumentId/,
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
  readFileSync("src/components/biomarker-table.tsx", "utf8"),
  /getKnowledgeArticleHref/,
);
assert.match(
  readFileSync("src/components/knowledge-base/measurement-article.tsx", "utf8"),
  /\/app\/biomarkers\?measurement=/,
);

console.log("verify-eh138-knowledge-base: all checks passed");
