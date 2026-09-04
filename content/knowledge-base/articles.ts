import { listKnowledgeArticles } from "@/lib/knowledge-base/content";
import type { KnowledgeBaseArticle } from "@/lib/knowledge-base/publication-types";

function contentVersionNumber(value: string): number {
  const major = Number.parseInt(value.split(".")[0] ?? "", 10);
  return Number.isInteger(major) && major > 0 ? major : 1;
}

/**
 * Publication-governance catalog. Maps the reviewed EH-136 biomarker
 * corpus into the EH-139 article contract used by the public gate.
 */
export const KNOWLEDGE_BASE_ARTICLES: readonly KnowledgeBaseArticle[] =
  listKnowledgeArticles().map((article) => ({
    slug: article.slug,
    type: "biomarker",
    locale: article.locale,
    contentVersion: contentVersionNumber(article.contentVersion),
    title: article.title,
    summary: article.summary,
    body: article.body,
    state: article.status,
    reviewedBy: article.reviewedBy,
    reviewedAt: article.reviewedAt,
    sources: article.sources.map((source) => ({
      title: source.title,
      url: source.url,
      publisher: source.publisher,
    })),
    relatedMeasurementKeys: article.relatedMeasurementKeys,
  }));
