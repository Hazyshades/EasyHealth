import type {
  BiomarkerDefinition,
  BodySystemId,
  NamedBodySystemId,
  ScoreContributionGroup,
  ScoreRequiredGroup,
  ScoreRole,
  SystemScoreability,
} from "../types";
import { BIOMARKER_DEFINITIONS } from "./definitions";

const BY_KEY = new Map<string, BiomarkerDefinition>();
for (const def of BIOMARKER_DEFINITIONS) {
  BY_KEY.set(def.key, def);
}

export { BIOMARKER_DEFINITIONS };

export function getBiomarkerDefinition(key: string): BiomarkerDefinition | undefined {
  return BY_KEY.get(key);
}

export function listKeysForSystem(system: BodySystemId): string[] {
  return BIOMARKER_DEFINITIONS.filter((d) => d.system === system).map((d) => d.key);
}

export function listCoverageKeysForSystem(system: BodySystemId): string[] {
  return BIOMARKER_DEFINITIONS.filter((d) => d.system === system && d.coversConfidence).map(
    (d) => d.key
  );
}

export function listCoreKeysForSystem(system: BodySystemId): string[] {
  return BIOMARKER_DEFINITIONS.filter(
    (d) => d.system === system && d.scoreRole === "core"
  ).map((d) => d.key);
}

export function getScoreRole(key: string): ScoreRole {
  return BY_KEY.get(key)?.scoreRole ?? "display";
}

/** Body systems used for health profile (excluding general). */
export const NAMED_BODY_SYSTEMS: Exclude<BodySystemId, "general">[] = [
  "cardiovascular",
  "metabolic",
  "thyroid",
  "liver",
  "kidney",
  "blood",
  "nutrients",
  "inflammation",
];

/** Technical minimum evidence for a current-state score. This is product policy, not diagnosis logic. */
export const SCORE_REQUIRED_GROUPS: Record<NamedBodySystemId, readonly ScoreRequiredGroup[]> = {
  cardiovascular: [["ldl", "non_hdl_cholesterol"], ["hdl"], ["triglycerides"]],
  metabolic: [["fasting_glucose", "hba1c"]],
  thyroid: [["tsh"], ["free_t4"]],
  liver: [["alt"], ["ast"], ["alp"], ["bilirubin"], ["albumin"]],
  kidney: [["egfr", "creatinine"], ["uacr"]],
  blood: [["hemoglobin", "hematocrit"], ["wbc"], ["platelets"], ["mcv"]],
  nutrients: [["vitamin_d"], ["b12"], ["folate"]],
  inflammation: [],
};

/** Empty required groups never mean scoreable: inflammation is intentionally factual-only in MVP. */
export const NON_SCOREABLE_SYSTEMS = new Set<NamedBodySystemId>(["inflammation"]);

export const SCOREABILITY_BY_SYSTEM: Record<NamedBodySystemId, SystemScoreability> = {
  cardiovascular: "incomplete",
  metabolic: "incomplete",
  thyroid: "incomplete",
  liver: "incomplete",
  kidney: "incomplete",
  blood: "incomplete",
  nutrients: "incomplete",
  inflammation: "non_scoreable",
};

/**
 * Score axes and precedence. Optional core markers may contribute when observed,
 * but only one marker from an axis can affect the numeric result.
 */
export const SCORE_CONTRIBUTION_GROUPS: Record<
  NamedBodySystemId,
  readonly ScoreContributionGroup[]
> = {
  cardiovascular: [
    { id: "atherogenic_cholesterol", keys: ["ldl", "non_hdl_cholesterol"] },
    { id: "hdl", keys: ["hdl"] },
    { id: "triglycerides", keys: ["triglycerides"] },
    { id: "total_cholesterol", keys: ["total_cholesterol"] },
  ],
  metabolic: [{ id: "glycemia", keys: ["fasting_glucose", "hba1c", "glucose"] }],
  thyroid: [
    { id: "tsh", keys: ["tsh"] },
    { id: "free_t4", keys: ["free_t4"] },
  ],
  liver: [
    { id: "alt", keys: ["alt"] },
    { id: "ast", keys: ["ast"] },
    { id: "alp", keys: ["alp"] },
    { id: "bilirubin", keys: ["bilirubin"] },
    { id: "albumin", keys: ["albumin"] },
    { id: "ggt", keys: ["ggt"] },
  ],
  kidney: [
    { id: "filtration", keys: ["egfr", "creatinine"] },
    { id: "albuminuria", keys: ["uacr"] },
    { id: "nitrogen_waste", keys: ["bun", "urea"] },
    { id: "sodium", keys: ["sodium"] },
    { id: "potassium", keys: ["potassium"] },
    { id: "chloride", keys: ["chloride"] },
    { id: "acid_base", keys: ["bicarbonate"] },
    { id: "calcium", keys: ["calcium"] },
  ],
  blood: [
    { id: "red_cell_mass", keys: ["hemoglobin", "hematocrit", "rbc"] },
    { id: "red_cell_size", keys: ["mcv"] },
    { id: "red_cell_variation", keys: ["rdw"] },
    { id: "white_cells", keys: ["wbc"] },
    { id: "platelets", keys: ["platelets"] },
  ],
  nutrients: [
    { id: "vitamin_d", keys: ["vitamin_d"] },
    { id: "b12", keys: ["b12"] },
    { id: "folate", keys: ["folate"] },
  ],
  inflammation: [],
};

export const BODY_SYSTEM_LABELS: Record<BodySystemId, string> = {
  cardiovascular: "Cardiovascular",
  metabolic: "Metabolic",
  thyroid: "Thyroid",
  liver: "Liver",
  kidney: "Kidney",
  blood: "Blood",
  nutrients: "Nutrients",
  inflammation: "Inflammation",
  general: "General",
};

/** Derived marker → system map from catalog. */
export function buildMarkerToSystemMap(): Map<string, Exclude<BodySystemId, "general">> {
  const map = new Map<string, Exclude<BodySystemId, "general">>();
  for (const def of BIOMARKER_DEFINITIONS) {
    if (def.system === "general") continue;
    map.set(def.key, def.system);
  }
  return map;
}
