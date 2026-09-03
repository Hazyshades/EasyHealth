import {
  foldMeasurementLabel,
  getMeasurementDefinition,
  listPanelsForMeasurementDefinition,
  normalizeMeasurementLabel,
  PANEL_DEFINITIONS,
} from "../biomarkers";
import { KNOWLEDGE_ARTICLES } from "./articles";
import type {
  KnowledgeArticle,
  KnowledgeArticleRecord,
  KnowledgeCategory,
  KnowledgeIndexFilters,
  KnowledgeSearchResult,
} from "./types";

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

function hasCompletePublicationMetadata(
  record: KnowledgeArticleRecord,
): boolean {
  return (
    record.review.status === "published" &&
    record.slug.trim().length > 0 &&
    record.measurementDefinitionKey.trim().length > 0 &&
    record.contentVersion.trim().length > 0 &&
    record.review.reviewedBy.trim().length > 0 &&
    record.review.reviewedAt.trim().length > 0 &&
    record.sources.length > 0 &&
    record.sources.every(
      (source) =>
        source.title.trim() && source.publisher.trim() && source.href.trim(),
    )
  );
}

function toPublishedArticle(
  record: KnowledgeArticleRecord,
): KnowledgeArticle | null {
  if (!hasCompletePublicationMetadata(record)) return null;

  const definition = getMeasurementDefinition(record.measurementDefinitionKey);
  if (
    !definition ||
    definition.maturity !== "reviewed" ||
    definition.sourceProvenance.kind !== "registry_v2_review"
  ) {
    return null;
  }

  const aliases = [
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

  return {
    record,
    definition,
    aliases,
    panels: listPanelsForMeasurementDefinition(definition.key),
  };
}

const PUBLISHED_ARTICLES = KNOWLEDGE_ARTICLES.flatMap((record) => {
  const article = toPublishedArticle(record);
  return article ? [article] : [];
});

const ARTICLE_BY_SLUG: Record<string, KnowledgeArticle> = Object.fromEntries(
  PUBLISHED_ARTICLES.map((article) => [article.record.slug, article]),
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

export function formatKnowledgeUnit(unit: string): string {
  const formatted: Record<string, string> = {
    "%": "%",
    "10^9/l": "10⁹/L",
    "10^3/ul": "10³/µL",
    "10^12/l": "10¹²/L",
    fl: "fL",
    pg: "pg",
    "mg/dl": "mg/dL",
    "mmol/l": "mmol/L",
    "u/l": "U/L",
    "miu/l": "mIU/L",
    "uiu/ml": "µIU/mL",
    "ng/dl": "ng/dL",
    "pmol/l": "pmol/L",
    "umol/l": "µmol/L",
    "ml/min/1.73m2": "mL/min/1.73 m²",
  };
  return formatted[unit] ?? unit;
}
