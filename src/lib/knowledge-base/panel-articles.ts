import { getPanelDefinition } from "@/lib/biomarkers";
import {
  formatKnowledgeBaseSchemaErrors,
  panelEducationArticleSchema,
  type KnowledgeBaseValidation,
  type PanelEducationArticle,
} from "./types";

/**
 * EH-133 defines the shared panel contract without publishing panel copy.
 * EH-135 supplies reviewed panel records through this catalog boundary.
 */
export const PANEL_ARTICLES: readonly PanelEducationArticle[] = [];

/** Validates one panel record and its Registry subject. */
export function validatePanelEducationArticle(
  article: unknown,
): KnowledgeBaseValidation {
  const parsed = panelEducationArticleSchema.safeParse(article);
  if (!parsed.success) {
    return {
      valid: false,
      errors: formatKnowledgeBaseSchemaErrors(parsed.error.issues),
    };
  }

  const panel = getPanelDefinition(parsed.data.panelKey);
  if (!panel) {
    return {
      valid: false,
      errors: [`panel definition not found: ${parsed.data.panelKey}`],
    };
  }

  return { valid: true, errors: [] };
}
