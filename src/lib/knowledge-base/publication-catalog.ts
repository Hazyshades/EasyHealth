import { KNOWLEDGE_BASE_ARTICLES } from "../../../content/knowledge-base/articles";
import {
  findPublicKnowledgeBaseArticle,
  isPublicKnowledgeBaseArticle,
  resolveKnowledgeBaseDeprecatedRedirect,
  validateKnowledgeBaseArticles,
  type KnowledgeBasePolicyOptions,
} from "./publication";
import {
  KNOWLEDGE_BASE_ROUTE,
  type KnowledgeBaseArticle,
  type PublicKnowledgeBaseArticle,
} from "./publication-types";

export { KNOWLEDGE_BASE_ROUTE };
export type { PublicKnowledgeBaseArticle, KnowledgeBasePolicyOptions };

export function getKnowledgeBaseArticle(
  slug: string,
): KnowledgeBaseArticle | null {
  return (
    KNOWLEDGE_BASE_ARTICLES.find((article) => article.slug === slug) ?? null
  );
}

export function listKnowledgeBaseSlugs(): readonly string[] {
  return KNOWLEDGE_BASE_ARTICLES.map((article) => article.slug);
}

export function getPublicKnowledgeBaseArticle(
  slug: string,
  options: KnowledgeBasePolicyOptions = {},
): PublicKnowledgeBaseArticle | null {
  if (!validateKnowledgeBaseArticles(KNOWLEDGE_BASE_ARTICLES, options).valid)
    return null;
  return findPublicKnowledgeBaseArticle(KNOWLEDGE_BASE_ARTICLES, slug, options);
}

export function listPublicKnowledgeBaseArticles(
  options: KnowledgeBasePolicyOptions = {},
): readonly PublicKnowledgeBaseArticle[] {
  if (!validateKnowledgeBaseArticles(KNOWLEDGE_BASE_ARTICLES, options).valid)
    return [];
  return KNOWLEDGE_BASE_ARTICLES.filter(
    (article): article is PublicKnowledgeBaseArticle =>
      isPublicKnowledgeBaseArticle(article, options),
  ).sort((left, right) => left.title.localeCompare(right.title));
}

export function getDeprecatedKnowledgeBaseRedirect(
  article: KnowledgeBaseArticle,
  options: KnowledgeBasePolicyOptions = {},
): string {
  if (!validateKnowledgeBaseArticles(KNOWLEDGE_BASE_ARTICLES, options).valid)
    return KNOWLEDGE_BASE_ROUTE;
  return resolveKnowledgeBaseDeprecatedRedirect(
    article,
    KNOWLEDGE_BASE_ARTICLES,
    options,
  );
}
