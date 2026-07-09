import type { BiomarkerDefinition, BodySystemId, ScoreRole } from "../types";
import { BIOMARKER_DEFINITIONS } from "./definitions";
import { ALIAS_MAP } from "../normalize";

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

export { ALIAS_MAP };
