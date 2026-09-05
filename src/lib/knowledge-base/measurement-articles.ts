import { getMeasurementDefinition } from "@/lib/biomarkers";
import {
  getPublishedKnowledgeBaseArticleBySlug,
  getPublishedKnowledgeBaseArticleForMeasurementDefinition,
  listCatalogMeasurementArticles,
} from "./catalog";
import {
  formatKnowledgeBaseSchemaErrors,
  measurementEducationArticleSchema,
  type KnowledgeBaseValidation,
  type MeasurementEducationArticle,
} from "./types";

const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Empty typed measurement corpus. Production measurement articles live in the
 * shared Knowledge Base catalog (markdown adapter), not this list.
 */
export const MEASUREMENT_ARTICLES: readonly MeasurementEducationArticle[] = [];

/** Validates the shape and publication prerequisites of one article record. */
export function validateMeasurementEducationArticle(
  article: unknown,
): KnowledgeBaseValidation {
  const parsed = measurementEducationArticleSchema.safeParse(article);
  if (!parsed.success) {
    return {
      valid: false,
      errors: formatKnowledgeBaseSchemaErrors(parsed.error.issues),
    };
  }

  const definition = getMeasurementDefinition(
    parsed.data.measurementDefinitionKey,
  );
  if (!definition) {
    return {
      valid: false,
      errors: [
        `measurement definition not found: ${parsed.data.measurementDefinitionKey}`,
      ],
    };
  }
  if (
    definition.maturity !== "reviewed" ||
    definition.sourceProvenance.kind !== "registry_v2_review"
  ) {
    return {
      valid: false,
      errors: [
        `measurement definition is not an active reviewed definition: ${parsed.data.measurementDefinitionKey}`,
      ],
    };
  }

  return { valid: true, errors: [] };
}

/** Validates catalog records and enforces unique locale/slug identities. */
export function validateMeasurementArticleCatalog(
  articles: readonly unknown[] = MEASUREMENT_ARTICLES,
): KnowledgeBaseValidation {
  const errors: string[] = [];
  const identities = new Set<string>();

  articles.forEach((article, index) => {
    const validation = validateMeasurementEducationArticle(article);
    validation.errors.forEach((error) =>
      errors.push(`articles[${index}]: ${error}`),
    );
    if (!validation.valid) return;

    const validArticle = article as MeasurementEducationArticle;
    const identity = `${validArticle.locale}:${validArticle.slug}`;
    if (identities.has(identity))
      errors.push(`duplicate article identity: ${identity}`);
    identities.add(identity);
  });

  return { valid: errors.length === 0, errors };
}

export function listPublishedMeasurementArticles(
  articles?: readonly MeasurementEducationArticle[],
  locale = "en",
): readonly MeasurementEducationArticle[] {
  if (!articles) {
    return listCatalogMeasurementArticles().filter(
      (article) => article.locale === locale,
    );
  }
  return articles.filter(
    (article) =>
      article.locale === locale &&
      article.reviewStatus === "published" &&
      validateMeasurementEducationArticle(article).valid,
  );
}

export function getPublishedMeasurementArticleBySlug(
  slug: string,
  options: {
    locale?: string;
    articles?: readonly MeasurementEducationArticle[];
  } = {},
): MeasurementEducationArticle | null {
  if (!ARTICLE_SLUG_PATTERN.test(slug)) return null;
  if (!options.articles) {
    const article = getPublishedKnowledgeBaseArticleBySlug(
      "measurement",
      slug,
      { locale: options.locale ?? "en" },
    );
    return article?.type === "measurement" ? article : null;
  }
  return (
    listPublishedMeasurementArticles(
      options.articles,
      options.locale ?? "en",
    ).find((article) => article.slug === slug) ?? null
  );
}

export function getPublishedMeasurementArticleForDefinition(
  measurementDefinitionKey: string,
  options: {
    locale?: string;
    articles?: readonly MeasurementEducationArticle[];
  } = {},
): MeasurementEducationArticle | null {
  if (!options.articles) {
    return getPublishedKnowledgeBaseArticleForMeasurementDefinition(
      measurementDefinitionKey,
      { locale: options.locale ?? "en" },
    );
  }
  return (
    listPublishedMeasurementArticles(
      options.articles,
      options.locale ?? "en",
    ).find(
      (article) =>
        article.measurementDefinitionKey === measurementDefinitionKey,
    ) ?? null
  );
}
