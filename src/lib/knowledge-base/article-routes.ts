import {
  getCatalogEntryBySlug,
  getPublishedKnowledgeBaseArticleBySlug,
} from "./catalog";

/** Canonical public Knowledge Base index. */
export const KNOWLEDGE_BASE_PUBLIC_INDEX = "/knowledge";

export function publicMeasurementArticlePath(slug: string): string {
  return `/knowledge/biomarkers/${encodeURIComponent(slug)}`;
}

export function publicPanelArticlePath(panelKey: string): string {
  return `/knowledge/panels/${encodeURIComponent(panelKey)}`;
}

function publicPathForCatalogSlug(slug: string): string | null {
  const measurement = getPublishedKnowledgeBaseArticleBySlug(
    "measurement",
    slug,
  );
  if (measurement) return publicMeasurementArticlePath(measurement.slug);

  const panel = getPublishedKnowledgeBaseArticleBySlug("panel", slug);
  if (panel?.type === "panel") return publicPanelArticlePath(panel.panelKey);

  return null;
}

/**
 * Maps a legacy `/knowledge-base/<slug>` request onto the canonical public
 * `/knowledge` family. Missing, unpublished, and unpublished replacements
 * fall back to the public index. Never returns an external URL.
 */
export function resolveLegacyKnowledgeBasePath(slug: string): string {
  const publicPath = publicPathForCatalogSlug(slug);
  if (publicPath) return publicPath;

  const measurementEntry = getCatalogEntryBySlug("measurement", slug);
  const panelEntry = getCatalogEntryBySlug("panel", slug);
  const entry = measurementEntry ?? panelEntry;
  if (entry?.article.reviewStatus === "deprecated") {
    const replacementSlug = entry.article.replacementSlug;
    if (replacementSlug) {
      return (
        publicPathForCatalogSlug(replacementSlug) ?? KNOWLEDGE_BASE_PUBLIC_INDEX
      );
    }
  }

  return KNOWLEDGE_BASE_PUBLIC_INDEX;
}
