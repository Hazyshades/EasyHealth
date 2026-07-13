import { snakeCaseToken } from "./normalize";
import { BIOMARKER_DEFINITIONS, getBiomarkerDefinition } from "./catalog";
import type {
  CandidateEvidence,
  Analyte,
  MappingConfidenceBand,
  MeasurementAlias,
  MeasurementDefinition,
  MeasurementResolution,
  MeasurementResolutionInput,
  MeasurementUnitPolicy,
  NormalizedMeasurementUnit,
  ResolutionEvidence,
  ResolutionReasonCode,
  UnitDimension,
  UnitToken,
} from "./types";

export const MEASUREMENT_REGISTRY_VERSION = "2026-07-13.0";
export const MEASUREMENT_RESOLVER_VERSION = "2";
export const MEASUREMENT_NORMALIZATION_SCHEMA_VERSION = "2";

const CELL_CONCENTRATION_UNITS = ["10^9/l", "10^3/ul"] as const;
const PERCENT_POLICY: MeasurementUnitPolicy = {
  dimensions: ["ratio"],
  acceptedUnits: ["%"],
  canonicalUnit: "%",
  conversionPolicyRef: null,
  missingUnitPolicy: "ambiguous",
};
const CELL_CONCENTRATION_POLICY: MeasurementUnitPolicy = {
  dimensions: ["cell_concentration"],
  acceptedUnits: CELL_CONCENTRATION_UNITS,
  canonicalUnit: "10^9/l",
  conversionPolicyRef: "equivalent-cell-count",
  missingUnitPolicy: "ambiguous",
};
const VOLUME_POLICY: MeasurementUnitPolicy = {
  dimensions: ["volume"],
  acceptedUnits: ["fl"],
  canonicalUnit: "fl",
  conversionPolicyRef: null,
  missingUnitPolicy: "ambiguous",
};
const GLUCOSE_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"],
  acceptedUnits: ["mg/dl", "mmol/l"],
  canonicalUnit: "mmol/l",
  conversionPolicyRef: "biomarker:glucose",
  missingUnitPolicy: "ambiguous",
};
const QUALITATIVE_URINE_POLICY: MeasurementUnitPolicy = {
  dimensions: [],
  acceptedUnits: [],
  canonicalUnit: null,
  conversionPolicyRef: null,
  missingUnitPolicy: "display_only",
};

function aliases(
  values: readonly string[],
  options: Omit<MeasurementAlias, "value" | "normalizedValue"> = {
    source: "registry",
    matchType: "normalized",
  }
): MeasurementAlias[] {
  return values.map((value) => ({
    value,
    normalizedValue: snakeCaseToken(value),
    ...options,
  }));
}

const registryAliases = (values: readonly string[]) => aliases(values);
const ocrAliases = (values: readonly string[]) =>
  aliases(values, { source: "fixture", matchType: "ocr_variant" });

type CuratedInput = Omit<MeasurementDefinition, "definitionSource" | "specimen" | "property" | "scale" | "timing" | "method"> & Partial<Pick<MeasurementDefinition, "specimen" | "property" | "scale" | "timing" | "method">>;

