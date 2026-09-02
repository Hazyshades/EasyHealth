import assert from "node:assert/strict";
import {
  buildMeasurementArticleViewModel,
  getPublishedKnowledgeBaseArticleBySlug,
  getPublishedKnowledgeBaseArticleForMeasurementDefinition,
  getPublishedKnowledgeBaseArticleForPanel,
  listPublishedKnowledgeBaseArticles,
  MEASUREMENT_ARTICLES,
  PANEL_ARTICLES,
  validateKnowledgeBaseArticle,
  validateKnowledgeBaseArticleCatalog,
  validateMeasurementArticleCatalog,
  validateMeasurementEducationArticle,
  type KnowledgeBaseArticle,
  type MeasurementEducationArticle,
  type PanelEducationArticle,
} from "../src/lib/knowledge-base";

const source = {
  title: "Synthetic clinical reference",
  publisher: "EasyHealth test fixture",
  url: "https://example.invalid/knowledge-base-reference",
  accessedAt: "2026-09-01T00:00:00Z",
};

const publishedMeasurement: MeasurementEducationArticle = {
  type: "measurement",
  measurementDefinitionKey: "hemoglobin_whole_blood",
  slug: "hemoglobin",
  locale: "en",
  contentVersion: "1.0.0",
  reviewStatus: "published",
  reviewedBy: "Synthetic clinical reviewer",
  reviewedAt: "2026-09-01T00:00:00Z",
  deprecatedAt: null,
  replacementSlug: null,
  title: "Hemoglobin",
  summary: "A factual guide to a hemoglobin measurement in a blood report.",
  whatItMeasures: [
    "Hemoglobin is the oxygen-carrying protein measured in a blood sample.",
  ],
  interpretationFactors: [
    "Interpretation depends on the person's context and the laboratory's report.",
  ],
  sources: [source],
  relatedMeasurementKeys: ["hematocrit_whole_blood", "not-published"],
};

const publishedPanel: PanelEducationArticle = {
  type: "panel",
  panelKey: "cbc",
  slug: "cbc",
  locale: "en",
  contentVersion: "1.0.0",
  reviewStatus: "published",
  reviewedBy: "Synthetic clinical reviewer",
  reviewedAt: "2026-09-01T00:00:00Z",
  deprecatedAt: null,
  replacementSlug: null,
  title: "Complete blood count",
  summary: "A factual guide to the measurements commonly grouped as a CBC.",
  sources: [source],
  relatedMeasurementKeys: ["hematocrit_whole_blood"],
};

const sameSlugPanel: PanelEducationArticle = {
  ...publishedPanel,
  slug: "hemoglobin",
};

const draftMeasurement: MeasurementEducationArticle = {
  ...publishedMeasurement,
  slug: "hemoglobin-draft",
  reviewStatus: "draft",
  reviewedBy: null,
  reviewedAt: null,
};

const inReviewMeasurement: MeasurementEducationArticle = {
  ...publishedMeasurement,
  slug: "hemoglobin-review",
  reviewStatus: "in_review",
  reviewedBy: null,
  reviewedAt: null,
};

const deprecatedMeasurement: MeasurementEducationArticle = {
  ...publishedMeasurement,
  slug: "hemoglobin-legacy",
  reviewStatus: "deprecated",
  reviewedBy: null,
  reviewedAt: null,
  deprecatedAt: "2026-09-01T00:00:00Z",
  replacementSlug: "hemoglobin-current",
};

const httpSourceMeasurement: MeasurementEducationArticle = {
  ...publishedMeasurement,
  sources: [{ ...source, url: "http://example.invalid/insecure" }],
};

const unknownMeasurement = {
  ...publishedMeasurement,
  measurementDefinitionKey: "unknown-definition",
  slug: "unknown-definition",
};

const provisionalMeasurement = {
  ...publishedMeasurement,
  measurementDefinitionKey: "sample_total_protein",
  slug: "total-protein",
};

const unknownPanel = {
  ...publishedPanel,
  panelKey: "unknown-panel",
  slug: "unknown-panel",
};

const unsupportedPanelContent = {
  ...publishedPanel,
  purpose: "Panel-specific fields belong to EH-135.",
};

const duplicateMeasurement = {
  ...publishedMeasurement,
  title: "Duplicate article identity",
};

const unsupportedPrivateField = {
  ...publishedMeasurement,
  profileId: "profile-should-never-be-in-content",
};

const mismatchedSubject = {
  ...publishedMeasurement,
  type: "panel",
  panelKey: "cbc",
};

const unsupportedReviewState = {
  ...publishedMeasurement,
  reviewStatus: "review",
};

