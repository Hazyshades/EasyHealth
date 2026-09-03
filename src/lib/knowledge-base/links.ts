import { getMeasurementDefinition } from "../biomarkers";
import { KNOWLEDGE_ARTICLES } from "./articles";
import type { KnowledgeArticleRecord } from "./types";

const PUBLISHED_ARTICLES = KNOWLEDGE_ARTICLES.filter((article) => {
  const definition = getMeasurementDefinition(article.measurementDefinitionKey);
  return (
    article.review.status === "published" &&
    article.slug.trim().length > 0 &&
    article.measurementDefinitionKey.trim().length > 0 &&
    article.contentVersion.trim().length > 0 &&
    article.review.reviewedBy.trim().length > 0 &&
    article.review.reviewedAt.trim().length > 0 &&
    article.sources.length > 0 &&
    article.sources.every(
      (source) =>
        source.title.trim() && source.publisher.trim() && source.href.trim(),
    ) &&
    definition?.maturity === "reviewed" &&
    definition.sourceProvenance.kind === "registry_v2_review"
  );
});

const ARTICLE_BY_MEASUREMENT_KEY: Record<string, KnowledgeArticleRecord> =
  Object.fromEntries(
    PUBLISHED_ARTICLES.map((article) => [
      article.measurementDefinitionKey,
      article,
    ]),
  );

const ARTICLE_BY_SLUG: Record<string, KnowledgeArticleRecord> =
  Object.fromEntries(
    PUBLISHED_ARTICLES.map((article) => [article.slug, article]),
  );
export function getKnowledgeArticleRecordByMeasurementKey(
  measurementDefinitionKey: string | null | undefined,
): KnowledgeArticleRecord | null {
  if (!measurementDefinitionKey) return null;
  return ARTICLE_BY_MEASUREMENT_KEY[measurementDefinitionKey] ?? null;
}

export function getKnowledgeArticleRecordBySlug(
  slug: string | null | undefined,
): KnowledgeArticleRecord | null {
  if (!slug) return null;
  return ARTICLE_BY_SLUG[slug] ?? null;
}

export function getKnowledgeArticleHref(
  measurementDefinitionKey: string | null | undefined,
): string | null {
  const article = getKnowledgeArticleRecordByMeasurementKey(
    measurementDefinitionKey,
  );
  return article
    ? `/knowledge/biomarkers/${encodeURIComponent(article.slug)}`
    : null;
}
