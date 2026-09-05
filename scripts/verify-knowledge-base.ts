import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KnowledgeArticlePage } from "../src/components/knowledge-base/knowledge-article-page";
import {
  getKnowledgeArticle,
  listPublishedKnowledgeArticleRecords,
} from "../src/lib/knowledge-base/content";
import {
  buildKnowledgeBaseStaleReport,
  findPublicKnowledgeBaseArticle,
  getKnowledgeBasePublicationDecision,
  isValidKnowledgeBaseTimestamp,
  resolveKnowledgeBaseDeprecatedRedirect,
  validateKnowledgeBaseArticles,
} from "../src/lib/knowledge-base/publication";
import type { KnowledgeBaseArticle } from "../src/lib/knowledge-base/publication-types";

const AS_OF = new Date("2026-09-01T00:00:00.000Z");
const SOURCE = {
  title: "Synthetic source for governance verification",
  url: "https://example.test/knowledge-base-source",
  publisher: "Verification fixture",
} as const;

const BASE_ARTICLE: KnowledgeBaseArticle = {
  slug: "hemoglobin",
  type: "biomarker",
  locale: "en",
  contentVersion: 1,
  title: "Hemoglobin",
  summary: "A synthetic article used to verify publication metadata.",
  body: "## Overview\n\nThis fixture contains factual placeholder text only.",
  state: "published",
  reviewedBy: "Synthetic reviewer",
  reviewedAt: "2026-08-01T00:00:00.000Z",
  sources: [SOURCE],
};

function article(
  overrides: Partial<KnowledgeBaseArticle> = {},
): KnowledgeBaseArticle {
  return { ...BASE_ARTICLE, ...overrides };
}

const valid = validateKnowledgeBaseArticles([BASE_ARTICLE], { asOf: AS_OF });
assert.equal(valid.valid, true, valid.errors.join(" | "));
assert.deepEqual(valid.staleReport.staleArticles, []);
assert.equal(
  getKnowledgeBasePublicationDecision(BASE_ARTICLE, { asOf: AS_OF }).public,
  true,
);
const publicBaseArticle = findPublicKnowledgeBaseArticle(
  [BASE_ARTICLE],
  BASE_ARTICLE.slug,
  { asOf: AS_OF },
);
if (!publicBaseArticle)
  throw new Error("Expected the base fixture to be public");
assert.equal(publicBaseArticle.slug, "hemoglobin");

for (const state of ["draft", "review"] as const) {
  const nonPublic = article({
    state,
    reviewedBy: null,
    reviewedAt: null,
    sources: [],
  });
  assert.equal(
    getKnowledgeBasePublicationDecision(nonPublic, { asOf: AS_OF }).public,
    false,
    `${state} article must not publish`,
  );
  assert.equal(
    findPublicKnowledgeBaseArticle([nonPublic], nonPublic.slug, {
      asOf: AS_OF,
    }),
    null,
  );
}

const missingEvidence = validateKnowledgeBaseArticles(
  [article({ reviewedBy: null, reviewedAt: null, sources: [] })],
  { asOf: AS_OF },
);
assert.equal(missingEvidence.valid, false);
assert.ok(
  missingEvidence.errors.some((message) =>
    message.includes("requires reviewedBy"),
  ),
);
assert.ok(
  missingEvidence.errors.some((message) =>
    message.includes("requires reviewedAt"),
  ),
);
assert.ok(
  missingEvidence.errors.some((message) =>
    message.includes("requires at least one source"),
  ),
);

const invalidSource = validateKnowledgeBaseArticles(
  [
    article({
      sources: [{ title: "Insecure", url: "http://example.test/source" }],
    }),
  ],
  { asOf: AS_OF },
);
assert.equal(invalidSource.valid, false);
assert.ok(
  invalidSource.errors.some((message) => message.includes("valid HTTPS URL")),
);
const invalidIdentity = article({ slug: "Not Valid" });
assert.equal(
  getKnowledgeBasePublicationDecision(invalidIdentity, { asOf: AS_OF }).public,
  false,
);
assert.equal(
  findPublicKnowledgeBaseArticle([invalidIdentity], invalidIdentity.slug, {
    asOf: AS_OF,
  }),
  null,
);
assert.equal(isValidKnowledgeBaseTimestamp("2026-02-31T00:00:00.000Z"), false);
assert.equal(
  isValidKnowledgeBaseTimestamp("2026-08-01T00:00:00+00:00"),
  true,
);
assert.equal(
  isValidKnowledgeBaseTimestamp("2026-08-01T03:00:00+03:00"),
  true,
);
const offsetReviewed = article({
  slug: "offset-hemoglobin",
  reviewedAt: "2026-08-01T00:00:00+00:00",
});
assert.equal(
  getKnowledgeBasePublicationDecision(offsetReviewed, { asOf: AS_OF }).public,
  true,
);
assert.equal(
  validateKnowledgeBaseArticles([offsetReviewed], { asOf: AS_OF }).valid,
  true,
);
assert.equal(
  findPublicKnowledgeBaseArticle(
    [BASE_ARTICLE, article({ slug: "Invalid Slug" })],
    BASE_ARTICLE.slug,
    { asOf: AS_OF },
  ),
  null,
);

