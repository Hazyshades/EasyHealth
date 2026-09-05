import assert from "node:assert/strict";
import {
  getKnowledgeArticleHref,
  getPanelArticleBySlug,
  getPublicPanelEducationArticle,
  listPublishedKnowledgeBaseArticles,
  validateKnowledgeBaseArticleCatalog,
  mapMarkdownLifecycle,
} from "../src/lib/knowledge-base";
import { getPublishedHrefProjection } from "../src/lib/knowledge-base/markdown-adapter";
import { getKnowledgeArticle } from "../src/lib/knowledge-base/content";

assert.equal(validateKnowledgeBaseArticleCatalog().valid, true);
assert.equal(mapMarkdownLifecycle("review"), "in_review");
assert.equal(mapMarkdownLifecycle("published"), "published");

const published = listPublishedKnowledgeBaseArticles();
assert.equal(
  published.filter((article) => article.type === "measurement").length,
  10,
);
assert.equal(
  published.some((article) => article.type === "panel"),
  false,
  "in-review CBC must not appear in the public catalog projection",
);

assert.equal(getPublicPanelEducationArticle("cbc"), null);
assert.equal(getPanelArticleBySlug("cbc")?.reviewStatus, "in_review");

assert.equal(
  getKnowledgeArticleHref("hemoglobin_whole_blood"),
  "/knowledge/biomarkers/hemoglobin",
);
assert.ok(getKnowledgeArticle("hemoglobin"));

const staleAsOf = new Date("2028-01-01T00:00:00.000Z");
assert.equal(
  getKnowledgeArticleHref("hemoglobin_whole_blood", { asOf: staleAsOf }),
  null,
);
assert.equal(getKnowledgeArticle("hemoglobin", { asOf: staleAsOf }), null);
assert.equal(Object.keys(getPublishedHrefProjection({ asOf: staleAsOf })).length, 0);

const duplicate = validateKnowledgeBaseArticleCatalog([
  published[0],
  published[0],
]);
assert.equal(duplicate.valid, false);
assert.ok(
  duplicate.errors.some((error) => error.includes("duplicate article identity")),
);

console.log("verify-knowledge-base-catalog: all checks passed");
