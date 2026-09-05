import {
  getMeasurementDefinition,
  listPanelsForMeasurementDefinition,
} from "@/lib/biomarkers";
import {
  getPublishedMeasurementArticleForDefinition,
  validateMeasurementEducationArticle,
} from "./measurement-articles";
import { listCatalogMeasurementArticles } from "./catalog";
import type {
  MeasurementArticleViewModel,
  MeasurementEducationArticle,
  MeasurementArticlePanel,
  RelatedMeasurementArticle,
} from "./types";

const SPECIMEN_LABELS: Record<string, string> = {
  serum: "Serum",
  plasma: "Plasma",
  whole_blood: "Whole blood",
  urine: "Urine",
  unspecified: "Not specified",
};

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function specimenLabel(specimen: string): string {
  return SPECIMEN_LABELS[specimen] ?? specimen.replaceAll("_", " ");
}

function panelMembership(
  measurementDefinitionKey: string,
): readonly MeasurementArticlePanel[] {
  return listPanelsForMeasurementDefinition(measurementDefinitionKey).flatMap(
    (panel) => {
      const member = panel.members.find(
        (entry) => entry.measurementDefinitionKey === measurementDefinitionKey,
      );
      return member
        ? [
            {
              key: panel.key,
              displayName: panel.displayName,
              role: member.role,
            },
          ]
        : [];
    },
  );
}

function relatedMeasurements(
  article: MeasurementEducationArticle,
  articles: readonly MeasurementEducationArticle[],
): readonly RelatedMeasurementArticle[] {
  const seen = new Set<string>();
  const related: RelatedMeasurementArticle[] = [];

  for (const key of article.relatedMeasurementKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const definition = getMeasurementDefinition(key);
    if (!definition) continue;
    const publishedArticle = getPublishedMeasurementArticleForDefinition(key, {
      locale: article.locale,
      articles,
    });
    related.push({
      key,
      displayName: definition.displayName,
      slug: publishedArticle?.slug ?? null,
    });
  }

  return related;
}

/** Projects one reviewed article with current Registry-owned identity metadata. */
export function buildMeasurementArticleViewModel(
  article: MeasurementEducationArticle,
  articles: readonly MeasurementEducationArticle[] = listCatalogMeasurementArticles(),
): MeasurementArticleViewModel | null {
  if (
    article.reviewStatus !== "published" ||
    !validateMeasurementEducationArticle(article).valid
  ) {
    return null;
  }

  const definition = getMeasurementDefinition(article.measurementDefinitionKey);
  if (!definition) return null;

  return {
    article,
    definition: {
      key: definition.key,
      displayName: definition.displayName,
    },
    aliases: uniqueStrings(definition.aliases.map((alias) => alias.value)),
    commonUnits: uniqueStrings(definition.unitPolicy.acceptedUnits),
    specimenLabel: specimenLabel(definition.specimen),
    panelMembership: panelMembership(definition.key),
    relatedMeasurements: relatedMeasurements(article, articles),
  };
}
