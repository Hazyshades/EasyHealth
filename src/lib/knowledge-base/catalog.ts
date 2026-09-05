import {
  isPublicCatalogArticle,
  type CatalogAdmissionArticle,
  type KnowledgeBasePolicyOptions,
} from "./admission";
import {
  MARKDOWN_CATALOG_ENTRIES,
  mapMarkdownLifecycle,
  toMarkdownAdmissionArticle,
} from "./markdown-adapter";
import { PANEL_ARTICLES } from "./panel-articles";
import type {
  KnowledgeBaseArticle,
  MeasurementEducationArticle,
  PanelArticle,
} from "./types";

export { mapMarkdownLifecycle };

const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CatalogEntry = Readonly<{
  article: KnowledgeBaseArticle;
  measurementDefinitionKeys: readonly string[];
}>;

function panelEntry(article: PanelArticle): CatalogEntry {
  return { article, measurementDefinitionKeys: [] };
}

const PRODUCTION_ENTRIES: readonly CatalogEntry[] = [
  ...MARKDOWN_CATALOG_ENTRIES,
  ...PANEL_ARTICLES.map(panelEntry),
];

export function articleIdentity(
  article: Pick<KnowledgeBaseArticle, "type" | "locale" | "slug">,
): string {
  return `${article.type}:${article.locale}:${article.slug}`;
}

function compareArticleIdentity(
  left: KnowledgeBaseArticle,
  right: KnowledgeBaseArticle,
): number {
  const leftIdentity = articleIdentity(left);
  const rightIdentity = articleIdentity(right);
  if (leftIdentity === rightIdentity) return 0;
  return leftIdentity < rightIdentity ? -1 : 1;
}

export function toAdmissionArticle(entry: CatalogEntry): CatalogAdmissionArticle {
  const { article } = entry;
  if (article.type === "measurement") {
    return toMarkdownAdmissionArticle({
      article,
      measurementDefinitionKeys: entry.measurementDefinitionKeys,
    });
  }
  return {
    type: "panel",
    reviewStatus: article.reviewStatus,
    reviewedBy: article.reviewedBy,
    reviewedAt: article.reviewedAt,
    sources: article.sources,
    panelKey: article.panelKey,
  };
}

function hasDuplicateIdentities(entries: readonly CatalogEntry[]): boolean {
  const identities = new Set<string>();
  for (const entry of entries) {
    const identity = articleIdentity(entry.article);
    if (identities.has(identity)) return true;
    identities.add(identity);
  }
  return false;
}

function entriesFromArticles(
  articles: readonly KnowledgeBaseArticle[],
): readonly CatalogEntry[] {
  return articles.map((article) => ({
    article,
    measurementDefinitionKeys:
      article.type === "measurement" ? [article.measurementDefinitionKey] : [],
  }));
}

export function listCatalogEntries(
  articles?: readonly KnowledgeBaseArticle[],
): readonly CatalogEntry[] {
  if (!articles) return PRODUCTION_ENTRIES;
  return entriesFromArticles(articles);
}

/** The single version-controlled Knowledge Base catalog. */
export const KNOWLEDGE_BASE_ARTICLES: readonly KnowledgeBaseArticle[] =
  PRODUCTION_ENTRIES.map((entry) => entry.article);

export function listKnowledgeBaseCatalogArticles(): readonly KnowledgeBaseArticle[] {
  return KNOWLEDGE_BASE_ARTICLES;
}

export function isCatalogIdentityValid(
  articles?: readonly KnowledgeBaseArticle[],
): boolean {
  return !hasDuplicateIdentities(listCatalogEntries(articles));
}

export function listPublishedKnowledgeBaseArticles(
  articles: readonly KnowledgeBaseArticle[] = KNOWLEDGE_BASE_ARTICLES,
  locale = "en",
  options: KnowledgeBasePolicyOptions = {},
): readonly KnowledgeBaseArticle[] {
  if (!isCatalogIdentityValid(articles)) return [];

  return listCatalogEntries(articles)
    .filter(
      (entry) =>
        entry.article.locale === locale &&
        isPublicCatalogArticle(toAdmissionArticle(entry), options),
    )
    .map((entry) => entry.article)
    .sort(compareArticleIdentity);
}

export function getPublishedKnowledgeBaseArticleBySlug(
  type: KnowledgeBaseArticle["type"],
  slug: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
    asOf?: Date;
    reviewWindowDays?: number;
  } = {},
): KnowledgeBaseArticle | null {
  if (!ARTICLE_SLUG_PATTERN.test(slug)) return null;
  return (
    listPublishedKnowledgeBaseArticles(
      options.articles ?? KNOWLEDGE_BASE_ARTICLES,
      options.locale ?? "en",
      options,
    ).find((article) => article.type === type && article.slug === slug) ?? null
  );
}

export function getPublishedKnowledgeBaseArticleForMeasurementDefinition(
  measurementDefinitionKey: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
    asOf?: Date;
    reviewWindowDays?: number;
  } = {},
): MeasurementEducationArticle | null {
  const locale = options.locale ?? "en";
  const articles = options.articles ?? KNOWLEDGE_BASE_ARTICLES;
  if (!isCatalogIdentityValid(articles)) return null;

  const entry = listCatalogEntries(options.articles).find(
    (candidate) =>
      candidate.article.type === "measurement" &&
      candidate.article.locale === locale &&
      candidate.measurementDefinitionKeys.includes(measurementDefinitionKey) &&
      isPublicCatalogArticle(toAdmissionArticle(candidate), options),
  );
  return entry?.article.type === "measurement" ? entry.article : null;
}

export function getPublishedKnowledgeBaseArticleForPanel(
  panelKey: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
    asOf?: Date;
    reviewWindowDays?: number;
  } = {},
): Extract<KnowledgeBaseArticle, { type: "panel" }> | null {
  return (
    listPublishedKnowledgeBaseArticles(
      options.articles ?? KNOWLEDGE_BASE_ARTICLES,
      options.locale ?? "en",
      options,
    ).find(
      (article): article is Extract<KnowledgeBaseArticle, { type: "panel" }> =>
        article.type === "panel" && article.panelKey === panelKey,
    ) ?? null
  );
}

export function listCatalogMeasurementArticles(
  options: KnowledgeBasePolicyOptions = {},
): readonly MeasurementEducationArticle[] {
  return listPublishedKnowledgeBaseArticles(
    KNOWLEDGE_BASE_ARTICLES,
    "en",
    options,
  ).filter(
    (article): article is MeasurementEducationArticle =>
      article.type === "measurement",
  );
}

export function getCatalogEntryBySlug(
  type: KnowledgeBaseArticle["type"],
  slug: string,
): CatalogEntry | null {
  return (
    PRODUCTION_ENTRIES.find(
      (entry) => entry.article.type === type && entry.article.slug === slug,
    ) ?? null
  );
}
