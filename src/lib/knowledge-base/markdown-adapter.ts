import manifestJson from "../../../content/knowledge/biomarkers/manifest.json";
import {
  isPublicCatalogArticle,
  type CatalogAdmissionArticle,
  type KnowledgeBasePolicyOptions,
} from "./admission";
import type {
  KnowledgeBaseReviewStatus,
  KnowledgeBaseSource,
  MeasurementEducationArticle,
} from "./types";

type ManifestSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  accessedAt: string;
};

type ManifestArticle = {
  slug: string;
  locale: string;
  contentVersion: string;
  title: string;
  summary: string;
  status: "draft" | "review" | "published" | "deprecated";
  reviewedBy: string;
  reviewedAt: string;
  measurementDefinitionKeys: readonly string[];
  relatedMeasurementKeys: readonly string[];
  sourceIds: readonly string[];
};

const MANIFEST = manifestJson as {
  articles: readonly ManifestArticle[];
  sources: readonly ManifestSource[];
};

export type MarkdownCatalogEntry = Readonly<{
  article: MeasurementEducationArticle;
  measurementDefinitionKeys: readonly string[];
}>;

export function mapMarkdownLifecycle(
  status: ManifestArticle["status"],
): KnowledgeBaseReviewStatus {
  return status === "review" ? "in_review" : status;
}

function dateOnlyToIso(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
}

function mapManifestSources(article: ManifestArticle): KnowledgeBaseSource[] {
  const byId = new Map(MANIFEST.sources.map((source) => [source.id, source]));
  return article.sourceIds.flatMap((sourceId) => {
    const source = byId.get(sourceId);
    if (!source) return [];
    return [
      {
        title: source.title,
        publisher: source.publisher,
        url: source.url,
        accessedAt: dateOnlyToIso(source.accessedAt),
      },
    ];
  });
}

export function mapManifestMeasurement(
  article: ManifestArticle,
): MarkdownCatalogEntry | null {
  const measurementDefinitionKey = article.measurementDefinitionKeys[0];
  if (!measurementDefinitionKey) return null;

  const mapped: MeasurementEducationArticle = {
    type: "measurement",
    measurementDefinitionKey,
    slug: article.slug,
    locale: article.locale,
    contentVersion: article.contentVersion,
    reviewStatus: mapMarkdownLifecycle(article.status),
    reviewedBy: article.reviewedBy,
    reviewedAt: article.reviewedAt,
    deprecatedAt: null,
    replacementSlug: null,
    title: article.title,
    summary: article.summary,
    whatItMeasures: [article.summary],
    interpretationFactors: [article.summary],
    sources: mapManifestSources(article),
    relatedMeasurementKeys: [...article.relatedMeasurementKeys],
  };

  return {
    article: mapped,
    measurementDefinitionKeys: article.measurementDefinitionKeys,
  };
}

export const MARKDOWN_CATALOG_ENTRIES: readonly MarkdownCatalogEntry[] =
  MANIFEST.articles.flatMap((article) => {
    const mapped = mapManifestMeasurement(article);
    return mapped ? [mapped] : [];
  });

export function toMarkdownAdmissionArticle(
  entry: MarkdownCatalogEntry,
): CatalogAdmissionArticle {
  return {
    type: "measurement",
    reviewStatus: entry.article.reviewStatus,
    reviewedBy: entry.article.reviewedBy,
    reviewedAt: entry.article.reviewedAt,
    sources: entry.article.sources,
    measurementDefinitionKeys: entry.measurementDefinitionKeys,
  };
}

export function getPublishedHrefProjection(
  options: KnowledgeBasePolicyOptions = {},
): Readonly<Record<string, string>> {
  const projection = Object.create(null) as Record<string, string>;
  for (const entry of MARKDOWN_CATALOG_ENTRIES) {
    if (!isPublicCatalogArticle(toMarkdownAdmissionArticle(entry), options)) {
      continue;
    }
    const href = `/knowledge/biomarkers/${encodeURIComponent(entry.article.slug)}`;
    for (const key of entry.measurementDefinitionKeys) {
      projection[key] = href;
    }
  }
  return projection;
}

export function getPublishedMeasurementHrefByDefinitionKey(
  measurementDefinitionKey: string | null | undefined,
  options: KnowledgeBasePolicyOptions = {},
): string | null {
  if (!measurementDefinitionKey) return null;
  const projection = getPublishedHrefProjection(options);
  return Object.hasOwn(projection, measurementDefinitionKey)
    ? projection[measurementDefinitionKey]
    : null;
}
