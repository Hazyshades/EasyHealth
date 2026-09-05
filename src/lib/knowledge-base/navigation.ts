import {
  foldMeasurementLabel,
  getMeasurementDefinition,
  getRegistryV2System,
  listPanelsForMeasurementDefinition,
  normalizeMeasurementLabel,
  PANEL_DEFINITIONS,
} from "../biomarkers";
import {
  getKnowledgeArticle,
  listPublishedKnowledgeArticleRecords,
  type KnowledgeArticleRecord as PublishedArticleRecord,
} from "./content";
import type {
  KnowledgeArticle,
  KnowledgeCategory,
  KnowledgeIndexFilters,
  KnowledgeSearchResult,
} from "./navigation-types";

const PANEL_BY_KEY: Record<string, (typeof PANEL_DEFINITIONS)[number]> =
  Object.fromEntries(PANEL_DEFINITIONS.map((panel) => [panel.key, panel]));

const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  cardiovascular: "Heart and circulation",
  metabolic: "Metabolism",
  thyroid: "Thyroid",
  liver: "Liver",
  kidney: "Kidneys",
  blood: "Blood count",
  nutrients: "Nutrients",
  inflammation: "Inflammation",
};

export function projectKnowledgeEducationCategory(
  measurementDefinitionKeys: readonly string[],
): KnowledgeCategory | null {
  const named = new Set<KnowledgeCategory>();
  for (const key of measurementDefinitionKeys) {
    const system = getRegistryV2System(key);
    if (system !== "general") named.add(system);
  }
  if (named.size === 0) return null;
  if (named.size > 1) {
    throw new Error(
      `Knowledge Base index: conflicting named Body systems (${[...named].join(", ")}) for ${measurementDefinitionKeys.join(", ")}`,
    );
  }
  const [category] = named;
  return category ?? null;
}

export function projectKnowledgeRelatedPanelKeys(
  measurementDefinitionKeys: readonly string[],
): readonly string[] {
  const membership = new Set<string>();
  for (const key of measurementDefinitionKeys) {
    for (const panel of listPanelsForMeasurementDefinition(key)) {
      membership.add(panel.key);
    }
  }
  return PANEL_DEFINITIONS.filter((panel) => membership.has(panel.key)).map(
    (panel) => panel.key,
  );
}

function reviewedAliases(
  definition: NonNullable<ReturnType<typeof getMeasurementDefinition>>,
) {
  return [
    ...new Set(
      definition.aliases
        .filter(
          (alias) =>
            alias.lifecycle === "active" &&
            alias.approvalStatus === "reviewed" &&
            alias.matchAuthority === "reviewed_resolution",
        )
        .map((alias) => alias.value.trim())
        .filter(Boolean),
    ),
  ];
}

function toPublishedArticle(
  record: PublishedArticleRecord,
): KnowledgeArticle | null {
  if (record.status !== "published" || record.reviewStatus !== "reviewed") {
    return null;
  }

  const measurementDefinitionKey = record.measurementDefinitionKeys[0];
  if (!measurementDefinitionKey) return null;
  const definition = getMeasurementDefinition(measurementDefinitionKey);
  if (
    !definition ||
    definition.maturity !== "reviewed" ||
    definition.sourceProvenance.kind !== "registry_v2_review"
  ) {
    return null;
  }

  const category = projectKnowledgeEducationCategory(
    record.measurementDefinitionKeys,
  );
  const relatedPanelKeys = projectKnowledgeRelatedPanelKeys(
    record.measurementDefinitionKeys,
  );
  const published = getKnowledgeArticle(record.slug);
  if (!published) return null;

  return {
    record: {
      slug: record.slug,
      measurementDefinitionKey,
      category,
      summary: record.summary,
      whatItMeasures: record.summary,
      interpretationFactors: [],
      relatedMeasurementDefinitionKeys: record.relatedMeasurementKeys,
      relatedPanelKeys,
      contentVersion: record.contentVersion,
      review: {
        status: "published",
        reviewedBy: record.reviewedBy,
        reviewedAt: record.reviewedAt,
      },
      sources: published.sources.map((source) => ({
        title: source.title,
        publisher: source.publisher,
        href: source.url,
      })),
    },
    definition,
    aliases: reviewedAliases(definition),
    panels: relatedPanelKeys.flatMap((key) => {
      const panel = PANEL_BY_KEY[key];
      return panel ? [panel] : [];
    }),
  };
}

const PUBLISHED_ARTICLES = listPublishedKnowledgeArticleRecords().flatMap(
  (record) => {
    const article = toPublishedArticle(record);
    return article ? [article] : [];
  },
);

const ARTICLE_BY_SLUG: Record<string, KnowledgeArticle> = Object.fromEntries(
  PUBLISHED_ARTICLES.map((article) => [article.record.slug, article]),
);
const ARTICLE_BY_MEASUREMENT_KEY: Record<string, KnowledgeArticle> =
  Object.fromEntries(
    PUBLISHED_ARTICLES.flatMap((article) => {
      const published = listPublishedKnowledgeArticleRecords().find(
        (candidate) => candidate.slug === article.record.slug,
      );
      const keys = published?.measurementDefinitionKeys ?? [
        article.record.measurementDefinitionKey,
      ];
      return keys.map((key) => [key, article] as const);
    }),
  );

