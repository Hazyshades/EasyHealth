import { getPanelDefinition } from "@/lib/biomarkers";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import {
  formatKnowledgeBaseSchemaErrors,
  panelEducationArticleSchema,
  type KnowledgeBaseValidation,
  type PanelArticle,
  type PanelArticleMember,
  type PanelArticleSubgroup,
} from "./types";
import { validatePanelArticle } from "./validation";
import { isPublicCatalogArticle } from "./admission";

function member(
  measurementDefinitionKey: string,
  role: PanelArticleMember["role"],
  explanation: string,
): PanelArticleMember {
  return { measurementDefinitionKey, role, explanation };
}

const RED_CELL_MEMBERS: PanelArticleMember[] = [
  member(
    "hemoglobin_whole_blood",
    "core",
    "An oxygen-carrying protein found inside red blood cells.",
  ),
  member(
    "hematocrit_whole_blood",
    "core",
    "The share of a whole-blood sample made up of red blood cells.",
  ),
  member(
    "rbc_whole_blood",
    "core",
    "The number of red blood cells reported in the sample.",
  ),
  member("mcv_whole_blood", "optional", "The average size of red blood cells."),
  member(
    "mch_whole_blood",
    "optional",
    "The average amount of hemoglobin in a red blood cell.",
  ),
  member(
    "mchc_whole_blood",
    "optional",
    "The average concentration of hemoglobin inside red blood cells.",
  ),
  member(
    "rdw_cv",
    "optional",
    "A measure of variation in red blood cell size.",
  ),
  member(
    "rdw_sd",
    "optional",
    "Another way a laboratory may report variation in red blood cell size.",
  ),
  member(
    "reticulocytes_percent",
    "optional",
    "The percentage of young red blood cells in the sample.",
  ),
  member(
    "reticulocytes_abs",
    "optional",
    "The reported count of young red blood cells.",
  ),
];

const WHITE_CELL_MEMBERS: PanelArticleMember[] = [
  member(
    "wbc_whole_blood",
    "core",
    "The total number of white blood cells reported in the sample.",
  ),
  member(
    "neutrophils_percent",
    "optional",
    "The percentage of white blood cells identified as neutrophils.",
  ),
  member(
    "neutrophils_abs",
    "optional",
    "The absolute neutrophil count when the laboratory reports it.",
  ),
  member(
    "lymphocytes_percent",
    "optional",
    "The percentage of white blood cells identified as lymphocytes.",
  ),
  member(
    "lymphocytes_abs",
    "optional",
    "The absolute lymphocyte count when the laboratory reports it.",
  ),
  member(
    "monocytes_percent",
    "optional",
    "The percentage of white blood cells identified as monocytes.",
  ),
  member(
    "monocytes_abs",
    "optional",
    "The absolute monocyte count when the laboratory reports it.",
  ),
  member(
    "eosinophils_percent",
    "optional",
    "The percentage of white blood cells identified as eosinophils.",
  ),
  member(
    "eosinophils_abs",
    "optional",
    "The absolute eosinophil count when the laboratory reports it.",
  ),
  member(
    "basophils_percent",
    "optional",
    "The percentage of white blood cells identified as basophils.",
  ),
  member(
    "basophils_abs",
    "optional",
    "The absolute basophil count when the laboratory reports it.",
  ),
  member(
    "segmented_neutrophils_percent",
    "optional",
    "A manual differential percentage for segmented neutrophils, when reported.",
  ),
  member(
    "band_neutrophils_percent",
    "optional",
    "A manual differential percentage for band neutrophils, when reported.",
  ),
  member(
    "lymphocytes_manual_percent",
    "optional",
    "A manually reported lymphocyte percentage, when a laboratory uses that method.",
  ),
  member(
    "monocytes_manual_percent",
    "optional",
    "A manually reported monocyte percentage, when a laboratory uses that method.",
  ),
  member(
    "eosinophils_manual_percent",
    "optional",
    "A manually reported eosinophil percentage, when a laboratory uses that method.",
  ),
];

const PLATELET_MEMBERS: PanelArticleMember[] = [
  member(
    "platelets_whole_blood",
    "core",
    "The number of platelets reported in the sample.",
  ),
  member(
    "mpv_whole_blood",
    "optional",
    "The average size of the platelets reported by the laboratory.",
  ),
  member("pdw_cv", "optional", "A measure of variation in platelet size."),
  member(
    "plateletcrit_percent",
    "optional",
    "The percentage of blood volume represented by platelets.",
  ),
];