const CURATED_RAW: readonly CuratedInput[] = [
  {
    key: "neutrophils_abs",
    analyteKey: "neutrophils",
    displayName: "Neutrophils, absolute",
    canonicalKey: "neutrophils",
    aliases: [...registryAliases(["neutrophils", "neutrophils_abs", "anc", "absolute_neutrophil_count"])],
    unitPolicy: CELL_CONCENTRATION_POLICY,
    allowedSpecimens: ["whole_blood"],
    requiredModifiers: ["absolute"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "neutrophils_percent",
    analyteKey: "neutrophils",
    displayName: "Neutrophils, percent",
    canonicalKey: "neutrophils_percent",
    aliases: [
      ...registryAliases(["neutrophils", "neutrophils_percent", "neu_percent"]),
      ...ocrAliases(["neutrophils_"]),
    ],
    unitPolicy: PERCENT_POLICY,
    allowedSpecimens: ["whole_blood"],
    requiredModifiers: ["percent"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "lymphocytes_abs",
    analyteKey: "lymphocytes",
    displayName: "Lymphocytes, absolute",
    canonicalKey: "lymphocytes",
    aliases: registryAliases(["lymphocytes", "lymphocytes_abs", "absolute_lymphocyte_count"]),
    unitPolicy: CELL_CONCENTRATION_POLICY,
    allowedSpecimens: ["whole_blood"],
    requiredModifiers: ["absolute"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "lymphocytes_percent",
    analyteKey: "lymphocytes",
    displayName: "Lymphocytes, percent",
    canonicalKey: "lymphocytes_percent",
    aliases: registryAliases(["lymphocytes", "lymphocytes_percent", "lym_percent"]),
    unitPolicy: PERCENT_POLICY,
    allowedSpecimens: ["whole_blood"],
    requiredModifiers: ["percent"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "rdw_cv",
    analyteKey: "red_cell_distribution_width",
    displayName: "RDW-CV",
    canonicalKey: "rdw",
    aliases: registryAliases(["rdw_cv", "rdw-cv", "rdw"]),
    unitPolicy: PERCENT_POLICY,
    assessmentCompatibility: "compatible",
  },
  {
    key: "rdw_sd",
    analyteKey: "red_cell_distribution_width",
    displayName: "RDW-SD",
    canonicalKey: null,
    aliases: registryAliases(["rdw_sd", "rdw-sd", "rdw"]),
    unitPolicy: VOLUME_POLICY,
    assessmentCompatibility: "display_only",
  },
  {
    key: "reticulocytes_abs",
    analyteKey: "reticulocytes",
    displayName: "Reticulocytes, absolute",
    canonicalKey: null,
    aliases: registryAliases(["reticulocytes", "reticulocytes_abs", "absolute_reticulocyte_count"]),
    unitPolicy: CELL_CONCENTRATION_POLICY,
    allowedSpecimens: ["whole_blood"],
    requiredModifiers: ["absolute"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "reticulocytes_percent",
    analyteKey: "reticulocytes",
    displayName: "Reticulocytes, percent",
    canonicalKey: null,
    aliases: registryAliases(["reticulocytes", "reticulocytes_percent", "retic_percent"]),
    unitPolicy: PERCENT_POLICY,
    allowedSpecimens: ["whole_blood"],
    requiredModifiers: ["percent"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "glucose_serum",
    analyteKey: "glucose",
    displayName: "Glucose, serum",
    canonicalKey: "glucose",
    aliases: registryAliases(["glucose", "blood_glucose", "serum_glucose"]),
    unitPolicy: GLUCOSE_POLICY,
    allowedSpecimens: ["serum"],
    assessmentCompatibility: "compatible",
  },
  {
    key: "glucose_plasma",
    analyteKey: "glucose",
    displayName: "Glucose, plasma",
    canonicalKey: "glucose",
    aliases: registryAliases(["glucose", "blood_glucose", "plasma_glucose"]),
    unitPolicy: GLUCOSE_POLICY,
    allowedSpecimens: ["plasma"],
    assessmentCompatibility: "compatible",
  },
  {
    key: "glucose_whole_blood",
    analyteKey: "glucose",
    displayName: "Glucose, whole blood",
    canonicalKey: "glucose",
    aliases: registryAliases(["glucose", "blood_glucose", "whole_blood_glucose"]),
    unitPolicy: GLUCOSE_POLICY,
    allowedSpecimens: ["whole_blood"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "glucose_urine",
    analyteKey: "glucose",
    displayName: "Glucose, urine",
    canonicalKey: "urine_glucose_dipstick",
    aliases: registryAliases(["glucose", "urine_glucose", "glucose_urine"]),
    unitPolicy: QUALITATIVE_URINE_POLICY,
    allowedSpecimens: ["urine"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "fasting_glucose",
    analyteKey: "glucose",
    displayName: "Fasting glucose",
    canonicalKey: "fasting_glucose",
    aliases: registryAliases(["fasting_glucose", "fpg", "fasting_plasma_glucose"]),
    unitPolicy: GLUCOSE_POLICY,
    allowedSpecimens: ["serum", "plasma"],
    requiredModifiers: ["fasting"],
    assessmentCompatibility: "compatible",
  },
  {
    key: "segmented_neutrophils_percent",
    analyteKey: "neutrophils",
    displayName: "Segmented neutrophils, percent",
    canonicalKey: null,
    aliases: registryAliases(["segmented_neutrophils", "segs", "segmented_neutrophils_percent"]),
    unitPolicy: PERCENT_POLICY,
    allowedSpecimens: ["whole_blood"],
    requiredModifiers: ["percent"],
    assessmentCompatibility: "display_only",
  },
  {
    key: "band_neutrophils_percent",
    analyteKey: "neutrophils",
    displayName: "Band neutrophils, percent",
    canonicalKey: null,
    aliases: registryAliases(["band_neutrophils", "bands", "band_neutrophils_percent"]),
    unitPolicy: PERCENT_POLICY,
    allowedSpecimens: ["whole_blood"],
    requiredModifiers: ["percent"],
    assessmentCompatibility: "display_only",
  },
];

function curated(definition: CuratedInput): MeasurementDefinition {
  const unit = definition.unitPolicy;
  const specimen = definition.specimen ?? (definition.allowedSpecimens?.[0] as MeasurementDefinition["specimen"] | undefined) ?? "unspecified";
  const property = definition.property ?? (definition.key.startsWith("segmented_") ? "segmented_percentage" : definition.key.startsWith("band_") ? "band_percentage" : unit.dimensions.includes("cell_concentration") ? "cell_count" : unit.dimensions.includes("ratio") ? "percentage" : unit.dimensions.includes("volume") ? "distribution_width" : unit.dimensions.length ? "substance_concentration" : "presence");
  return { ...definition, definitionSource: "curated", specimen, property, scale: definition.scale ?? (property === "presence" ? "nominal" : "quantitative"), timing: definition.timing ?? (definition.requiredModifiers?.includes("fasting") ? "fasting" : "point_in_time"), method: definition.method ?? (definition.key.includes("urine") ? "dipstick" : "automated") };
}

export const CURATED_MEASUREMENT_DEFINITIONS: readonly MeasurementDefinition[] = CURATED_RAW.map(curated);

const ANALYTE_ENTRIES: readonly (readonly [string, Analyte])[] = [
  ...BIOMARKER_DEFINITIONS.map((definition): readonly [string, Analyte] => [definition.key, { key: definition.key, displayName: definition.displayName, aliases: [definition.key, ...definition.aliases], status: "active" }]),
  ...CURATED_RAW.map((definition): readonly [string, Analyte] => [definition.analyteKey, { key: definition.analyteKey, displayName: definition.analyteKey, aliases: [definition.analyteKey], status: "active" }]),
];
export const ANALYTES: readonly Analyte[] = [...new Map<string, Analyte>(ANALYTE_ENTRIES).values()];
const ANALYTE_BY_KEY = new Map(ANALYTES.map((analyte) => [analyte.key, analyte]));

function fallbackDefinition(definition: (typeof BIOMARKER_DEFINITIONS)[number]): MeasurementDefinition {
  const specimen = definition.specimen && definition.specimen !== "any" ? definition.specimen : "unspecified";
  return {
    key: `legacy_${definition.key}`,
    analyteKey: definition.key,
    definitionSource: "legacy_adapter",
    specimen,
    property: "unspecified",
    scale: "unspecified",
    timing: "unspecified",
    method: "unspecified",
    displayName: definition.displayName,
    canonicalKey: definition.key,
    aliases: registryAliases([definition.key, ...definition.aliases]),
    unitPolicy: QUALITATIVE_URINE_POLICY,
    allowedSpecimens: specimen === "unspecified" ? undefined : [specimen],
    assessmentCompatibility: definition.scoreRole === "core" ? "compatible" : "display_only",
  };
}

const CURATED_LEGACY_KEYS = new Set(CURATED_MEASUREMENT_DEFINITIONS.flatMap((definition) => definition.canonicalKey ? [definition.canonicalKey] : []));
export const LEGACY_COMPATIBILITY_DEFINITIONS: readonly MeasurementDefinition[] = BIOMARKER_DEFINITIONS
  .filter((definition) => !CURATED_LEGACY_KEYS.has(definition.key))
  .sort((left, right) => left.key.localeCompare(right.key))
  .map(fallbackDefinition);
export const MEASUREMENT_DEFINITIONS: readonly MeasurementDefinition[] = [...CURATED_MEASUREMENT_DEFINITIONS, ...LEGACY_COMPATIBILITY_DEFINITIONS];
export const MEASUREMENT_ADAPTER_VERSION = "1";

const DEFINITION_BY_KEY = new Map(MEASUREMENT_DEFINITIONS.map((definition) => [definition.key, definition]));

function normalizeRawUnit(rawUnit: string): string {
  return rawUnit
    .trim()
    .toLowerCase()
    .replace(/[\u00b5\u03bc]/g, "u")
    .replace(/\u00d7/g, "x")
    .replace(/\u2079/g, "9")
    .replace(/\s+/g, "")
    .replace(/x?10\^?9\/l/g, "10^9/l")
    .replace(/x?10\^?3\/(ul|u?l)/g, "10^3/ul");
}

export function normalizeMeasurementUnit(rawUnit: string | null | undefined): NormalizedMeasurementUnit {
  const raw = rawUnit?.trim() ?? "";
  const unit = normalizeRawUnit(raw);
  if (!unit) return { raw, normalizedUnit: null, dimension: null };
  if (unit === "%" || unit === "percent") return { raw, normalizedUnit: "%", dimension: "ratio" };
  if (unit === "fl" || unit === "femtoliter" || unit === "femtolitre") {
    return { raw, normalizedUnit: "fl", dimension: "volume" };
  }
  if (unit === "10^9/l" || unit === "10^3/ul" || /\/ul$/.test(unit)) {
    return { raw, normalizedUnit: unit === "10^3/ul" ? "10^3/ul" : "10^9/l", dimension: "cell_concentration" };
  }
  if (unit === "mmol/l" || unit === "umol/l" || unit === "nmol/l" || unit === "pmol/l") {
    return { raw, normalizedUnit: unit, dimension: "molar_concentration" };
  }
  if (["mg/dl", "g/dl", "g/l", "ng/ml", "pg/ml", "ug/dl"].includes(unit)) {
    return { raw, normalizedUnit: unit, dimension: "mass_concentration" };
  }
  return { raw, normalizedUnit: unit, dimension: null };
}

/** @deprecated Use `normalizeMeasurementUnit`; retained for Registry 2.0 draft callers. */
export function normalizeUnitToken(unit: string | null | undefined): UnitToken {
  return normalizeMeasurementUnit(unit).dimension ?? "unknown";
}

function normalizedModifier(input: MeasurementResolutionInput): string {
  const explicit = input.modifier?.trim().toLowerCase();
  if (explicit && explicit !== "none") return explicit;
  const label = input.rawLabel.toLowerCase();
  if (/fasting|fpg/.test(label)) return "fasting";
  if (/absolute|abs\b/.test(label)) return "absolute";
  if (/percent|%/.test(label)) return "percent";
  return "none";
}

function evidence(
  code: ResolutionReasonCode,
  source: ResolutionEvidence["source"],
  strength: ResolutionEvidence["strength"],
  observed?: string,
  expected?: readonly string[]
): ResolutionEvidence {
  return { code, source, strength, ...(observed ? { observed } : {}), ...(expected ? { expected } : {}) };
}

function aliasMatch(definition: MeasurementDefinition, label: string): MeasurementAlias | null {
  return definition.aliases.find((alias) => alias.normalizedValue === label) ?? null;
}

function matchesDefinition(definition: MeasurementDefinition, label: string): MeasurementAlias | "key" | null {
  if (definition.key === label) return "key";
  return aliasMatch(definition, label);
}

function buildCandidateEvidence(
  definition: MeasurementDefinition,
  input: MeasurementResolutionInput,
  label: string,
  proposed: string,
  unit: NormalizedMeasurementUnit,
  specimen: string,
  modifier: string,
  source: "label" | "proposed"
): CandidateEvidence {
  const accepted: ResolutionEvidence[] = [];
  const rejected: ResolutionEvidence[] = [];
  const match = matchesDefinition(definition, source === "label" ? label : proposed);

  if (match === "key") {
    accepted.push(evidence("definition_key_match", "label", "strong", definition.key));
  } else if (match) {
    const code =
      match.matchType === "exact"
        ? "alias_exact_match"
        : match.matchType === "ocr_variant"
          ? "alias_ocr_variant_match"
          : "alias_normalized_match";
    accepted.push(evidence(code, "label", match.matchType === "ocr_variant" ? "weak" : "strong", match.value));
  } else if (source === "proposed") {
    accepted.push(evidence("proposed_key_match", "label", "weak", proposed));
  }

  if (unit.normalizedUnit == null) {
    if (definition.unitPolicy.missingUnitPolicy === "reject") {
      rejected.push(evidence("unit_missing", "unit", "hard"));
    } else {
      accepted.push(evidence("unit_missing", "unit", "weak"));
    }
  } else if (unit.dimension == null || !definition.unitPolicy.dimensions.includes(unit.dimension)) {
    rejected.push(
      evidence("unit_dimension_conflict", "unit", "hard", unit.normalizedUnit, definition.unitPolicy.dimensions)
    );
  } else if (!definition.unitPolicy.acceptedUnits.includes(unit.normalizedUnit)) {
    rejected.push(
      evidence("unit_not_accepted", "unit", "hard", unit.normalizedUnit, definition.unitPolicy.acceptedUnits)
    );
  } else {
    accepted.push(evidence("unit_compatible", "unit", "strong", unit.normalizedUnit));
  }

  if (definition.allowedSpecimens?.length && specimen !== "unspecified") {
    if (!definition.allowedSpecimens.includes(specimen)) {
      rejected.push(evidence("specimen_conflict", "specimen", "hard", specimen, definition.allowedSpecimens));
    } else {
      accepted.push(evidence("specimen_compatible", "specimen", "strong", specimen));
    }
  }

  if (definition.requiredModifiers?.length && modifier !== "none") {
    if (!definition.requiredModifiers.includes(modifier)) {
      rejected.push(evidence("modifier_conflict", "modifier", "hard", modifier, definition.requiredModifiers));
    } else {
      accepted.push(evidence("modifier_compatible", "modifier", "strong", modifier));
    }
  }

  const neighbourLabels = input.neighbourLabels?.map(snakeCaseToken) ?? [];
  if (neighbourLabels.includes(definition.analyteKey)) {
    accepted.push(evidence("neighbour_support", "neighbour", "weak", definition.analyteKey));
  }
  if (input.section?.trim()) {
    accepted.push(evidence("section_support", "section", "weak", input.section.trim()));
  }
  if (input.referenceLow != null || input.referenceHigh != null) {
    accepted.push(evidence("reference_shape_support", "reference", "weak"));
  }

  const score = rejected.length ? null : accepted.reduce((total, item) => total + (item.strength === "strong" ? 2 : 1), 0);
  return { candidateKey: definition.key, accepted, rejected, score };
}

function confidenceFor(
  result: MeasurementResolution["result"],
  selected: CandidateEvidence | undefined
): { band: MappingConfidenceBand; value: number } {
  if (result !== "resolved" || !selected) return { band: "low", value: 0 };
  const strongEvidence = selected.accepted.filter((item) => item.strength === "strong").length;
  if (strongEvidence >= 2) return { band: "high", value: 0.95 };
  return { band: "medium", value: 0.7 };
}

export function getMeasurementDefinition(key: string): MeasurementDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

export function getAnalyte(key: string): Analyte | undefined {
  return ANALYTE_BY_KEY.get(key);
}

export function getMeasurementIdentity(definition: MeasurementDefinition) {
  return [definition.analyteKey, definition.specimen, definition.property, definition.scale, definition.timing, definition.method] as const;
}

export function getMeasurementDefinitionsForAnalyte(analyteKey: string): readonly MeasurementDefinition[] {
  return MEASUREMENT_DEFINITIONS.filter((definition) => definition.analyteKey === analyteKey);
}

/**
 * Reuses existing biomarker conversion rules. Measurement definitions only
 * reference a policy; they never duplicate numerical conversion constants.
 */
export function getMeasurementConversionPolicy(key: string) {
  const definition = getMeasurementDefinition(key);
  if (!definition?.unitPolicy.conversionPolicyRef?.startsWith("biomarker:")) return null;
  const biomarkerKey = definition.unitPolicy.conversionPolicyRef.slice("biomarker:".length);
  return getBiomarkerDefinition(biomarkerKey)?.conversion ?? null;
}

export function resolveMeasurementDefinition(input: MeasurementResolutionInput): MeasurementResolution {
  const label = snakeCaseToken(input.rawLabel);
  const proposed = input.proposedKey ? snakeCaseToken(input.proposedKey) : "";
  const specimen = input.specimen?.trim().toLowerCase() || "unspecified";
  const modifier = normalizedModifier(input);
  const unit = normalizeMeasurementUnit(input.rawUnit);
  const labelDefinitions = CURATED_MEASUREMENT_DEFINITIONS.filter((definition) => matchesDefinition(definition, label));
  const proposedDefinitions = labelDefinitions.length || !proposed
    ? []
    : CURATED_MEASUREMENT_DEFINITIONS.filter((definition) => matchesDefinition(definition, proposed));
  const considered = labelDefinitions.length ? labelDefinitions : proposedDefinitions;
  const source = labelDefinitions.length ? "label" as const : "proposed" as const;
  const candidateEvidence: CandidateEvidence[] = considered.map((definition) =>
    buildCandidateEvidence(definition, input, label, proposed, unit, specimen, modifier, source)
  );
  const compatible = candidateEvidence.filter((candidate) => candidate.rejected.length === 0);
  const exactCandidate = compatible.filter((candidate) => candidate.candidateKey === label);
  const narrowed = exactCandidate.length === 1 ? exactCandidate : compatible;
  const selected = narrowed.length === 1 ? narrowed[0] : undefined;
  const result: MeasurementResolution["result"] = selected
    ? "resolved"
    : narrowed.length === 0
      ? "unmapped"
      : "ambiguous";
  const definition = selected ? getMeasurementDefinition(selected.candidateKey) : undefined;
  const confidence = confidenceFor(result, selected);
  const reasons = candidateEvidence.flatMap((candidate) => [
    ...candidate.accepted.map((item) => item.code),
    ...candidate.rejected.map((item) => item.code),
  ]);

  return {
    result,
    measurementDefinitionKey: definition?.key ?? null,
    canonicalKey: definition?.canonicalKey ?? null,
    mappingConfidence: confidence.value,
    mappingConfidenceBand: confidence.band,
    unit,
    unitToken: unit.dimension ?? "unknown",
    candidateKeys: narrowed.map((candidate) => candidate.candidateKey),
    candidateEvidence,
    reasons: [...new Set(reasons)],
  };
}

export type MeasurementRegistryValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateMeasurementRegistry(
  definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS
): MeasurementRegistryValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const keys = new Set<string>();
  const aliasesByValue = new Map<string, MeasurementDefinition[]>();
  const curatedIdentities = new Map<string, string>();
  const coveredLegacy = new Set<string>();
  const adapterFallbacks = new Map<string, number>();

  for (const definition of definitions) {
    if (keys.has(definition.key)) errors.push(`Duplicate measurement definition key: ${definition.key}`);
    keys.add(definition.key);
    if (!definition.analyteKey) errors.push(`Missing analyte key: ${definition.key}`);
    if (!ANALYTE_BY_KEY.has(definition.analyteKey)) errors.push(`Unknown analyte key: ${definition.key} -> ${definition.analyteKey}`);
    if (!definition.definitionSource || !definition.specimen || !definition.property || !definition.scale || !definition.timing || !definition.method) errors.push(`Incomplete measurement identity: ${definition.key}`);
    if (definition.canonicalKey && !getBiomarkerDefinition(definition.canonicalKey)) {
      errors.push(`Unknown canonical biomarker key: ${definition.key} -> ${definition.canonicalKey}`);
    }
    if (!definition.unitPolicy) errors.push(`Missing unit policy: ${definition.key}`);
    if (definition.unitPolicy.dimensions.length && !definition.unitPolicy.acceptedUnits.length) {
      errors.push(`Unit policy has dimensions but no accepted units: ${definition.key}`);
    }
    if (definition.canonicalKey) coveredLegacy.add(definition.canonicalKey);
    if (definition.definitionSource === "legacy_adapter") {
      if (!definition.canonicalKey) errors.push(`Adapter definition lacks legacy key: ${definition.key}`);
      else adapterFallbacks.set(definition.canonicalKey, (adapterFallbacks.get(definition.canonicalKey) ?? 0) + 1);
    } else {
      const identity = getMeasurementIdentity(definition).join("|");
      const previous = curatedIdentities.get(identity);
      if (previous) errors.push(`Duplicate curated measurement identity: ${previous} and ${definition.key}`);
      curatedIdentities.set(identity, definition.key);
    }
    for (const alias of definition.definitionSource === "curated" ? definition.aliases : []) {
      if (!alias.normalizedValue || !alias.source || !alias.matchType) {
        errors.push(`Incomplete alias metadata: ${definition.key}`);
      }
      const bucket = aliasesByValue.get(alias.normalizedValue) ?? [];
      bucket.push(definition);
      aliasesByValue.set(alias.normalizedValue, bucket);
    }
  }

  for (const legacy of BIOMARKER_DEFINITIONS) {
    if (!coveredLegacy.has(legacy.key)) errors.push(`Uncovered legacy biomarker key: ${legacy.key}`);
    if ((adapterFallbacks.get(legacy.key) ?? 0) > 1) errors.push(`Multiple adapter fallbacks for legacy key: ${legacy.key}`);
  }

  for (const [alias, definitionsForAlias] of aliasesByValue) {
    const analytes = new Set(definitionsForAlias.map((definition) => definition.analyteKey));
    if (analytes.size > 1) {
      errors.push(`Alias collision across analytes: ${alias}`);
    } else if (definitionsForAlias.length > 1) {
      warnings.push(`Context-dependent alias: ${alias}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
