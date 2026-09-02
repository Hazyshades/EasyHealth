import {
  getMeasurementDefinition,
  getPanelDefinition,
  type PanelDefinition,
} from "@/lib/biomarkers";
import {
  formatKnowledgeBaseSchemaErrors,
  panelArticleSchema,
  type KnowledgeBaseValidation,
  type PanelArticle,
} from "./types";

export type PanelArticleValidation = KnowledgeBaseValidation;

function addDefinitionValidation(
  article: PanelArticle,
  key: string,
  errors: string[],
): void {
  const definition = getMeasurementDefinition(key);
  if (!definition) {
    errors.push(`Article member definition is unknown: ${article.slug}/${key}`);
    return;
  }
  if (
    definition.maturity !== "reviewed" ||
    definition.sourceProvenance.kind !== "registry_v2_review"
  ) {
    errors.push(
      `Article member definition is not reviewed Registry 2.0 data: ${article.slug}/${key}`,
    );
  }
}

/**
 * Validates the enriched panel article contract against current Registry data.
 * The content module remains read-only and does not import assessment behavior.
 */
export function validatePanelArticle(
  article: unknown,
  panel?: PanelDefinition | null,
): PanelArticleValidation {
  const parsed = panelArticleSchema.safeParse(article);
  if (!parsed.success) {
    return {
      valid: false,
      errors: formatKnowledgeBaseSchemaErrors(parsed.error.issues),
    };
  }

  const validArticle = parsed.data;
  const resolvedPanel =
    panel === undefined ? getPanelDefinition(validArticle.panelKey) : panel;
  const errors: string[] = [];

  if (!resolvedPanel) {
    errors.push(
      `Article panel definition is unavailable: ${validArticle.panelKey}`,
    );
    return { valid: false, errors };
  }

  if (resolvedPanel.key !== validArticle.panelKey) {
    errors.push(
      `Article panel does not match provided Registry definition: ${validArticle.panelKey}`,
    );
    return { valid: false, errors };
  }

  const panelMembers = new Map(
    resolvedPanel.members.map((entry) => [
      entry.measurementDefinitionKey,
      entry.role,
    ]),
  );
  const referencedPanelKeys = new Set<string>();
  const subgroupKeys = new Set<string>();

  for (const subgroup of validArticle.subgroups) {
    if (subgroupKeys.has(subgroup.key)) {
      errors.push(
        `Duplicate article subgroup: ${validArticle.slug}/${subgroup.key}`,
      );
    }
    subgroupKeys.add(subgroup.key);

    for (const entry of subgroup.members) {
      if (referencedPanelKeys.has(entry.measurementDefinitionKey)) {
        errors.push(
          `Duplicate article member: ${validArticle.slug}/${entry.measurementDefinitionKey}`,
        );
      }
      referencedPanelKeys.add(entry.measurementDefinitionKey);
      addDefinitionValidation(
        validArticle,
        entry.measurementDefinitionKey,
        errors,
      );

      const panelRole = panelMembers.get(entry.measurementDefinitionKey);
      if (!panelRole) {
        errors.push(
          `Article member is not in panel registry: ${validArticle.slug}/${entry.measurementDefinitionKey}`,
        );
        continue;
      }
      if (entry.role === "related") {
        errors.push(
          `Panel subgroup member cannot be related: ${validArticle.slug}/${entry.measurementDefinitionKey}`,
        );
      } else if (
        (panelRole === "required" && entry.role !== "core") ||
        (panelRole === "optional" && entry.role !== "optional")
      ) {
        errors.push(
          `Article member role disagrees with panel registry: ${validArticle.slug}/${entry.measurementDefinitionKey}`,
        );
      }
    }
  }

  for (const key of panelMembers.keys()) {
    if (!referencedPanelKeys.has(key)) {
      errors.push(
        `Panel member is missing from article: ${validArticle.slug}/${key}`,
      );
    }
  }

  const relatedMarkerKeys = new Set<string>();
  for (const entry of validArticle.relatedMarkers) {
    if (entry.role !== "related") {
      errors.push(
        `Related marker must use related role: ${validArticle.slug}/${entry.measurementDefinitionKey}`,
      );
    }
    if (relatedMarkerKeys.has(entry.measurementDefinitionKey)) {
      errors.push(
        `Duplicate related marker: ${validArticle.slug}/${entry.measurementDefinitionKey}`,
      );
    }
    relatedMarkerKeys.add(entry.measurementDefinitionKey);
    addDefinitionValidation(
      validArticle,
      entry.measurementDefinitionKey,
      errors,
    );
    if (panelMembers.has(entry.measurementDefinitionKey)) {
      errors.push(
        `Related marker is already a panel member: ${validArticle.slug}/${entry.measurementDefinitionKey}`,
      );
    }
  }

  const declaredRelatedKeys = new Set(validArticle.relatedMeasurementKeys);
  if (declaredRelatedKeys.size !== validArticle.relatedMeasurementKeys.length) {
    errors.push(`Duplicate related measurement key: ${validArticle.slug}`);
  }
  for (const key of relatedMarkerKeys) {
    if (!declaredRelatedKeys.has(key)) {
      errors.push(
        `Related marker is missing from relatedMeasurementKeys: ${validArticle.slug}/${key}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
