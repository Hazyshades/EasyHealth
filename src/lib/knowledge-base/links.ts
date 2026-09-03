import { listPublishedKnowledgeArticles } from "./catalog";
import type { KnowledgeArticleRecord } from "./types";

const PUBLISHED_ARTICLES = listPublishedKnowledgeArticles().map(
  ({ record }) => record,
);

const ARTICLE_BY_MEASUREMENT_KEY: Record<string, KnowledgeArticleRecord> =
  Object.fromEntries(
    PUBLISHED_ARTICLES.map((article) => [
      article.measurementDefinitionKey,
      article,
    ]),
  );
export function getKnowledgeArticleRecordByMeasurementKey(
  measurementDefinitionKey: string | null | undefined,
): KnowledgeArticleRecord | null {
  if (
    !measurementDefinitionKey ||
    !Object.hasOwn(ARTICLE_BY_MEASUREMENT_KEY, measurementDefinitionKey)
  )
    return null;
  return ARTICLE_BY_MEASUREMENT_KEY[measurementDefinitionKey];
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
