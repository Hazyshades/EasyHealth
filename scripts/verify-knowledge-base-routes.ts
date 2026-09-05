import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  KNOWLEDGE_BASE_ROUTE,
  getDeprecatedKnowledgeBaseRedirect,
  getKnowledgeBaseArticle,
  getPublicPanelEducationArticle,
  publicMeasurementArticlePath,
  resolveLegacyKnowledgeBasePath,
} from "../src/lib/knowledge-base";

assert.equal(KNOWLEDGE_BASE_ROUTE, "/knowledge");
assert.equal(
  publicMeasurementArticlePath("hemoglobin"),
  "/knowledge/biomarkers/hemoglobin",
);
assert.equal(
  publicMeasurementArticlePath("alt"),
  "/knowledge/biomarkers/alt",
);
assert.equal(
  resolveLegacyKnowledgeBasePath("hemoglobin"),
  "/knowledge/biomarkers/hemoglobin",
);
assert.equal(resolveLegacyKnowledgeBasePath("missing-slug"), "/knowledge");
assert.equal(resolveLegacyKnowledgeBasePath("cbc"), "/knowledge");
assert.equal(
  resolveLegacyKnowledgeBasePath("alt"),
  "/knowledge/biomarkers/alt",
);

const indexRedirect = readFileSync("src/app/knowledge-base/page.tsx", "utf8");
assert.match(indexRedirect, /permanentRedirect/);
assert.match(indexRedirect, /KNOWLEDGE_BASE_ROUTE/);
assert.doesNotMatch(indexRedirect, /listPublicKnowledgeBaseArticles/);

const slugRedirect = readFileSync(
  "src/app/knowledge-base/[slug]/page.tsx",
  "utf8",
);
assert.match(slugRedirect, /permanentRedirect/);
assert.match(slugRedirect, /resolveLegacyKnowledgeBasePath/);
assert.doesNotMatch(slugRedirect, /KnowledgeArticlePage/);

const publicMeasurement = readFileSync(
  "src/app/knowledge/biomarkers/[slug]/page.tsx",
  "utf8",
);
assert.match(publicMeasurement, /KnowledgeArticlePage/);
assert.match(publicMeasurement, /adapter=\"public\"/);
assert.doesNotMatch(publicMeasurement, /\/api\/biomarkers/);

const signedInMeasurement = readFileSync(
  "src/app/app/knowledge/measurements/[slug]/page.tsx",
  "utf8",
);
assert.match(signedInMeasurement, /getKnowledgeArticle/);
assert.match(signedInMeasurement, /SignedInMeasurementResultsStrip/);
assert.match(signedInMeasurement, /notFound\(\)/);

const signedInCbc = readFileSync(
  "src/app/app/knowledge/panels/cbc/page.tsx",
  "utf8",
);
assert.match(signedInCbc, /KnowledgeArticlePage/);
assert.match(signedInCbc, /adapter=\"signed-in\"/);
assert.match(signedInCbc, /\/api\/biomarkers/);
assert.equal(getPublicPanelEducationArticle("cbc"), null);

const publicIndex = readFileSync("src/app/knowledge/page.tsx", "utf8");
assert.match(publicIndex, /searchKnowledgeEntries/);
const signedInHome = readFileSync("src/app/app/knowledge/page.tsx", "utf8");
assert.doesNotMatch(signedInHome, /KnowledgeArticlePage/);

const unknown = getKnowledgeBaseArticle("not-an-article");
assert.equal(unknown, null);
assert.equal(
  getDeprecatedKnowledgeBaseRedirect({
    slug: "legacy",
    type: "biomarker",
    locale: "en",
    contentVersion: 1,
    title: "Legacy",
    summary: "Legacy",
    body: "Legacy",
    state: "deprecated",
    sources: [],
    deprecation: {
      deprecatedAt: "2026-08-01T00:00:00.000Z",
      replacementSlug: "hemoglobin",
    },
  }),
  "/knowledge/biomarkers/hemoglobin",
);

console.log("verify-knowledge-base-routes: all checks passed");
