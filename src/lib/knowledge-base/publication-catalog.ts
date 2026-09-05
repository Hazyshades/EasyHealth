import { loadKnowledgeArticleBySlug } from "./content";
import {
  getCatalogEntryBySlug,
  isCatalogIdentityValid,
  listCatalogEntries,
  toAdmissionArticle,
} from "./catalog";
import {
  isPublicCatalogArticle,
  type KnowledgeBasePolicyOptions,
} from "./admission";
import {
  KNOWLEDGE_BASE_ROUTE,
  type KnowledgeBaseArticle,
  type PublicKnowledgeBaseArticle,
} from "./publication-types";
import {
  resolveKnowledgeBaseDeprecatedRedirect,
} from "./publication";

export { KNOWLEDGE_BASE_ROUTE };
export type { PublicKnowledgeBaseArticle, KnowledgeBasePolicyOptions };

function contentVersionNumber(value: string): number {
  const major = Number.parseInt(value.split(".")[0] ?? "", 10);
  return Number.isInteger(major) && major > 0 ? major : 1;
}

function toPublicationArticle(
  slug: string,
): KnowledgeBaseArticle | null {
  const entry = getCatalogEntryBySlug("measurement", slug);
  if (!entry || entry.article.type !== "measurement") return null;
  const hydrated = loadKnowledgeArticleBySlug(slug);
  const article = entry.article;
  return {
    slug: article.slug,
    type: "measurement",
    locale: article.locale,
    contentVersion: contentVersionNumber(article.contentVersion),
    title: article.title,
    summary: article.summary,
    body: hydrated?.body ?? article.summary,
    state: article.reviewStatus,
    reviewedBy: article.reviewedBy,
    reviewedAt: article.reviewedAt,
    sources: article.sources.map((source) => ({
      title: source.title,
      url: source.url,
      publisher: source.publisher,
    })),
    relatedMeasurementKeys: article.relatedMeasurementKeys,
  };
}

function publicationCorpus(): readonly KnowledgeBaseArticle[] {
  return listCatalogEntries()
    .filter((entry) => entry.article.type === "measurement")
    .flatMap((entry) => {
      const mapped = toPublicationArticle(entry.article.slug);
      return mapped ? [mapped] : [];
    });
}

export function getKnowledgeBaseArticle(
  slug: string,
): KnowledgeBaseArticle | null {
  return toPublicationArticle(slug);
}

export function listKnowledgeBaseSlugs(): readonly string[] {
  return publicationCorpus().map((article) => article.slug);
}

export function getPublicKnowledgeBaseArticle(
  slug: string,
  options: KnowledgeBasePolicyOptions = {},
): PublicKnowledgeBaseArticle | null {
  if (!isCatalogIdentityValid()) return null;
  const entry = getCatalogEntryBySlug("measurement", slug);
  if (!entry || !isPublicCatalogArticle(toAdmissionArticle(entry), options)) {
    return null;
  }
  const article = toPublicationArticle(slug);
  if (!article || article.state !== "published") return null;
  return article as PublicKnowledgeBaseArticle;
}

export function listPublicKnowledgeBaseArticles(
  options: KnowledgeBasePolicyOptions = {},
): readonly PublicKnowledgeBaseArticle[] {
  if (!isCatalogIdentityValid()) return [];
  return publicationCorpus()
    .filter((article) => {
      const entry = getCatalogEntryBySlug("measurement", article.slug);
      return (
        entry !== null &&
        isPublicCatalogArticle(toAdmissionArticle(entry), options)
      );
    })
    .map((article) => article as PublicKnowledgeBaseArticle)
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function getDeprecatedKnowledgeBaseRedirect(
  article: KnowledgeBaseArticle,
  options: KnowledgeBasePolicyOptions = {},
): string {
  if (!isCatalogIdentityValid()) return KNOWLEDGE_BASE_ROUTE;
  return resolveKnowledgeBaseDeprecatedRedirect(
    article,
    publicationCorpus(),
    options,
  );
}

export function listPublicationKnowledgeBaseArticles(): readonly KnowledgeBaseArticle[] {
  return publicationCorpus();
}