const publishedReplacement = {
  ...publishedMeasurement,
  replacementSlug: "another-article",
};

const deprecatedWithoutDate = {
  ...publishedMeasurement,
  reviewStatus: "deprecated",
  reviewedBy: null,
  reviewedAt: null,
  deprecatedAt: null,
};

assert.equal(MEASUREMENT_ARTICLES.length, 0);
assert.equal(PANEL_ARTICLES.length, 0);
assert.equal(validateKnowledgeBaseArticleCatalog().valid, true);
assert.equal(validateKnowledgeBaseArticle(publishedMeasurement).valid, true);
assert.equal(validateKnowledgeBaseArticle(publishedPanel).valid, true);
assert.equal(
  validateMeasurementEducationArticle(publishedMeasurement).valid,
  true,
);
assert.equal(validateMeasurementArticleCatalog().valid, true);

assert.equal(validateKnowledgeBaseArticle(httpSourceMeasurement).valid, false);
assert.equal(validateKnowledgeBaseArticle(unknownMeasurement).valid, false);
assert.equal(validateKnowledgeBaseArticle(provisionalMeasurement).valid, false);
assert.equal(validateKnowledgeBaseArticle(unknownPanel).valid, false);
assert.equal(
  validateKnowledgeBaseArticle(unsupportedPanelContent).valid,
  false,
);
assert.equal(
  validateKnowledgeBaseArticle(unsupportedPrivateField).valid,
  false,
);
assert.equal(validateKnowledgeBaseArticle(mismatchedSubject).valid, false);
assert.equal(validateKnowledgeBaseArticle(unsupportedReviewState).valid, false);
assert.equal(validateKnowledgeBaseArticle(publishedReplacement).valid, false);
assert.equal(validateKnowledgeBaseArticle(deprecatedWithoutDate).valid, false);
assert.equal(
  validateKnowledgeBaseArticleCatalog([
    publishedMeasurement,
    duplicateMeasurement,
  ]).valid,
  false,
);

const mixedCatalog: readonly KnowledgeBaseArticle[] = [
  deprecatedMeasurement,
  inReviewMeasurement,
  publishedPanel,
  draftMeasurement,
  publishedMeasurement,
];
assert.equal(
  validateKnowledgeBaseArticleCatalog(mixedCatalog).valid,
  true,
  validateKnowledgeBaseArticleCatalog(mixedCatalog).errors.join("\n"),
);
assert.deepEqual(
  listPublishedKnowledgeBaseArticles([...mixedCatalog].reverse()).map(
    (article) => `${article.type}:${article.slug}`,
  ),
  ["measurement:hemoglobin", "panel:cbc"],
);

const sameSlugCatalog: readonly KnowledgeBaseArticle[] = [
  publishedMeasurement,
  sameSlugPanel,
];
assert.equal(validateKnowledgeBaseArticleCatalog(sameSlugCatalog).valid, true);
const sameSlugPanelResult = getPublishedKnowledgeBaseArticleBySlug(
  "panel",
  "hemoglobin",
  { articles: sameSlugCatalog },
);
assert.equal(sameSlugPanelResult?.type, "panel");
assert.equal(
  sameSlugPanelResult?.type === "panel"
    ? sameSlugPanelResult.panelKey
    : null,
  "cbc",
);
assert.equal(
  getPublishedKnowledgeBaseArticleBySlug("measurement", "hemoglobin", {
    articles: mixedCatalog,
  })?.type,
  "measurement",
);
assert.equal(
  getPublishedKnowledgeBaseArticleBySlug("panel", "cbc", {
    articles: mixedCatalog,
  })?.type,
  "panel",
);
assert.equal(
  getPublishedKnowledgeBaseArticleBySlug("measurement", "hemoglobin", {
    locale: "ru",
    articles: mixedCatalog,
  }),
  null,
);
assert.equal(
  getPublishedKnowledgeBaseArticleForMeasurementDefinition(
    "hemoglobin_whole_blood",
    { articles: mixedCatalog },
  )?.slug,
  "hemoglobin",
);
assert.equal(
  getPublishedKnowledgeBaseArticleForPanel("cbc", {
    articles: mixedCatalog,
  })?.slug,
  "cbc",
);
assert.deepEqual(
  listPublishedKnowledgeBaseArticles([
    unknownMeasurement as KnowledgeBaseArticle,
  ]),
  [],
);

const measurementModel = buildMeasurementArticleViewModel(
  publishedMeasurement,
  [publishedMeasurement],
);
assert.ok(measurementModel);
assert.equal(
  measurementModel.relatedMeasurements.some(
    (measurement) => measurement.key === "not-published",
  ),
  false,
);

console.log("verify-eh133-knowledge-base: all checks passed");
