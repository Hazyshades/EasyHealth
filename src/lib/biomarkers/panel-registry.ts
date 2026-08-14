import { MEASUREMENT_DEFINITIONS } from "./measurement-resolution";
import type {
  MeasurementDefinition,
  MeasurementDefinitionKey,
  PanelDefinition,
  PanelKey,
  PanelMember,
  PanelMemberRole,
} from "./types";

export const PANEL_REGISTRY_VERSION = "2026-08-12.0";
export const REQUIRED_PANEL_KEYS = ["cbc", "lipid", "thyroid", "liver", "kidney", "iron_studies"] as const;

function member(
  measurementDefinitionKey: MeasurementDefinitionKey,
  role: PanelMemberRole,
  displayOrder: number,
): PanelMember {
  return { measurementDefinitionKey, role, displayOrder };
}

const CBC_MEMBERS: readonly PanelMember[] = [
  member("hemoglobin_whole_blood", "required", 10),
  member("hematocrit_whole_blood", "required", 20),
  member("rbc_whole_blood", "required", 30),
  member("wbc_whole_blood", "required", 40),
  member("platelets_whole_blood", "required", 50),
  member("mcv_whole_blood", "optional", 60),
  member("mch_whole_blood", "optional", 70),
  member("mchc_whole_blood", "optional", 80),
  member("rdw_cv", "optional", 90),
  member("rdw_sd", "optional", 100),
  member("mpv_whole_blood", "optional", 110),
  member("pdw_cv", "optional", 120),
  member("plateletcrit_percent", "optional", 130),
  member("neutrophils_percent", "optional", 140),
  member("neutrophils_abs", "optional", 150),
  member("lymphocytes_percent", "optional", 160),
  member("lymphocytes_abs", "optional", 170),
  member("monocytes_percent", "optional", 180),
  member("monocytes_abs", "optional", 190),
  member("eosinophils_percent", "optional", 200),
  member("eosinophils_abs", "optional", 210),
  member("basophils_percent", "optional", 220),
  member("basophils_abs", "optional", 230),
  member("reticulocytes_percent", "optional", 240),
  member("reticulocytes_abs", "optional", 250),
  member("segmented_neutrophils_percent", "optional", 260),
  member("band_neutrophils_percent", "optional", 270),
  member("lymphocytes_manual_percent", "optional", 280),
  member("monocytes_manual_percent", "optional", 290),
  member("eosinophils_manual_percent", "optional", 300),
];

export const PANEL_DEFINITIONS: readonly PanelDefinition[] = [
  {
    key: "cbc",
    displayName: "Complete blood count",
    alternateNames: ["Complete blood count with differential", "Full blood count"],
    members: CBC_MEMBERS,
  },
  {
    key: "lipid",
    displayName: "Lipid panel",
    alternateNames: ["Lipid profile", "Cholesterol panel"],
    members: [
      member("total_cholesterol_serum", "required", 10),
      member("ldl_serum", "required", 20),
      member("hdl_serum", "required", 30),
      member("triglycerides_serum", "required", 40),
      member("non_hdl_cholesterol_serum", "optional", 50),
    ],
  },
  {
    key: "thyroid",
    displayName: "Thyroid panel",
    alternateNames: ["Thyroid function tests", "Thyroid function panel"],
    members: [
      member("tsh_serum", "required", 10),
      member("free_t4_serum", "required", 20),
    ],
  },
  {
    key: "liver",
    displayName: "Liver panel",
    alternateNames: ["Liver function tests", "Hepatic panel"],
    members: [
      member("alt_serum_catalytic_activity", "required", 10),
      member("ast_serum_catalytic_activity", "required", 20),
      member("bilirubin_serum", "required", 30),
      member("albumin_serum", "required", 40),
      member("alp_serum_catalytic_activity", "optional", 50),
      member("ggt_serum_catalytic_activity", "optional", 60),
      member("alt_plasma_catalytic_activity", "optional", 70),
      member("ast_plasma_catalytic_activity", "optional", 80),
      member("alp_plasma_catalytic_activity", "optional", 90),
      member("ggt_plasma_catalytic_activity", "optional", 100),
    ],
  },
  {
    key: "kidney",
    displayName: "Kidney panel",
    alternateNames: ["Renal panel", "Renal function tests"],
    members: [
      member("egfr", "required", 10),
      member("creatinine_serum", "required", 20),
      member("bun_serum", "optional", 30),
      member("urea_serum", "optional", 40),
      member("uacr_urine", "optional", 50),
      member("sodium_serum", "optional", 60),
      member("potassium_serum", "optional", 70),
      member("chloride_serum", "optional", 80),
      member("bicarbonate_serum", "optional", 90),
      member("calcium_serum", "optional", 100),
    ],
  },
  {
    key: "iron_studies",
    displayName: "Iron studies",
    alternateNames: ["Iron panel", "Iron profile"],
    members: [
      member("iron_serum", "required", 10),
      member("ferritin_serum", "required", 20),
      member("tibc_serum", "optional", 30),
      member("uibc_serum", "optional", 40),
      member("transferrin_serum", "optional", 50),
      member("transferrin_saturation_serum", "optional", 60),
      member("hemoglobin_whole_blood", "optional", 70),
    ],
  },
];