function normalizedSearch(
  value: string | null | undefined,
): { primary: string; folded: string } | null {
  const primary = normalizeMeasurementLabel(value ?? "");
  if (!primary || !/\p{L}/u.test(primary)) return null;
  return { primary, folded: foldMeasurementLabel(value ?? "") };
}

function fieldMatch(
  query: { primary: string; folded: string },
  field: string,
): number | null {
  const normalized = normalizeMeasurementLabel(field);
  const folded = foldMeasurementLabel(field);
  if (normalized === query.primary || folded === query.folded) return 0;
  if (normalized.startsWith(query.primary) || folded.startsWith(query.folded))
    return 1;
  if (normalized.includes(query.primary) || folded.includes(query.folded))
    return 2;
  return null;
}

function bestFieldMatch(
  query: { primary: string; folded: string },
  fields: readonly string[],
): { rank: number; matchedTerm: string } | null {
  let best: { rank: number; matchedTerm: string } | null = null;
  for (const field of fields) {
    const rank = fieldMatch(query, field);
    if (rank === null) continue;
    if (!best || rank < best.rank) best = { rank, matchedTerm: field };
  }
  return best;
}

export function listPublishedKnowledgeArticles(): readonly KnowledgeArticle[] {
  return PUBLISHED_ARTICLES;
}

export function getKnowledgeArticleBySlug(
  slug: string | null | undefined,
): KnowledgeArticle | null {
  if (!slug || !Object.hasOwn(ARTICLE_BY_SLUG, slug)) return null;
  return ARTICLE_BY_SLUG[slug];
}

export function getKnowledgeArticleByMeasurementKey(
  measurementDefinitionKey: string | null | undefined,
): KnowledgeArticle | null {
  if (
    !measurementDefinitionKey ||
    !Object.hasOwn(ARTICLE_BY_MEASUREMENT_KEY, measurementDefinitionKey)
  )
    return null;
  return ARTICLE_BY_MEASUREMENT_KEY[measurementDefinitionKey];
}

export function listKnowledgePanels() {
  return PANEL_DEFINITIONS;
}

export function getKnowledgePanel(panelKey: string | null | undefined) {
  if (!panelKey || !Object.hasOwn(PANEL_BY_KEY, panelKey)) return null;
  return PANEL_BY_KEY[panelKey];
}

export function getKnowledgeCategoryLabel(category: KnowledgeCategory): string {
  return CATEGORY_LABELS[category];
}

export function searchKnowledgeEntries(
  filters: KnowledgeIndexFilters = {},
): readonly KnowledgeSearchResult[] {
  const hasQuery = Boolean(filters.query?.trim());
  const query = normalizedSearch(filters.query);
  if (hasQuery && !query) return [];
  const categoryValue = filters.category;
  const category =
    categoryValue && Object.hasOwn(CATEGORY_LABELS, categoryValue)
      ? (categoryValue as KnowledgeCategory)
      : null;
  const requestedPanel = filters.panel;
  const panelKey =
    requestedPanel && Object.hasOwn(PANEL_BY_KEY, requestedPanel)
      ? requestedPanel
      : null;
  const results: KnowledgeSearchResult[] = [];

  for (const article of PUBLISHED_ARTICLES) {
    if (category && article.record.category !== category) continue;
    if (panelKey && !article.panels.some((panel) => panel.key === panelKey))
      continue;

    if (!query) {
      results.push({
        kind: "measurement",
        article,
        matchKind: "canonical",
        matchedTerm: article.definition.displayName,
        rank: 100,
      });
      continue;
    }

    const canonicalMatch = bestFieldMatch(query, [
      article.definition.displayName,
      article.definition.key,
      article.definition.analyteKey,
    ]);
    const aliasMatch = bestFieldMatch(query, article.aliases);
    const match = canonicalMatch
      ? {
          matchKind: "canonical" as const,
          rank: canonicalMatch.rank,
          matchedTerm: canonicalMatch.matchedTerm,
        }
      : aliasMatch
        ? {
            matchKind: "alias" as const,
            rank: 10 + aliasMatch.rank,
            matchedTerm: aliasMatch.matchedTerm,
          }
        : null;

    if (match) {
      results.push({ kind: "measurement", article, ...match });
    }
  }

  if (query) {
    for (const panel of PANEL_DEFINITIONS) {
      if (panelKey && panel.key !== panelKey) continue;
      const match = bestFieldMatch(query, [
        panel.displayName,
        panel.key,
        ...panel.alternateNames,
      ]);
      if (!match) continue;
      results.push({
        kind: "panel",
        panel,
        matchKind: "panel",
        matchedTerm: match.matchedTerm,
        rank: 20 + match.rank,
      });
    }
  }

  return [...results].sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    const leftTitle =
      left.kind === "measurement"
        ? left.article.definition.displayName
        : left.panel.displayName;
    const rightTitle =
      right.kind === "measurement"
        ? right.article.definition.displayName
        : right.panel.displayName;
    return leftTitle.localeCompare(rightTitle, "en");
  });
}

export { formatKnowledgeUnit } from "./content";
