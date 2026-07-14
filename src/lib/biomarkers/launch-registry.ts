import { LAUNCH_CATALOG_MIGRATION_RECORDS } from "./launch-catalog.generated";
import { getMeasurementDefinition } from "./measurement-resolution";
import type {
  BodySystemId,
  ConversionRule,
  NamedBodySystemId,
  ScoreContributionGroup,
  ScoreRequiredGroup,
  ScoreRole,
  SystemScoreability,
} from "./types";

export type LaunchCatalogRecord = (typeof LAUNCH_CATALOG_MIGRATION_RECORDS)[number];
export { LAUNCH_CATALOG_MIGRATION_RECORDS };

const BLOCKED_TOKENS = new Set(["n_a", "na_", "n_a_", "null", "none", "unknown", "not_applicable", "not_available"]);

export function normalizeLaunchToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/ё/g, "е").replace(/[^a-z0-9а-я]+/gi, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
}

const byKey = new Map(LAUNCH_CATALOG_MIGRATION_RECORDS.map((record) => [record.analyteKey, record]));
const aliasMap = new Map<string, string>();
for (const record of LAUNCH_CATALOG_MIGRATION_RECORDS) {
  aliasMap.set(record.analyteKey, record.analyteKey);
  for (const alias of record.aliases) {
    const token = normalizeLaunchToken(alias);
    if (token && !BLOCKED_TOKENS.has(token) && !aliasMap.has(token)) aliasMap.set(token, record.analyteKey);
  }
}
for (const [alias, key] of Object.entries({ na: "sodium", k: "potassium", cl: "chloride", ca: "calcium", mg: "magnesium", fe: "iron", hb: "hemoglobin", tg: "triglycerides", tc: "total_cholesterol" })) {
  aliasMap.set(alias, key);
}

export function resolveLaunchCatalogKey(key: string, name = ""): string {
  const keyToken = normalizeLaunchToken(key);
  const nameToken = normalizeLaunchToken(name);
  const token = BLOCKED_TOKENS.has(keyToken) ? nameToken : keyToken || nameToken;
  if (!token || BLOCKED_TOKENS.has(token)) return nameToken || "unknown";
  return aliasMap.get(token) ?? aliasMap.get(nameToken) ?? token;
}

export function getLaunchCatalogRecord(key: string): LaunchCatalogRecord | undefined {
  return byKey.get(resolveLaunchCatalogKey(key, key));
}

export function getLaunchConversion(key: string): ConversionRule | null {
  const resolvedKey = getMeasurementDefinition(key)?.analyteKey ?? key;
  return getLaunchCatalogRecord(resolvedKey)?.conversion ?? null;
}

export function getLaunchScoreRole(key: string): ScoreRole {
  return getLaunchCatalogRecord(key)?.scoreRole ?? "display";
}

export function getLaunchSystem(key: string): BodySystemId {
  return getLaunchCatalogRecord(key)?.system ?? "general";
}

export function getLaunchSpecimen(key: string): string | null {
  const specimen = getLaunchCatalogRecord(key)?.specimen;
  return specimen && specimen !== "unspecified" ? specimen : null;
}

export function listLaunchCoverageKeys(system: BodySystemId): string[] {
  return LAUNCH_CATALOG_MIGRATION_RECORDS.filter((record) => record.system === system && record.scoreRole !== "display").map((record) => record.analyteKey);
}

export const NAMED_BODY_SYSTEMS: readonly NamedBodySystemId[] = ["cardiovascular", "metabolic", "thyroid", "liver", "kidney", "blood", "nutrients", "inflammation"];
export const BODY_SYSTEM_LABELS: Record<BodySystemId, string> = { cardiovascular: "Cardiovascular", metabolic: "Metabolic", thyroid: "Thyroid", liver: "Liver", kidney: "Kidney", blood: "Blood", nutrients: "Nutrients", inflammation: "Inflammation", general: "General" };
export const NON_SCOREABLE_SYSTEMS = new Set<NamedBodySystemId>(["inflammation"]);
export const SCOREABILITY_BY_SYSTEM: Record<NamedBodySystemId, SystemScoreability> = { cardiovascular: "incomplete", metabolic: "incomplete", thyroid: "incomplete", liver: "incomplete", kidney: "incomplete", blood: "incomplete", nutrients: "incomplete", inflammation: "non_scoreable" };
export const SCORE_REQUIRED_GROUPS: Record<NamedBodySystemId, readonly ScoreRequiredGroup[]> = { cardiovascular: [["ldl", "non_hdl_cholesterol"], ["hdl"], ["triglycerides"]], metabolic: [["fasting_glucose", "hba1c"]], thyroid: [["tsh"], ["free_t4"]], liver: [["alt"], ["ast"], ["alp"], ["bilirubin"], ["albumin"]], kidney: [["egfr", "creatinine"], ["uacr"]], blood: [["hemoglobin", "hematocrit"], ["wbc"], ["platelets"], ["mcv"]], nutrients: [["vitamin_d"], ["b12"], ["folate"]], inflammation: [] };
export const SCORE_CONTRIBUTION_GROUPS: Record<NamedBodySystemId, readonly ScoreContributionGroup[]> = { cardiovascular: [{ id: "atherogenic_cholesterol", keys: ["ldl", "non_hdl_cholesterol"] }, { id: "hdl", keys: ["hdl"] }, { id: "triglycerides", keys: ["triglycerides"] }, { id: "total_cholesterol", keys: ["total_cholesterol"] }], metabolic: [{ id: "glycemia", keys: ["fasting_glucose", "hba1c", "glucose"] }], thyroid: [{ id: "tsh", keys: ["tsh"] }, { id: "free_t4", keys: ["free_t4"] }], liver: [{ id: "alt", keys: ["alt"] }, { id: "ast", keys: ["ast"] }, { id: "alp", keys: ["alp"] }, { id: "bilirubin", keys: ["bilirubin"] }, { id: "albumin", keys: ["albumin"] }, { id: "ggt", keys: ["ggt"] }], kidney: [{ id: "filtration", keys: ["egfr", "creatinine"] }, { id: "albuminuria", keys: ["uacr"] }, { id: "nitrogen_waste", keys: ["bun", "urea"] }, { id: "sodium", keys: ["sodium"] }, { id: "potassium", keys: ["potassium"] }, { id: "chloride", keys: ["chloride"] }, { id: "acid_base", keys: ["bicarbonate"] }, { id: "calcium", keys: ["calcium"] }], blood: [{ id: "red_cell_mass", keys: ["hemoglobin", "hematocrit", "rbc"] }, { id: "red_cell_size", keys: ["mcv"] }, { id: "red_cell_variation", keys: ["rdw"] }, { id: "white_cells", keys: ["wbc"] }, { id: "platelets", keys: ["platelets"] }], nutrients: [{ id: "vitamin_d", keys: ["vitamin_d"] }, { id: "b12", keys: ["b12"] }, { id: "folate", keys: ["folate"] }], inflammation: [] };
