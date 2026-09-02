import { getMeasurementDefinition, getPanelDefinition } from "@/lib/biomarkers";
import {
  panelEducationArticleSchema,
  type KnowledgeBaseValidation,
  type PanelEducationArticle,
} from "./types";

/**
 * EH-133 defines the shared panel contract without publishing panel copy.
 * EH-135 supplies reviewed panel records through this catalog boundary.
 */
export const PANEL_ARTICLES: readonly PanelEducationArticle[] = [];

function formatSchemaErrors(
  errors: readonly { path: readonly (string | number)[]; message: string }[],
): string[] {
  return errors.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "article";
    return `${path}: ${issue.message}`;
  });
}

/** Validates one panel record and its Registry subject/member references. */
export function validatePanelEducationArticle(
  article: unknown,
): KnowledgeBaseValidation {
  const parsed = panelEducationArticleSchema.safeParse(article);
  if (!parsed.success) {
    return { valid: false, errors: formatSchemaErrors(parsed.error.issues) };
  }

  const panel = getPanelDefinition(parsed.data.panelKey);
  if (!panel) {
    return {
      valid: false,
      errors: [`panel definition not found: ${parsed.data.panelKey}`],
    };
  }

  const panelMemberKeys = new Set(
    panel.members.map((member) => member.measurementDefinitionKey),
  );
  const articleMembers = [
    ...parsed.data.subgroups.flatMap((subgroup) => subgroup.members),
    ...parsed.data.relatedMarkers,
  ];
  const errors: string[] = [];

  for (const member of articleMembers) {
    const definition = getMeasurementDefinition(
      member.measurementDefinitionKey,
    );
    if (!definition) {
      errors.push(
        `measurement definition not found: ${member.measurementDefinitionKey}`,
      );
      continue;
    }
    if (
      definition.maturity !== "reviewed" ||
      definition.sourceProvenance.kind !== "registry_v2_review"
    ) {
      errors.push(
        `measurement definition is not an active reviewed definition: ${member.measurementDefinitionKey}`,
      );
    }
    if (
      member.role !== "related" &&
      !panelMemberKeys.has(member.measurementDefinitionKey)
    ) {
      errors.push(
        `panel member is not registered for ${parsed.data.panelKey}: ${member.measurementDefinitionKey}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