const stale = article({
  slug: "stale-article",
  reviewedAt: "2025-08-31T00:00:00.000Z",
});
const staleReport = buildKnowledgeBaseStaleReport([stale], { asOf: AS_OF });
assert.equal(staleReport.staleArticles.length, 1);
assert.equal(staleReport.staleArticles[0]?.slug, "stale-article");
assert.equal(
  getKnowledgeBasePublicationDecision(stale, { asOf: AS_OF }).reason,
  "stale",
);
assert.equal(
  findPublicKnowledgeBaseArticle([stale], stale.slug, { asOf: AS_OF }),
  null,
);
assert.ok(
  validateKnowledgeBaseArticles([stale], { asOf: AS_OF }).errors.some(
    (message) => message.includes("review is stale"),
  ),
);

const boundary = article({
  slug: "boundary-article",
  reviewedAt: "2025-09-01T00:00:00.000Z",
});
assert.deepEqual(
  buildKnowledgeBaseStaleReport([boundary], { asOf: AS_OF }).staleArticles,
  [],
);
assert.equal(
  getKnowledgeBasePublicationDecision(boundary, { asOf: AS_OF }).public,
  true,
);

const deprecated = article({
  slug: "old-hemoglobin",
  state: "deprecated",
  reviewedBy: null,
  reviewedAt: null,
  deprecation: {
    deprecatedAt: "2026-08-15T00:00:00.000Z",
    replacementSlug: "hemoglobin",
  },
});
assert.equal(
  validateKnowledgeBaseArticles([deprecated, BASE_ARTICLE], { asOf: AS_OF })
    .valid,
  true,
);
assert.equal(
  resolveKnowledgeBaseDeprecatedRedirect(
    deprecated,
    [deprecated, BASE_ARTICLE],
    { asOf: AS_OF },
  ),
  "/knowledge/biomarkers/hemoglobin",
);
assert.equal(
  resolveKnowledgeBaseDeprecatedRedirect(
    deprecated,
    [
      deprecated,
      article({
        state: "review",
        reviewedBy: null,
        reviewedAt: null,
        sources: [],
      }),
    ],
    { asOf: AS_OF },
  ),
  "/knowledge",
);
assert.equal(
  resolveKnowledgeBaseDeprecatedRedirect(
    article({
      slug: "old-without-target",
      state: "deprecated",
      deprecation: { deprecatedAt: "2026-08-15T00:00:00.000Z" },
    }),
    [],
    { asOf: AS_OF },
  ),
  "/knowledge",
);

const selfRedirect = validateKnowledgeBaseArticles(
  [
    article({
      slug: "self-redirect",
      state: "deprecated",
      deprecation: {
        deprecatedAt: "2026-08-15T00:00:00.000Z",
        replacementSlug: "self-redirect",
      },
    }),
  ],
  { asOf: AS_OF },
);
assert.equal(selfRedirect.valid, false);
assert.ok(
  selfRedirect.errors.some((message) => message.includes("must not equal")),
);

const duplicateSlug = validateKnowledgeBaseArticles(
  [BASE_ARTICLE, article({ title: "Duplicate" })],
  { asOf: AS_OF },
);
assert.equal(duplicateSlug.valid, false);
assert.ok(
  duplicateSlug.errors.some((message) => message.includes("duplicate slug")),
);

const liveHemoglobin = getKnowledgeArticle("hemoglobin");
assert.ok(liveHemoglobin);
const markup = renderToStaticMarkup(
  createElement(KnowledgeArticlePage, {
    kind: "measurement",
    adapter: "public",
    article: liveHemoglobin,
    publishedArticles: listPublishedKnowledgeArticleRecords(),
  }),
);
assert.match(markup, /Hemoglobin/);
assert.match(markup, /Sources/);
assert.match(markup, /Educational disclaimer|not medical advice/i);
assert.doesNotMatch(markup, /\/api\/biomarkers/);

console.log("verify-knowledge-base: all checks passed");