const CBC_SUBGROUPS: PanelArticleSubgroup[] = [
  {
    key: "red-cells",
    title: "Red-cell measurements",
    summary:
      "These measurements describe red blood cells and the indices laboratories may report alongside them.",
    members: RED_CELL_MEMBERS,
  },
  {
    key: "white-cells",
    title: "White-cell measurements",
    summary:
      "This group includes the total white-cell count and the differential measurements that some reports include.",
    members: WHITE_CELL_MEMBERS,
  },
  {
    key: "platelets",
    title: "Platelet measurements",
    summary:
      "These measurements describe platelets and related indices when they are included in a report.",
    members: PLATELET_MEMBERS,
  },
];

const CBC_RELATED_MARKERS: PanelArticleMember[] = [
  member(
    "iron_serum",
    "related",
    "Serum iron is part of iron studies, a related panel that may appear near a CBC in some laboratory workflows.",
  ),
  member(
    "ferritin_serum",
    "related",
    "Ferritin is an iron-storage measurement from a related panel, not a guaranteed CBC member.",
  ),
  member(
    "transferrin_saturation_serum",
    "related",
    "Transferrin saturation belongs to iron studies and is shown here only as a related measurement.",
  ),
];

export const CBC_PANEL_ARTICLE: PanelArticle = {
  type: "panel",
  slug: "cbc",
  locale: "en",
  contentVersion: "2026-09-01.0",
  reviewStatus: "in_review",
  reviewedBy: null,
  reviewedAt: null,
  deprecatedAt: null,
  replacementSlug: null,
  panelKey: "cbc",
  title: "Complete blood count",
  summary:
    "A plain-language guide to the group of red-cell, white-cell, and platelet measurements often reported together.",
  purpose:
    "A complete blood count (CBC) is a group of measurements about blood cells and related indices. This guide explains the labels and how they are organized; it does not determine what any result means for you.",
  compositionNote:
    "A CBC is not one fixed checklist. Laboratories can include different members, use different labels, and add a white-cell differential. A member that is not shown on one report may simply not have been reported in that event; its absence is not a finding by itself.",
  subgroups: CBC_SUBGROUPS,
  relatedMarkers: CBC_RELATED_MARKERS,
  sources: [
    {
      title: "Complete Blood Count (CBC): MedlinePlus Medical Test",
      publisher: "MedlinePlus, U.S. National Library of Medicine",
      url: "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/",
      accessedAt: "2026-09-01T00:00:00Z",
    },
    {
      title: "Blood Tests",
      publisher: "National Heart, Lung, and Blood Institute",
      url: "https://www.nhlbi.nih.gov/health/blood-tests",
      accessedAt: "2026-09-01T00:00:00Z",
    },
  ],
  relatedMeasurementKeys: CBC_RELATED_MARKERS.map(
    (marker) => marker.measurementDefinitionKey,
  ),
  disclaimer: MEDICAL_DISCLAIMER,
};

/** Panel education records are version controlled and Registry-linked. */
export const PANEL_ARTICLES: readonly PanelArticle[] = [CBC_PANEL_ARTICLE];

export function getPanelArticleBySlug(
  slug: string | null | undefined,
): PanelArticle | null {
  const normalizedSlug = slug?.trim().toLocaleLowerCase("en-US") ?? "";
  return (
    PANEL_ARTICLES.find((article) => article.slug === normalizedSlug) ?? null
  );
}

export function panelEducationEligibleForPublicRoute(
  article: PanelArticle,
  panelKey: string,
): boolean {
  const normalizedKey = panelKey.trim().toLocaleLowerCase("en-US");
  if (!normalizedKey || article.panelKey !== normalizedKey) return false;
  return isPublicCatalogArticle({
    type: "panel",
    reviewStatus: article.reviewStatus,
    reviewedBy: article.reviewedBy,
    reviewedAt: article.reviewedAt,
    sources: article.sources,
    panelKey: article.panelKey,
  });
}

export function getPublicPanelEducationArticle(
  panelKey: string | null | undefined,
): PanelArticle | null {
  const article = getPanelArticleBySlug(panelKey);
  if (!article || !panelKey) return null;
  return panelEducationEligibleForPublicRoute(article, panelKey)
    ? article
    : null;
}

/** Validates canonical panel records and EH-135 enriched panel records. */
export function validatePanelEducationArticle(
  article: unknown,
): KnowledgeBaseValidation {
  const enriched = validatePanelArticle(article);
  if (enriched.valid) return enriched;

  const parsed = panelEducationArticleSchema.safeParse(article);
  if (!parsed.success) {
    return {
      valid: false,
      errors: formatKnowledgeBaseSchemaErrors(parsed.error.issues),
    };
  }

  return getPanelDefinition(parsed.data.panelKey)
    ? { valid: true, errors: [] }
    : {
        valid: false,
        errors: [`panel definition not found: ${parsed.data.panelKey}`],
      };
}