const PANEL_BY_KEY: Readonly<Record<string, PanelDefinition>> = Object.fromEntries(
  PANEL_DEFINITIONS.map((definition) => [definition.key, definition]),
);
const PANELS_BY_MEASUREMENT_KEY: Record<string, readonly PanelDefinition[]> = Object.create(null);
for (const panel of PANEL_DEFINITIONS) {
  for (const entry of panel.members) {
    const panels = PANELS_BY_MEASUREMENT_KEY[entry.measurementDefinitionKey] ?? [];
    PANELS_BY_MEASUREMENT_KEY[entry.measurementDefinitionKey] = [...panels, panel];
  }
}

export function listPanelDefinitions(): readonly PanelDefinition[] {
  return PANEL_DEFINITIONS;
}

export function getPanelDefinition(key: PanelKey | null | undefined): PanelDefinition | null {
  return key ? PANEL_BY_KEY[key] ?? null : null;
}

export function listPanelsForMeasurementDefinition(
  measurementDefinitionKey: MeasurementDefinitionKey | null | undefined,
): readonly PanelDefinition[] {
  return measurementDefinitionKey ? PANELS_BY_MEASUREMENT_KEY[measurementDefinitionKey] ?? [] : [];
}

export type PanelRegistryValidation = Readonly<{ valid: boolean; errors: readonly string[] }>;

function normalizedPanelName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function validatePanelRegistry(
  panels: readonly PanelDefinition[] = PANEL_DEFINITIONS,
  definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS,
): PanelRegistryValidation {
  const errors: string[] = [];
  const panelKeys = new Set<PanelKey>();
  const panelNames = new Map<string, PanelKey>();
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  for (const panel of panels) {
    if (!panel.key) errors.push("Panel key must not be empty");
    if (panelKeys.has(panel.key)) errors.push(`Duplicate panel key: ${panel.key}`);
    panelKeys.add(panel.key);
    if (!panel.displayName.trim()) errors.push(`Panel display name must not be empty: ${panel.key}`);
    if (panel.members.length === 0) errors.push(`Panel must have at least one member: ${panel.key}`);

    for (const name of [panel.displayName, ...panel.alternateNames]) {
      const normalizedName = normalizedPanelName(name);
      if (!normalizedName) {
        errors.push(`Panel name must not be empty: ${panel.key}`);
        continue;
      }
      const owner = panelNames.get(normalizedName);
      if (owner !== undefined) errors.push(`Duplicate panel name: ${name}`);
      else panelNames.set(normalizedName, panel.key);
    }

    const memberKeys = new Set<MeasurementDefinitionKey>();
    const displayOrders = new Set<number>();
    for (const entry of panel.members) {
      if (memberKeys.has(entry.measurementDefinitionKey)) {
        errors.push(`Duplicate panel member: ${panel.key}/${entry.measurementDefinitionKey}`);
      }
      memberKeys.add(entry.measurementDefinitionKey);
      if (entry.role !== "required" && entry.role !== "optional") {
        errors.push(`Invalid panel member role: ${panel.key}/${entry.measurementDefinitionKey}`);
      }
      if (!Number.isInteger(entry.displayOrder) || entry.displayOrder <= 0) {
        errors.push(`Invalid panel display order: ${panel.key}/${entry.measurementDefinitionKey}`);
      }
      if (displayOrders.has(entry.displayOrder)) {
        errors.push(`Duplicate panel display order: ${panel.key}/${entry.displayOrder}`);
      }
      displayOrders.add(entry.displayOrder);
      const definition = definitionsByKey.get(entry.measurementDefinitionKey);
      if (definition === undefined) {
        errors.push(`Unknown panel member definition: ${panel.key}/${entry.measurementDefinitionKey}`);
      } else if (definition.maturity !== "reviewed" || definition.sourceProvenance.kind !== "registry_v2_review") {
        errors.push(`Panel member is not a reviewed Registry 2.0 definition: ${panel.key}/${entry.measurementDefinitionKey}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
