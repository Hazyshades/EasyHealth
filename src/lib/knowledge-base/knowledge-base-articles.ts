import {
  KNOWLEDGE_BASE_ARTICLES as CATALOG_ARTICLES,
  articleIdentity,
  listPublishedKnowledgeBaseArticles as listAdmittedCatalogArticles,
  getPublishedKnowledgeBaseArticleBySlug as getAdmittedCatalogArticleBySlug,
  getPublishedKnowledgeBaseArticleForMeasurementDefinition as getAdmittedCatalogMeasurement,
  getPublishedKnowledgeBaseArticleForPanel as getAdmittedCatalogPanel,
} from "./catalog";
import {
  formatKnowledgeBaseSchemaErrors,
  knowledgeBaseArticleSchema,
  type KnowledgeBaseArticle,
  type KnowledgeBaseArticleType,
  type KnowledgeBaseValidation,
  type MeasurementEducationArticle,
  type PanelEducationArticle,
} from "./types";
import { validateMeasurementEducationArticle } from "./measurement-articles";
import { validatePanelEducationArticle } from "./panel-articles";

const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The single version-controlled catalog consumed by generic Knowledge Base readers. */
export const KNOWLEDGE_BASE_ARTICLES: readonly KnowledgeBaseArticle[] =
  CATALOG_ARTICLES;

/** Validates one article shape and its authoritative Registry subject. */
export function validateKnowledgeBaseArticle(
  article: unknown,
): KnowledgeBaseValidation {
  const parsed = knowledgeBaseArticleSchema.safeParse(article);
  if (!parsed.success) {
    return {
      valid: false,
      errors: formatKnowledgeBaseSchemaErrors(parsed.error.issues),
    };
  }

  return parsed.data.type === "measurement"
    ? validateMeasurementEducationArticle(parsed.data)
    : validatePanelEducationArticle(parsed.data);
}

/** Validates the combined catalog and enforces deterministic identities. */
export function validateKnowledgeBaseArticleCatalog(
  articles: readonly unknown[] = KNOWLEDGE_BASE_ARTICLES,
): KnowledgeBaseValidation {
  const errors: string[] = [];
  const identities = new Set<string>();

  articles.forEach((article, index) => {
    const validation = validateKnowledgeBaseArticle(article);
    validation.errors.forEach((error) =>
      errors.push(`articles[${index}]: ${error}`),
    );
    if (!validation.valid) return;

    const parsed = knowledgeBaseArticleSchema.safeParse(article);
    if (!parsed.success) return;

    const identity = articleIdentity(parsed.data);
    if (identities.has(identity)) {
      errors.push(`duplicate article identity: ${identity}`);
    }
    identities.add(identity);
  });

  return { valid: errors.length === 0, errors };
}

/** Returns only validated, currently public articles for one exact locale. */
export function listPublishedKnowledgeBaseArticles(
  articles: readonly KnowledgeBaseArticle[] = KNOWLEDGE_BASE_ARTICLES,
  locale = "en",
): readonly KnowledgeBaseArticle[] {
  if (!validateKnowledgeBaseArticleCatalog(articles).valid) return [];
  return listAdmittedCatalogArticles(articles, locale);
}

export function getPublishedKnowledgeBaseArticleBySlug(
  type: KnowledgeBaseArticleType,
  slug: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
  } = {},
): KnowledgeBaseArticle | null {
  if (!ARTICLE_SLUG_PATTERN.test(slug)) return null;
  const articles = options.articles ?? KNOWLEDGE_BASE_ARTICLES;
  if (!validateKnowledgeBaseArticleCatalog(articles).valid) return null;
  return getAdmittedCatalogArticleBySlug(type, slug, options);
}

export function getPublishedKnowledgeBaseArticleForMeasurementDefinition(
  measurementDefinitionKey: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
  } = {},
): MeasurementEducationArticle | null {
  const articles = options.articles ?? KNOWLEDGE_BASE_ARTICLES;
  if (!validateKnowledgeBaseArticleCatalog(articles).valid) return null;
  return getAdmittedCatalogMeasurement(measurementDefinitionKey, options);
}

export function getPublishedKnowledgeBaseArticleForPanel(
  panelKey: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
  } = {},
): PanelEducationArticle | null {
  const articles = options.articles ?? KNOWLEDGE_BASE_ARTICLES;
  if (!validateKnowledgeBaseArticleCatalog(articles).valid) return null;
  const article = getAdmittedCatalogPanel(panelKey, options);
  return article && article.type === "panel" ? article : null;
}
