import {
  knowledgeBaseArticleSchema,
  type KnowledgeBaseArticle,
  type KnowledgeBaseValidation,
} from "./types";
import {
  MEASUREMENT_ARTICLES,
  validateMeasurementEducationArticle,
} from "./measurement-articles";
import {
  PANEL_ARTICLES,
  validatePanelEducationArticle,
} from "./panel-articles";

const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The single version-controlled catalog consumed by generic Knowledge Base readers. */
export const KNOWLEDGE_BASE_ARTICLES: readonly KnowledgeBaseArticle[] = [
  ...MEASUREMENT_ARTICLES,
  ...PANEL_ARTICLES,
];

function formatSchemaErrors(
  errors: readonly { path: readonly (string | number)[]; message: string }[],
): string[] {
  return errors.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "article";
    return `${path}: ${issue.message}`;
  });
}

function articleIdentity(
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

/** Validates one article shape and its authoritative Registry subject. */
export function validateKnowledgeBaseArticle(
  article: unknown,
): KnowledgeBaseValidation {
  const parsed = knowledgeBaseArticleSchema.safeParse(article);
  if (!parsed.success) {
    return { valid: false, errors: formatSchemaErrors(parsed.error.issues) };
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

/** Returns only validated, currently published articles for one exact locale. */
export function listPublishedKnowledgeBaseArticles(
  articles: readonly KnowledgeBaseArticle[] = KNOWLEDGE_BASE_ARTICLES,
  locale = "en",
): readonly KnowledgeBaseArticle[] {
  if (!validateKnowledgeBaseArticleCatalog(articles).valid) return [];

  return articles
    .filter(
      (article) =>
        article.locale === locale &&
        article.reviewStatus === "published" &&
        validateKnowledgeBaseArticle(article).valid,
    )
    .sort(compareArticleIdentity);
}

export function getPublishedKnowledgeBaseArticleBySlug(
  slug: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
  } = {},
): KnowledgeBaseArticle | null {
  if (!ARTICLE_SLUG_PATTERN.test(slug)) return null;
  return (
    listPublishedKnowledgeBaseArticles(
      options.articles ?? KNOWLEDGE_BASE_ARTICLES,
      options.locale ?? "en",
    ).find((article) => article.slug === slug) ?? null
  );
}

export function getPublishedKnowledgeBaseArticleForMeasurementDefinition(
  measurementDefinitionKey: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
  } = {},
): KnowledgeBaseArticle | null {
  return (
    listPublishedKnowledgeBaseArticles(
      options.articles ?? KNOWLEDGE_BASE_ARTICLES,
      options.locale ?? "en",
    ).find(
      (article) =>
        article.type === "measurement" &&
        article.measurementDefinitionKey === measurementDefinitionKey,
    ) ?? null
  );
}

export function getPublishedKnowledgeBaseArticleForPanel(
  panelKey: string,
  options: {
    locale?: string;
    articles?: readonly KnowledgeBaseArticle[];
  } = {},
): KnowledgeBaseArticle | null {
  return (
    listPublishedKnowledgeBaseArticles(
      options.articles ?? KNOWLEDGE_BASE_ARTICLES,
      options.locale ?? "en",
    ).find(
      (article) => article.type === "panel" && article.panelKey === panelKey,
    ) ?? null
  );
}
