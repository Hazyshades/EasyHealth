import { snakeCaseToken } from "./normalize";
import { LAUNCH_CATALOG_MIGRATION_RECORDS } from "./launch-catalog.generated";
import type {
  Analyte,
  CandidateEvidence,
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

export const MEASUREMENT_CATALOG_MANIFEST_VERSION = "2026-07-14.1";
export const MEASUREMENT_RESOLVER_VERSION = "4";
export const MEASUREMENT_NORMALIZATION_VERSION = "3";
/** Observation provenance schema version, assigned by the persistence layer (not copied from extraction). */
export const OBSERVATION_PROVENANCE_SCHEMA_VERSION = "1";

const PERCENT_POLICY: MeasurementUnitPolicy = {
  dimensions: ["ratio"], acceptedUnits: ["%"], canonicalUnit: "%", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const CELL_POLICY: MeasurementUnitPolicy = {
  dimensions: ["cell_concentration"], acceptedUnits: ["10^9/l", "10^3/ul"], canonicalUnit: "10^9/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const VOLUME_POLICY: MeasurementUnitPolicy = {
  dimensions: ["volume"], acceptedUnits: ["fl"], canonicalUnit: "fl", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const GLUCOSE_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"], acceptedUnits: ["mg/dl", "mmol/l"], canonicalUnit: "mmol/l", conversionPolicyRef: "launch:glucose", missingUnitPolicy: "ambiguous",
};
const ENZYME_POLICY: MeasurementUnitPolicy = {
  dimensions: ["catalytic_activity_concentration"], acceptedUnits: ["u/l"], canonicalUnit: "u/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const DISPLAY_POLICY: MeasurementUnitPolicy = {
  dimensions: [], acceptedUnits: [], canonicalUnit: null, conversionPolicyRef: null, missingUnitPolicy: "display_only",
};

function aliases(values: readonly string[], source: MeasurementAlias["source"], approvalStatus: "reviewed" | "provisional", fixtureRefs?: readonly string[]): MeasurementAlias[] {
  return [...new Set(values)].map((value) => ({ value, normalizedValue: snakeCaseToken(value), source, matchType: "normalized", approvalStatus, ...(fixtureRefs ? { fixtureRefs } : {}) }));
}

function reviewed(definition: Omit<MeasurementDefinition, "maturity" | "sourceProvenance" | "assessmentBindings"> & { assessmentInputKey?: string }): MeasurementDefinition {
  const { assessmentInputKey, ...record } = definition;
  return {
    ...record,
    maturity: "reviewed",
    sourceProvenance: { kind: "launch_catalog", sourceRecordKey: record.key },
    assessmentBindings: assessmentInputKey ? [{ assessmentInputKey, compatibility: "compatible", status: "reviewed" }] : [],
  };
}

const REVIEWED_DEFINITIONS: readonly MeasurementDefinition[] = [
  reviewed({ key: "glucose_serum", analyteKey: "glucose", displayName: "Glucose, serum", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "blood_glucose", "serum_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["serum"], assessmentInputKey: "glucose" }),
  reviewed({ key: "glucose_plasma", analyteKey: "glucose", displayName: "Glucose, plasma", specimen: "plasma", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "blood_glucose", "plasma_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["plasma"], assessmentInputKey: "glucose" }),
  reviewed({ key: "glucose_whole_blood", analyteKey: "glucose", displayName: "Glucose, whole blood", specimen: "whole_blood", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["whole_blood_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "fasting_glucose", analyteKey: "glucose", displayName: "Fasting glucose", specimen: "plasma", property: "substance_concentration", scale: "quantitative", timing: "fasting", method: "automated", valueKind: "numeric", aliases: aliases(["fasting_glucose", "fpg"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["plasma"], requiredModifiers: ["fasting"], assessmentInputKey: "glucose" }),
  reviewed({ key: "neutrophils_percent", analyteKey: "neutrophils", displayName: "Neutrophils, percent", specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["neutrophils", "neutrophils_percent", "neu%", "neu_percent"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "neutrophils_abs", analyteKey: "neutrophils", displayName: "Neutrophils, absolute", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["neutrophils", "neutrophils_absolute", "neutrophils_abs", "absolute_neutrophil_count", "neu"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "lymphocytes_percent", analyteKey: "lymphocytes", displayName: "Lymphocytes, percent", specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["lymphocytes", "lymphocytes_percent", "lymf%", "lym_percent"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "lymphocytes_abs", analyteKey: "lymphocytes", displayName: "Lymphocytes, absolute", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["lymphocytes_absolute", "lymphocytes_abs", "absolute_lymphocyte_count", "lymf"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "rdw_cv", analyteKey: "red_cell_distribution_width", displayName: "RDW-CV", specimen: "whole_blood", property: "distribution_width_cv", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["rdw", "rdw_cv", "rdw-cv"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "rdw_sd", analyteKey: "red_cell_distribution_width", displayName: "RDW-SD", specimen: "whole_blood", property: "distribution_width_sd", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["rdw", "rdw_sd", "rdw-sd"], "registry", "reviewed"), unitPolicy: VOLUME_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "reticulocytes_percent", analyteKey: "reticulocytes", displayName: "Reticulocytes, percent", specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["reticulocytes_percent", "retic_percent"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "reticulocytes_abs", analyteKey: "reticulocytes", displayName: "Reticulocytes, absolute", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["reticulocytes_abs", "absolute_reticulocyte_count"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "segmented_neutrophils_percent", analyteKey: "neutrophils", displayName: "Segmented neutrophils, percent", specimen: "whole_blood", property: "segmented_percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["segmented_neutrophils"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "band_neutrophils_percent", analyteKey: "neutrophils", displayName: "Band neutrophils, percent", specimen: "whole_blood", property: "band_percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["band_neutrophils"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  ...(["alt", "ast", "alp", "ggt"] as const).flatMap((analyteKey) => (["serum", "plasma"] as const).map((specimen) => reviewed({ key: `${analyteKey}_${specimen}_catalytic_activity`, analyteKey, displayName: `${analyteKey.toUpperCase()}, ${specimen} catalytic activity`, specimen, property: "catalytic_activity_concentration", scale: "quantitative", timing: "point_in_time", method: "unspecified", valueKind: "numeric", aliases: aliases([analyteKey, ...(analyteKey === "alt" ? ["alanine_aminotransferase"] : analyteKey === "ast" ? ["aspartate_aminotransferase"] : [])], "registry", "reviewed"), unitPolicy: ENZYME_POLICY, allowedSpecimens: [specimen], assessmentInputKey: analyteKey }))),
];

const SAMPLE_FIXTURES: readonly [string, string, "numeric" | "qualitative"][] = [
  ["total_protein", "Total protein", "numeric"], ["total_bilirubin", "Total bilirubin", "numeric"], ["direct_bilirubin", "Direct bilirubin", "numeric"], ["crp", "C-reactive protein, quantitative", "numeric"], ["aso", "Antistreptolysin-O (ASO)", "numeric"],
  ["alt_sample", "ALT (alanine aminotransferase)", "numeric"], ["ast_sample", "AST (aspartate aminotransferase)", "numeric"],
  ["red_blood_cells", "Red blood cells (RBC)", "numeric"], ["hemoglobin", "Hemoglobin (HGB)", "numeric"], ["hematocrit", "Hematocrit (HCT)", "numeric"], ["mcv", "Mean corpuscular volume (MCV)", "numeric"], ["mch", "Mean corpuscular hemoglobin (MCH)", "numeric"], ["mchc", "Mean corpuscular hemoglobin concentration (MCHC)", "numeric"], ["rdw_sample", "Red cell distribution width (RDW)", "numeric"], ["platelets", "Platelets (PLT)", "numeric"], ["mpv", "Mean platelet volume (MPV)", "numeric"], ["pdw", "Platelet distribution width (PDW)", "numeric"], ["plateletcrit", "Plateletcrit (PCT)", "numeric"], ["white_blood_cells", "White blood cells (WBC)", "numeric"], ["neutrophils_percent_sample", "Neutrophils (NEU%)", "numeric"], ["neutrophils_abs_sample", "Neutrophils, absolute (NEU)", "numeric"], ["lymphocytes_percent_sample", "Lymphocytes (LYMF%)", "numeric"], ["lymphocytes_abs_sample", "Lymphocytes, absolute (LYMF)", "numeric"],
  ["monocytes_percent", "Monocytes (MON%)", "numeric"], ["monocytes_abs", "Monocytes, absolute (MON)", "numeric"], ["eosinophils_percent", "Eosinophils (EOS%)", "numeric"], ["eosinophils_abs", "Eosinophils, absolute (EOS)", "numeric"], ["basophils_percent", "Basophils (BAS%)", "numeric"], ["basophils_abs", "Basophils, absolute (BAS)", "numeric"], ["esr", "ESR, Westergren automated", "numeric"], ["segmented_neutrophils", "Segmented neutrophils", "numeric"], ["band_neutrophils", "Band neutrophils", "numeric"], ["lymphocytes_manual", "Lymphocytes, manual differential", "numeric"], ["monocytes_manual", "Monocytes, manual differential", "numeric"], ["eosinophils_manual", "Eosinophils, manual differential", "numeric"],
  ["giardia_antibodies_total", "Giardia antibodies, total", "numeric"], ["ascaris_igg", "Ascaris IgG antibodies", "qualitative"], ["toxocara_igg", "anti-Toxocara IgG, qualitative ELISA", "qualitative"], ["opisthorchis_felineus_igg", "anti-Opisthorchis felineus IgG, qualitative ELISA", "qualitative"], ["echinococcus_igg", "anti-Echinococcus IgG, qualitative ELISA", "qualitative"], ["trichinella_igg", "anti-Trichinella sp. IgG, qualitative ELISA", "qualitative"], ["total_ige", "Total IgE", "numeric"], ["eosinophilic_cationic_protein", "Eosinophilic cationic protein (ECP)", "numeric"],
];

const MIGRATED_DEFINITIONS: readonly MeasurementDefinition[] = LAUNCH_CATALOG_MIGRATION_RECORDS.map((record) => ({
  key: record.key, analyteKey: record.analyteKey, displayName: record.displayName, maturity: "provisional", sourceProvenance: { kind: "registry_v1_migration", sourceRecordKey: record.sourceRecordKey }, specimen: record.specimen, property: "unspecified", scale: "unspecified", timing: "unspecified", method: "unspecified", valueKind: "unspecified", aliases: aliases(record.aliases, "registry", "provisional"), unitPolicy: DISPLAY_POLICY, assessmentBindings: record.scoreRole === "core" ? [{ assessmentInputKey: record.sourceRecordKey, compatibility: "compatible", status: "provisional" }] : [],
}));

const SAMPLE_FIXTURE_DEFINITIONS: readonly MeasurementDefinition[] = SAMPLE_FIXTURES.map(([key, label, valueKind]) => ({
  key: `sample_${key}`, analyteKey: key, displayName: label, maturity: "provisional", sourceProvenance: { kind: "sample_fixture", sourceRecordKey: "sample_newest.pdf" }, specimen: "unspecified", property: "unspecified", scale: valueKind === "qualitative" ? "nominal" : "quantitative", timing: "unspecified", method: "unspecified", valueKind, aliases: aliases([label, key], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: DISPLAY_POLICY, assessmentBindings: [],
}));

export const CURATED_MEASUREMENT_DEFINITIONS = REVIEWED_DEFINITIONS;
export const MEASUREMENT_DEFINITIONS: readonly MeasurementDefinition[] = [...REVIEWED_DEFINITIONS, ...MIGRATED_DEFINITIONS, ...SAMPLE_FIXTURE_DEFINITIONS];

export const ANALYTES: readonly Analyte[] = [...new Map(MEASUREMENT_DEFINITIONS.map((definition) => [definition.analyteKey, { key: definition.analyteKey, displayName: definition.displayName, aliases: definition.aliases.map((alias) => alias.value), status: "active" as const }])).values()];
const DEFINITION_BY_KEY = new Map(MEASUREMENT_DEFINITIONS.map((definition) => [definition.key, definition]));
const ANALYTE_BY_KEY = new Map(ANALYTES.map((analyte) => [analyte.key, analyte]));

function normalizeRawUnit(rawUnit: string): string {
  return rawUnit.trim().toLowerCase().replace(/[\u00b5\u03bc]/g, "u").replace(/\u00d7/g, "x").replace(/\s+/g, "").replace(/x?10\^?9\/l/g, "10^9/l").replace(/x?10\^?12\/l/g, "10^12/l").replace(/x?10\^?3\/(ul|u?l)/g, "10^3/ul");
}

export function normalizeMeasurementUnit(rawUnit: string | null | undefined): NormalizedMeasurementUnit {
  const raw = rawUnit?.trim() ?? "";
  const unit = normalizeRawUnit(raw);
  if (!unit) return { raw, normalizedUnit: null, dimension: null };
  if (unit === "%" || unit === "percent") return { raw, normalizedUnit: "%", dimension: "ratio" };
  if (["fl", "femtoliter", "femtolitre"].includes(unit)) return { raw, normalizedUnit: "fl", dimension: "volume" };
  if (["10^9/l", "10^3/ul", "10^12/l"].includes(unit)) return { raw, normalizedUnit: unit, dimension: "cell_concentration" };
  if (["u/l", "iu/l"].includes(unit)) return { raw, normalizedUnit: "u/l", dimension: "catalytic_activity_concentration" };
  if (["mmol/l", "umol/l", "nmol/l", "pmol/l"].includes(unit)) return { raw, normalizedUnit: unit, dimension: "molar_concentration" };
  if (["mg/dl", "g/dl", "g/l", "ng/ml", "pg/ml", "ug/dl"].includes(unit)) return { raw, normalizedUnit: unit, dimension: "mass_concentration" };
  if (["iu/ml", "mm/hour", "titer", "positivitycoefficient"].includes(unit)) return { raw, normalizedUnit: unit, dimension: "arbitrary" };
  return { raw, normalizedUnit: unit, dimension: null };
}

export function normalizeUnitToken(unit: string | null | undefined): UnitToken { return normalizeMeasurementUnit(unit).dimension ?? "unknown"; }
export function getMeasurementDefinition(key: string): MeasurementDefinition | undefined { return DEFINITION_BY_KEY.get(key); }
export function getAnalyte(key: string): Analyte | undefined { return ANALYTE_BY_KEY.get(key); }
export function getMeasurementIdentity(definition: MeasurementDefinition) { return [definition.analyteKey, definition.specimen, definition.property, definition.scale, definition.timing, definition.method, definition.valueKind] as const; }
export function getMeasurementDefinitionsForAnalyte(analyteKey: string): readonly MeasurementDefinition[] { return MEASUREMENT_DEFINITIONS.filter((definition) => definition.analyteKey === analyteKey); }
export function getMeasurementConversionPolicy(key: string) { const sourceKey = getMeasurementDefinition(key)?.sourceProvenance.sourceRecordKey; return LAUNCH_CATALOG_MIGRATION_RECORDS.find((record) => record.sourceRecordKey === sourceKey)?.conversion ?? null; }

function evidence(code: ResolutionReasonCode, source: ResolutionEvidence["source"], strength: ResolutionEvidence["strength"], observed?: string, expected?: readonly string[]): ResolutionEvidence { return { code, source, strength, ...(observed ? { observed } : {}), ...(expected ? { expected } : {}) }; }
function matches(definition: MeasurementDefinition, label: string) { return definition.key === label || definition.aliases.some((alias) => alias.normalizedValue === label); }
function normalizedSpecimen(value: string | null | undefined) { const normalized = snakeCaseToken(value ?? ""); return ["serum", "plasma", "whole_blood", "urine"].includes(normalized) ? normalized : "unspecified"; }
function candidateEvidence(definition: MeasurementDefinition, input: MeasurementResolutionInput, label: string, unit: NormalizedMeasurementUnit): CandidateEvidence {
  const accepted: ResolutionEvidence[] = [evidence(definition.key === label ? "definition_key_match" : "alias_normalized_match", "label", "strong", definition.displayName)];
  const rejected: ResolutionEvidence[] = [];
  const missingAxes: Array<"specimen" | "modifier" | "timing" | "method" | "value_kind"> = [];
  if (unit.normalizedUnit && definition.unitPolicy.dimensions.length) {
    if (!unit.dimension || !definition.unitPolicy.dimensions.includes(unit.dimension)) rejected.push(evidence("unit_dimension_conflict", "unit", "hard", unit.normalizedUnit, definition.unitPolicy.dimensions));
    else if (!definition.unitPolicy.acceptedUnits.includes(unit.normalizedUnit)) rejected.push(evidence("unit_not_accepted", "unit", "hard", unit.normalizedUnit, definition.unitPolicy.acceptedUnits));
    else accepted.push(evidence("unit_compatible", "unit", "strong", unit.normalizedUnit));
  } else if (!unit.normalizedUnit) accepted.push(evidence("unit_missing", "unit", "weak"));
  const specimen = normalizedSpecimen(input.specimen);
  if (definition.specimen !== "unspecified") {
    if (specimen === "unspecified") { missingAxes.push("specimen"); accepted.push(evidence("specimen_missing", "specimen", "weak")); }
    else if (specimen !== definition.specimen) rejected.push(evidence("specimen_conflict", "specimen", "hard", specimen, [definition.specimen]));
    else accepted.push(evidence("specimen_compatible", "specimen", "strong", specimen));
  }
  if (definition.requiredModifiers?.length) {
    const modifier = snakeCaseToken(input.modifier ?? "");
    if (!modifier) { missingAxes.push("modifier"); accepted.push(evidence("modifier_missing", "modifier", "weak")); }
    else if (!definition.requiredModifiers.includes(modifier)) rejected.push(evidence("modifier_conflict", "modifier", "hard", modifier, definition.requiredModifiers));
    else accepted.push(evidence("modifier_compatible", "modifier", "strong", modifier));
  }
  if (definition.valueKind !== "unspecified" && input.valueKind && input.valueKind !== definition.valueKind) missingAxes.push("value_kind");
  const score = rejected.length ? null : accepted.reduce((sum, item) => sum + (item.strength === "strong" ? 2 : 1), 0);
  return { candidateKey: definition.key, accepted, rejected, missingAxes, score };
}

export function resolveMeasurementDefinition(input: MeasurementResolutionInput): MeasurementResolution {
  const label = snakeCaseToken(input.rawLabel);
  const proposed = snakeCaseToken(input.proposedKey ?? "");
  const matched = MEASUREMENT_DEFINITIONS.filter((definition) => matches(definition, label) || (!label && proposed && matches(definition, proposed)));
  const unit = normalizeMeasurementUnit(input.rawUnit);
  const evidenceByCandidate = matched.map((definition) => candidateEvidence(definition, input, label || proposed, unit));
  const compatible = evidenceByCandidate.filter((candidate) => candidate.rejected.length === 0);
  const concrete = compatible.filter((candidate) => { const definition = getMeasurementDefinition(candidate.candidateKey)!; return definition.maturity === "reviewed" && candidate.missingAxes.length === 0; });
  const result = concrete.length === 1 ? "resolved" : concrete.length > 1 ? "ambiguous" : matched.length ? "partial" : "unmapped";
  const selected = concrete.length === 1 ? getMeasurementDefinition(concrete[0].candidateKey) : undefined;
  const analytes = new Set((compatible.length ? compatible : evidenceByCandidate).map((candidate) => getMeasurementDefinition(candidate.candidateKey)?.analyteKey).filter((key): key is string => Boolean(key)));
  const reasons = [...new Set(evidenceByCandidate.flatMap((candidate) => [...candidate.accepted, ...candidate.rejected].map((item) => item.code)))];
  const missingAxes = [...new Set(evidenceByCandidate.flatMap((candidate) => candidate.missingAxes))];
  const conflicts = [...new Set(evidenceByCandidate.flatMap((candidate) => candidate.rejected.map((item) => item.code)))];
  const confidence: { value: number; band: MappingConfidenceBand } = result === "resolved" ? { value: 0.95, band: "high" } : result === "partial" ? { value: 0.7, band: "medium" } : { value: 0, band: "low" };
  return { result, measurementDefinitionKey: selected?.key ?? null, analyteKey: analytes.size === 1 ? [...analytes][0] : selected?.analyteKey ?? null, mappingConfidence: confidence.value, mappingConfidenceBand: confidence.band, unit, unitToken: unit.dimension ?? "unknown", candidateKeys: (compatible.length ? compatible : evidenceByCandidate).map((candidate) => candidate.candidateKey), missingAxes, conflicts, candidateEvidence: evidenceByCandidate, reasons };
}

export type MeasurementRegistryValidation = { valid: boolean; errors: string[]; warnings: string[] };
export function validateMeasurementRegistry(definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS): MeasurementRegistryValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const keys = new Set<string>();
  const migrated = new Set<string>();
  const reviewedIdentities = new Map<string, string>();
  for (const definition of definitions) {
    if (keys.has(definition.key)) errors.push(`Duplicate measurement definition key: ${definition.key}`);
    keys.add(definition.key);
    if (!definition.analyteKey || !definition.maturity || !definition.sourceProvenance || !definition.valueKind) errors.push(`Incomplete measurement definition: ${definition.key}`);
    if (definition.sourceProvenance.kind === "registry_v1_migration") migrated.add(definition.sourceProvenance.sourceRecordKey);
    if (definition.maturity === "reviewed") { const identity = getMeasurementIdentity(definition).join("|"); const existing = reviewedIdentities.get(identity); if (existing) errors.push(`Duplicate reviewed measurement identity: ${existing} and ${definition.key}`); reviewedIdentities.set(identity, definition.key); }
    if (definition.unitPolicy.dimensions.length && !definition.unitPolicy.acceptedUnits.length) errors.push(`Unit policy has dimensions but no units: ${definition.key}`);
  }
  for (const record of LAUNCH_CATALOG_MIGRATION_RECORDS) if (!migrated.has(record.sourceRecordKey)) errors.push(`Undispositioned Registry v1 concept: ${record.sourceRecordKey}`);
  if (definitions.filter((definition) => definition.maturity === "provisional").length < LAUNCH_CATALOG_MIGRATION_RECORDS.length) warnings.push("Launch migration has fewer provisional records than its source inventory");
  return { valid: errors.length === 0, errors, warnings };
}
