import { getKnowledgeArticleByMeasurementKey } from "./catalog";

export function getKnowledgeArticleHref(
  measurementDefinitionKey: string | null | undefined,
): string | null {
  const article = getKnowledgeArticleByMeasurementKey(measurementDefinitionKey);
  return article
    ? `/knowledge/biomarkers/${encodeURIComponent(article.record.slug)}`
    : null;
}
