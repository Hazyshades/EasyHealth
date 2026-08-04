import { snakeCaseToken } from "./normalize";
import { z } from "zod";
import type {
  AliasDefinition,
  AliasSource,
  Analyte,
  AssessmentBinding,
  BodySystemId,
  CandidateEvidence,
  ClinicalCompatibilityAxis,
  CompatibilityEvidenceResult,
  ConversionRule,
  MappingConfidenceBand,
  MatchedAlias,
  MeasurementDefinition,
  MeasurementResolution,
  MeasurementResolutionInput,
  MeasurementUnitPolicy,
  MeasurementValueKind,
  NormalizedMeasurementUnit,
  ResolutionEvidence,
  ResolutionReasonCode,
  ResolverDecisionKind,
  PersistedResolverDecisionTrace,
  PersistedResolverDecisionTraceCandidate,
  ResolverTraceSchemaVersion,
  ScoreContributionGroup,
  ScoreRequiredGroup,
  ScoreRole,
  SpecimenKey,
  UnitDimension,
  UnitToken,
} from "./types";

export const MEASUREMENT_CATALOG_MANIFEST_VERSION = "2026-08-03.0";
export const MEASUREMENT_RESOLVER_VERSION = "8";
export const MEASUREMENT_NORMALIZATION_VERSION = "5";
export const MEASUREMENT_COMPATIBILITY_POLICY_VERSION = "1";
/** Observation provenance schema version, assigned by the persistence layer (not copied from extraction). */
export const OBSERVATION_PROVENANCE_SCHEMA_VERSION = "1";

export const RESOLVER_DECISION_TRACE_SCHEMA_VERSION: ResolverTraceSchemaVersion = "1";

const PERCENT_POLICY: MeasurementUnitPolicy = {
  dimensions: ["ratio"], acceptedUnits: ["%"], canonicalUnit: "%", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const CELL_POLICY: MeasurementUnitPolicy = {
  dimensions: ["cell_concentration"], acceptedUnits: ["10^9/l", "10^3/ul"], canonicalUnit: "10^9/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const RBC_POLICY: MeasurementUnitPolicy = {
  dimensions: ["cell_concentration"], acceptedUnits: ["10^12/l"], canonicalUnit: "10^12/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const VOLUME_POLICY: MeasurementUnitPolicy = {
  dimensions: ["volume"], acceptedUnits: ["fl"], canonicalUnit: "fl", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const GLUCOSE_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"], acceptedUnits: ["mg/dl", "mmol/l"], canonicalUnit: "mmol/l", conversionPolicyRef: "registry-2.0:glucose", missingUnitPolicy: "ambiguous",
};
const LIPID_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"], acceptedUnits: ["mg/dl", "mmol/l"], canonicalUnit: "mmol/l", conversionPolicyRef: "registry-2.0:lipids", missingUnitPolicy: "ambiguous",
};
const ENZYME_POLICY: MeasurementUnitPolicy = {
  dimensions: ["catalytic_activity_concentration"], acceptedUnits: ["u/l"], canonicalUnit: "u/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const HBA1C_POLICY: MeasurementUnitPolicy = {
  dimensions: ["ratio"], acceptedUnits: ["%", "mmol/mol"], canonicalUnit: "%", conversionPolicyRef: "registry-2.0:hba1c", missingUnitPolicy: "ambiguous",
};
const TSH_POLICY: MeasurementUnitPolicy = {
  dimensions: ["arbitrary"], acceptedUnits: ["miu/l", "uiu/ml"], canonicalUnit: "miu/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const FREE_T4_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"], acceptedUnits: ["ng/dl", "pmol/l"], canonicalUnit: "pmol/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const PROTEIN_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration"], acceptedUnits: ["g/dl", "g/l"], canonicalUnit: "g/l", conversionPolicyRef: "registry-2.0:protein", missingUnitPolicy: "ambiguous",
};
const BILIRUBIN_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"], acceptedUnits: ["mg/dl", "umol/l"], canonicalUnit: "umol/l", conversionPolicyRef: "registry-2.0:bilirubin", missingUnitPolicy: "ambiguous",
};
const CREATININE_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"], acceptedUnits: ["mg/dl", "umol/l"], canonicalUnit: "umol/l", conversionPolicyRef: "registry-2.0:creatinine", missingUnitPolicy: "ambiguous",
};
const VITAMIN_D_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"], acceptedUnits: ["ng/ml", "nmol/l"], canonicalUnit: "nmol/l", conversionPolicyRef: "registry-2.0:vitamin-d", missingUnitPolicy: "ambiguous",
};
const B12_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration", "molar_concentration"], acceptedUnits: ["pg/ml", "pmol/l"], canonicalUnit: "pmol/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const ELECTROLYTE_POLICY: MeasurementUnitPolicy = {
  dimensions: ["molar_concentration"], acceptedUnits: ["mmol/l"], canonicalUnit: "mmol/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const UACR_POLICY: MeasurementUnitPolicy = {
  dimensions: ["arbitrary"], acceptedUnits: ["mg/g", "mg/mmol"], canonicalUnit: "mg/g", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const EGFR_POLICY: MeasurementUnitPolicy = {
  dimensions: ["arbitrary"], acceptedUnits: ["ml/min/1.73m2"], canonicalUnit: "ml/min/1.73m2", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const DISPLAY_POLICY: MeasurementUnitPolicy = {
  dimensions: [], acceptedUnits: [], canonicalUnit: null, conversionPolicyRef: null, missingUnitPolicy: "display_only",
};
const TOTAL_IGE_POLICY: MeasurementUnitPolicy = {
  dimensions: ["arbitrary"], acceptedUnits: ["iu/ml"], canonicalUnit: "iu/ml", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const ASO_POLICY: MeasurementUnitPolicy = {
  dimensions: ["arbitrary"], acceptedUnits: ["iu/ml"], canonicalUnit: "iu/ml", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const ESR_POLICY: MeasurementUnitPolicy = {
  dimensions: ["arbitrary"], acceptedUnits: ["mm/hour"], canonicalUnit: "mm/hour", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const TITER_POLICY: MeasurementUnitPolicy = {
  dimensions: ["arbitrary"], acceptedUnits: ["titer"], canonicalUnit: "titer", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const POSITIVITY_COEFFICIENT_POLICY: MeasurementUnitPolicy = {
  dimensions: ["arbitrary"], acceptedUnits: ["positivitycoefficient"], canonicalUnit: "positivitycoefficient", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};
const ECP_POLICY: MeasurementUnitPolicy = {
  dimensions: ["mass_concentration"], acceptedUnits: ["ng/ml"], canonicalUnit: "ng/ml", conversionPolicyRef: null, missingUnitPolicy: "ambiguous",
};

const CHOLESTEROL_CONVERSION: ConversionRule = { type: "linear", conventionalUnit: "mg/dL", siUnit: "mmol/L", factorCo: 0.0259, factorSi: 38.61 };
const TRIGLYCERIDE_CONVERSION: ConversionRule = { type: "linear", conventionalUnit: "mg/dL", siUnit: "mmol/L", factorCo: 0.0113, factorSi: 88.5 };
const GLUCOSE_CONVERSION: ConversionRule = { type: "linear", conventionalUnit: "mg/dL", siUnit: "mmol/L", factorCo: 0.0555, factorSi: 18.02 };
const CREATININE_CONVERSION: ConversionRule = { type: "linear", conventionalUnit: "mg/dL", siUnit: "µmol/L", factorCo: 88.4, factorSi: 0.0113 };
const BILIRUBIN_CONVERSION: ConversionRule = { type: "linear", conventionalUnit: "mg/dL", siUnit: "µmol/L", factorCo: 17.1, factorSi: 0.0585 };
const PROTEIN_CONVERSION: ConversionRule = { type: "linear", conventionalUnit: "g/dL", siUnit: "g/L", factorCo: 10, factorSi: 0.1 };
const VITAMIN_D_CONVERSION: ConversionRule = { type: "linear", conventionalUnit: "ng/mL", siUnit: "nmol/L", factorCo: 2.5, factorSi: 0.4 };
const HBA1C_CONVERSION: ConversionRule = { type: "formula", formula: "hba1c_ngsp_ifcc", conventionalUnit: "%", siUnit: "mmol/mol" };
const BUN_UREA_CONVERSION: ConversionRule = { type: "formula", formula: "bun_urea", conventionalUnit: "mg/dL", siUnit: "mmol/L" };
const ENZYME_DISPLAY_ONLY: ConversionRule = { type: "none", reason: "Catalytic activity has no reviewed US/SI mass conversion." };
type AliasSeed = {
  value: string;
  normalizedValue: string;
  source: AliasSource;
  approvalStatus: "reviewed" | "provisional";
  matchType?: AliasDefinition["matchType"];
  locale?: string;
  laboratory?: string;
  fixtureRefs?: readonly string[];
};

function aliases(
  values: readonly string[],
  source: AliasSource,
  approvalStatus: "reviewed" | "provisional",
  fixtureRefs?: readonly string[],
  metadata: Pick<AliasSeed, "matchType" | "locale" | "laboratory"> = {}
): AliasSeed[] {
  return [...new Set(values)].map((value) => ({
    value,
    normalizedValue: snakeCaseToken(value),
    source,
    approvalStatus,
    ...metadata,
    ...(fixtureRefs ? { fixtureRefs } : {}),
  }));
}

function cbcAliases(
  reviewedValues: readonly string[],
  options: { fixtureValues?: readonly string[]; russianValues?: readonly string[]; ocrValues?: readonly string[] } = {}
): AliasSeed[] {
  return [
    ...aliases(reviewedValues, "registry", "reviewed"),
    ...aliases(options.fixtureValues ?? [], "fixture", "reviewed", ["eh-113-cbc"], { matchType: "exact" }),
    ...aliases(options.russianValues ?? [], "laboratory", "reviewed", ["eh-113-cbc-ru"], { matchType: "normalized", locale: "ru", laboratory: "northern-diagnostics" }),
    ...aliases(options.ocrValues ?? [], "fixture", "provisional", ["eh-113-cbc-ocr"], { matchType: "ocr_variant" }),
  ];
}

type RuntimeBinding = {
  assessmentInputKey: string;
  system: BodySystemId;
  scoreRole: ScoreRole;
  coversConfidence?: boolean;
  readinessGroup?: string;
  contributionGroup?: string;
};

type ReviewedDefinitionInput = Omit<
  MeasurementDefinition,
  "maturity" | "sourceProvenance" | "assessmentBindings" | "aliases"
> & { aliases: readonly AliasSeed[]; binding?: RuntimeBinding };

function reviewed({ binding, ...record }: ReviewedDefinitionInput): MeasurementDefinition {
  const assessmentBindings: AssessmentBinding[] = binding
    ? [{
        assessmentInputKey: binding.assessmentInputKey,
        compatibility: "compatible",
        status: "reviewed",
        system: binding.system,
        scoreRole: binding.scoreRole,
        coversConfidence: binding.coversConfidence ?? false,
        ...(binding.readinessGroup ? { readinessGroup: binding.readinessGroup } : {}),
        ...(binding.contributionGroup ? { contributionGroup: binding.contributionGroup } : {}),
      }]
    : [];

  const sourceProvenance = { kind: "registry_v2_review" as const, sourceRecordKey: `registry-2.0:${record.key}` };
  return {
    ...record,
    aliases: record.aliases.map((alias, index): AliasDefinition => ({
      ...alias,
      key: `${record.key}:${alias.source}:${index + 1}`,
      measurementDefinitionKey: record.key,
      matchType: alias.matchType ?? "normalized",
      matchAuthority: "reviewed_resolution",
      lifecycle: "active",
      provenance: sourceProvenance,
      reviewReference: "registry-2.0-launch-review",
    })),
    maturity: "reviewed",
    sourceProvenance,
    conversion: record.conversion ?? null,
    assessmentBindings,
  };
}

function provisional(record: Omit<MeasurementDefinition, "maturity" | "sourceProvenance" | "assessmentBindings" | "aliases"> & { aliases: readonly AliasSeed[] }): MeasurementDefinition {
  const sourceProvenance = { kind: "sample_fixture" as const, sourceRecordKey: "sample_newest.pdf" };
  return {
    ...record,
    aliases: record.aliases.map((alias, index): AliasDefinition => ({
      ...alias,
      key: `${record.key}:fixture:${index + 1}`,
      measurementDefinitionKey: record.key,
      matchType: "exact",
      matchAuthority: "recognition_only",
      lifecycle: "active",
      provenance: sourceProvenance,
    })),
    maturity: "provisional",
    sourceProvenance,
    conversion: record.conversion ?? null,
    assessmentBindings: [],
  };
}

function assessment(
  system: BodySystemId,
  assessmentInputKey: string,
  scoreRole: ScoreRole,
  options: Omit<RuntimeBinding, "system" | "assessmentInputKey" | "scoreRole"> = {}
): RuntimeBinding {
  return { system, assessmentInputKey, scoreRole, ...options };
}

const REVIEWED_DEFINITIONS: readonly MeasurementDefinition[] = [
  // Metabolic
  reviewed({ key: "glucose_serum", analyteKey: "glucose", displayName: "Glucose, serum", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "blood_glucose", "serum_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "glucose", "core", { coversConfidence: true, contributionGroup: "glycemia" }) }),
  reviewed({ key: "glucose_plasma", analyteKey: "glucose", displayName: "Glucose, plasma", specimen: "plasma", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "blood_glucose", "plasma_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "glucose", "core", { coversConfidence: true, contributionGroup: "glycemia" }) }),
  reviewed({ key: "glucose_whole_blood", analyteKey: "glucose", displayName: "Glucose, whole blood", specimen: "whole_blood", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "blood_glucose", "whole_blood_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "glucose", "core", { coversConfidence: true, contributionGroup: "glycemia" }) }),
  reviewed({ key: "fasting_glucose", analyteKey: "glucose", displayName: "Fasting glucose", specimen: "plasma", property: "substance_concentration", scale: "quantitative", timing: "fasting", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "fasting_glucose", "fpg"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, requiredModifiers: ["fasting"], conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "fasting_glucose", "core", { coversConfidence: true, readinessGroup: "glycemia", contributionGroup: "glycemia" }) }),
  reviewed({ key: "post_prandial_glucose_plasma", analyteKey: "glucose", displayName: "Post-prandial glucose, plasma", specimen: "plasma", property: "substance_concentration", scale: "quantitative", timing: "post_prandial", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "post_prandial_glucose", "postprandial_glucose", "ppg"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, requiredModifiers: ["post_prandial"], conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "post_prandial_glucose", "display") }),
  reviewed({ key: "glucose_urine_dipstick", analyteKey: "glucose", displayName: "Glucose, urine (dipstick)", specimen: "urine", property: "presence", scale: "nominal", timing: "point_in_time", method: "dipstick", valueKind: "qualitative", aliases: aliases(["glucose", "urine_glucose", "glucose_urine"], "registry", "reviewed"), unitPolicy: DISPLAY_POLICY }),
  reviewed({ key: "hba1c_whole_blood", analyteKey: "hba1c", displayName: "Hemoglobin A1c", specimen: "whole_blood", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["hba1c", "hb_a1c", "glycated_hemoglobin"], "registry", "reviewed"), unitPolicy: HBA1C_POLICY, conversion: HBA1C_CONVERSION, binding: assessment("metabolic", "hba1c", "core", { coversConfidence: true, readinessGroup: "glycemia", contributionGroup: "glycemia" }) }),

  // Cardiovascular
  reviewed({ key: "ldl_serum", analyteKey: "ldl", displayName: "LDL cholesterol", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["ldl", "ldl_c", "ldl_cholesterol"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, conversion: CHOLESTEROL_CONVERSION, binding: assessment("cardiovascular", "ldl", "core", { coversConfidence: true, readinessGroup: "atherogenic_cholesterol", contributionGroup: "atherogenic_cholesterol" }) }),
  reviewed({ key: "non_hdl_cholesterol_serum", analyteKey: "non_hdl_cholesterol", displayName: "Non-HDL cholesterol", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["non_hdl", "non_hdl_c", "non_hdl_cholesterol"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, conversion: CHOLESTEROL_CONVERSION, binding: assessment("cardiovascular", "non_hdl_cholesterol", "core", { coversConfidence: true, readinessGroup: "atherogenic_cholesterol", contributionGroup: "atherogenic_cholesterol" }) }),
  reviewed({ key: "hdl_serum", analyteKey: "hdl", displayName: "HDL cholesterol", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["hdl", "hdl_c", "hdl_cholesterol"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, conversion: CHOLESTEROL_CONVERSION, binding: assessment("cardiovascular", "hdl", "core", { coversConfidence: true, readinessGroup: "hdl", contributionGroup: "hdl" }) }),
  reviewed({ key: "triglycerides_serum", analyteKey: "triglycerides", displayName: "Triglycerides", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["triglycerides", "tg", "trig"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, conversion: TRIGLYCERIDE_CONVERSION, binding: assessment("cardiovascular", "triglycerides", "core", { coversConfidence: true, readinessGroup: "triglycerides", contributionGroup: "triglycerides" }) }),
  reviewed({ key: "total_cholesterol_serum", analyteKey: "total_cholesterol", displayName: "Total cholesterol", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["total_cholesterol", "cholesterol_total", "tc", "chol"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, conversion: CHOLESTEROL_CONVERSION, binding: assessment("cardiovascular", "total_cholesterol", "extended", { contributionGroup: "total_cholesterol" }) }),

  // Thyroid
  reviewed({ key: "tsh_serum", analyteKey: "tsh", displayName: "Thyroid stimulating hormone", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["tsh", "thyroid_stimulating_hormone"], "registry", "reviewed"), unitPolicy: TSH_POLICY, binding: assessment("thyroid", "tsh", "core", { coversConfidence: true, readinessGroup: "tsh", contributionGroup: "tsh" }) }),
  reviewed({ key: "free_t4_serum", analyteKey: "free_t4", displayName: "Free thyroxine", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["free_t4", "free_thyroxine", "ft4"], "registry", "reviewed"), unitPolicy: FREE_T4_POLICY, binding: assessment("thyroid", "free_t4", "core", { coversConfidence: true, readinessGroup: "free_t4", contributionGroup: "free_t4" }) }),

  // Liver
  ...(["alt", "ast", "alp", "ggt"] as const).flatMap((analyteKey) => (["serum", "plasma"] as const).map((specimen) => reviewed({ key: `${analyteKey}_${specimen}_catalytic_activity`, analyteKey, displayName: `${analyteKey.toUpperCase()}, ${specimen} catalytic activity`, specimen, property: "catalytic_activity_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases([analyteKey, ...(analyteKey === "alt" ? ["alanine_aminotransferase", "ALT (alanine aminotransferase)"] : analyteKey === "ast" ? ["aspartate_aminotransferase", "AST (aspartate aminotransferase)"] : [])], "registry", "reviewed"), unitPolicy: ENZYME_POLICY, conversion: ENZYME_DISPLAY_ONLY, binding: assessment("liver", analyteKey, analyteKey === "ggt" ? "extended" : "core", { coversConfidence: analyteKey !== "ggt", ...(analyteKey !== "ggt" ? { readinessGroup: analyteKey } : {}), contributionGroup: analyteKey }) }))),
  reviewed({ key: "bilirubin_serum", analyteKey: "bilirubin", displayName: "Total bilirubin", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["bilirubin", "total_bilirubin"], "registry", "reviewed"), unitPolicy: BILIRUBIN_POLICY, conversion: BILIRUBIN_CONVERSION, binding: assessment("liver", "bilirubin", "core", { coversConfidence: true, readinessGroup: "bilirubin", contributionGroup: "bilirubin" }) }),
  reviewed({ key: "albumin_serum", analyteKey: "albumin", displayName: "Albumin", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["albumin", "serum_albumin"], "registry", "reviewed"), unitPolicy: PROTEIN_POLICY, conversion: PROTEIN_CONVERSION, binding: assessment("liver", "albumin", "core", { coversConfidence: true, readinessGroup: "albumin", contributionGroup: "albumin" }) }),

  // Kidney
  reviewed({ key: "egfr", analyteKey: "egfr", displayName: "Estimated glomerular filtration rate", specimen: "unspecified", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["egfr", "e_gfr", "estimated_gfr"], "registry", "reviewed"), unitPolicy: EGFR_POLICY, binding: assessment("kidney", "egfr", "core", { coversConfidence: true, readinessGroup: "filtration", contributionGroup: "filtration" }) }),
  reviewed({ key: "creatinine_serum", analyteKey: "creatinine", displayName: "Creatinine", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["creatinine", "serum_creatinine"], "registry", "reviewed"), unitPolicy: CREATININE_POLICY, conversion: CREATININE_CONVERSION, binding: assessment("kidney", "creatinine", "core", { coversConfidence: true, readinessGroup: "filtration", contributionGroup: "filtration" }) }),
  reviewed({ key: "uacr_urine", analyteKey: "uacr", displayName: "Urine albumin to creatinine ratio", specimen: "urine", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["uacr", "urine_albumin_creatinine_ratio"], "registry", "reviewed"), unitPolicy: UACR_POLICY, binding: assessment("kidney", "uacr", "core", { coversConfidence: true, readinessGroup: "albuminuria", contributionGroup: "albuminuria" }) }),
  reviewed({ key: "bun_serum", analyteKey: "bun", displayName: "Blood urea nitrogen", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["bun", "blood_urea_nitrogen"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, conversion: BUN_UREA_CONVERSION, binding: assessment("kidney", "bun", "extended", { contributionGroup: "nitrogen_waste" }) }),
  reviewed({ key: "urea_serum", analyteKey: "urea", displayName: "Urea", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["urea"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, conversion: BUN_UREA_CONVERSION, binding: assessment("kidney", "urea", "extended", { contributionGroup: "nitrogen_waste" }) }),
  ...(["sodium", "potassium", "chloride", "bicarbonate", "calcium"] as const).map((analyteKey) => reviewed({ key: `${analyteKey}_serum`, analyteKey, displayName: analyteKey === "bicarbonate" ? "Bicarbonate" : analyteKey[0]!.toUpperCase() + analyteKey.slice(1), specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases([analyteKey, ...(analyteKey === "sodium" ? ["na"] : analyteKey === "potassium" ? ["k"] : analyteKey === "chloride" ? ["cl"] : analyteKey === "bicarbonate" ? ["co2", "carbon_dioxide"] : analyteKey === "calcium" ? ["ca"] : [])], "registry", "reviewed"), unitPolicy: ELECTROLYTE_POLICY, binding: assessment("kidney", analyteKey, "extended", { contributionGroup: analyteKey === "bicarbonate" ? "acid_base" : analyteKey }) })),

  // Blood and CBC launch catalog
  reviewed({ key: "hemoglobin_whole_blood", analyteKey: "hemoglobin", displayName: "Hemoglobin", specimen: "whole_blood", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases(["hemoglobin", "hgb", "hb"], { fixtureValues: ["Hemoglobin (HGB)"], russianValues: ["Гемоглобин (HGB)"] }), unitPolicy: PROTEIN_POLICY, conversion: PROTEIN_CONVERSION, binding: assessment("blood", "hemoglobin", "core", { coversConfidence: true, readinessGroup: "red_cell_mass", contributionGroup: "red_cell_mass" }) }),
  reviewed({ key: "hematocrit_whole_blood", analyteKey: "hematocrit", displayName: "Hematocrit", specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases(["hematocrit", "hct"], { fixtureValues: ["Hematocrit (HCT)"], russianValues: ["Гематокрит (HCT)"] }), unitPolicy: PERCENT_POLICY, binding: assessment("blood", "hematocrit", "core", { coversConfidence: true, readinessGroup: "red_cell_mass", contributionGroup: "red_cell_mass" }) }),
  reviewed({ key: "rbc_whole_blood", analyteKey: "rbc", displayName: "Red blood cell count", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases(["rbc", "red_blood_cells"], { fixtureValues: ["Red blood cells (RBC)"], russianValues: ["Эритроциты (RBC)"] }), unitPolicy: RBC_POLICY, binding: assessment("blood", "rbc", "extended", { contributionGroup: "red_cell_mass" }) }),
  reviewed({ key: "wbc_whole_blood", analyteKey: "wbc", displayName: "White blood cell count", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases(["wbc", "white_blood_cells"], { fixtureValues: ["White blood cells (WBC)"], russianValues: ["Лейкоциты (WBC)"] }), unitPolicy: CELL_POLICY, binding: assessment("blood", "wbc", "core", { coversConfidence: true, readinessGroup: "white_cells", contributionGroup: "white_cells" }) }),
  reviewed({ key: "platelets_whole_blood", analyteKey: "platelets", displayName: "Platelet count", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases(["platelets", "plt"], { fixtureValues: ["Platelets (PLT)"], russianValues: ["Тромбоциты (PLT)"] }), unitPolicy: CELL_POLICY, binding: assessment("blood", "platelets", "core", { coversConfidence: true, readinessGroup: "platelets", contributionGroup: "platelets" }) }),
  ...([["mcv", "Mean corpuscular volume", "mean_cell_volume", VOLUME_POLICY, ["Mean corpuscular volume (MCV)"]], ["mch", "Mean corpuscular hemoglobin", "mass_per_cell", { dimensions: ["mass_per_cell"], acceptedUnits: ["pg"], canonicalUnit: "pg", conversionPolicyRef: null, missingUnitPolicy: "ambiguous" } as MeasurementUnitPolicy, ["Mean corpuscular hemoglobin (MCH)"]], ["mchc", "Mean corpuscular hemoglobin concentration", "substance_concentration", PROTEIN_POLICY, ["Mean corpuscular hemoglobin concentration (MCHC)"]], ["mpv", "Mean platelet volume", "mean_cell_volume", VOLUME_POLICY, ["Mean platelet volume (MPV)"]], ["pdw", "Platelet distribution width", "distribution_width_cv", PERCENT_POLICY, ["Platelet distribution width (PDW)"]], ["plateletcrit", "Plateletcrit", "percentage", PERCENT_POLICY, ["Plateletcrit (PCT)"]]] as const).map(([key, displayName, property, unitPolicy, fixtureValues]) => reviewed({ key: key === "plateletcrit" ? "plateletcrit_percent" : key === "pdw" ? "pdw_cv" : `${key}_whole_blood`, analyteKey: key, displayName, specimen: "whole_blood", property, scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases([key], { fixtureValues }), unitPolicy })),
  reviewed({ key: "rdw_cv", analyteKey: "red_cell_distribution_width", displayName: "RDW-CV", specimen: "whole_blood", property: "distribution_width_cv", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases(["rdw", "rdw_cv", "rdw-cv"], { fixtureValues: ["Red cell distribution width (RDW)", "Red cell distribution width CV (RDW-CV)"] }), unitPolicy: PERCENT_POLICY, binding: assessment("blood", "rdw", "extended", { contributionGroup: "red_cell_variation" }) }),
  reviewed({ key: "rdw_sd", analyteKey: "red_cell_distribution_width", displayName: "RDW-SD", specimen: "whole_blood", property: "distribution_width_sd", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases(["rdw", "rdw_sd", "rdw-sd"], { fixtureValues: ["Red cell distribution width SD (RDW-SD)"] }), unitPolicy: VOLUME_POLICY, binding: assessment("blood", "rdw", "extended", { contributionGroup: "red_cell_variation" }) }),
  ...([["neutrophils", "NEU", "Нейтрофилы"], ["lymphocytes", "LYM", "Лимфоциты"], ["monocytes", "MON", "Моноциты"], ["eosinophils", "EOS", "Эозинофилы"], ["basophils", "BAS", "Базофилы"]] as const).flatMap(([key, abbreviation, russian]) => [reviewed({ key: `${key}_percent`, analyteKey: key, displayName: `${key}, percent`, specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases([key, `${key}_percent`, abbreviation, `${abbreviation}%`], { fixtureValues: [`${key[0]!.toUpperCase()}${key.slice(1)} (${abbreviation}%)`, ...(key === "lymphocytes" ? ["Lymphocytes (LYMF%)"] : [])], russianValues: [`${russian} (${abbreviation}%)`] }), unitPolicy: PERCENT_POLICY }), reviewed({ key: `${key}_abs`, analyteKey: key, displayName: `${key}, absolute`, specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: cbcAliases([...(key === "neutrophils" ? [key] : []), `${key}_abs`, abbreviation], { fixtureValues: [`${key[0]!.toUpperCase()}${key.slice(1)}, absolute (${abbreviation})`, ...(key === "lymphocytes" ? ["Lymphocytes, absolute (LYMF)"] : [])], russianValues: [`${russian}, абс. (${abbreviation})`] }), unitPolicy: CELL_POLICY })]),
  ...([["reticulocytes_percent", "reticulocytes", "percentage", PERCENT_POLICY, "Reticulocytes (RETIC%)"], ["reticulocytes_abs", "reticulocytes", "cell_count", CELL_POLICY, "Reticulocytes, absolute (RETIC)"], ["segmented_neutrophils_percent", "neutrophils", "segmented_percentage", PERCENT_POLICY, "Segmented neutrophils"], ["band_neutrophils_percent", "neutrophils", "band_percentage", PERCENT_POLICY, "Band neutrophils"]] as const).map(([key, analyteKey, property, unitPolicy, fixtureLabel]) => reviewed({ key, analyteKey, displayName: fixtureLabel, specimen: "whole_blood", property, scale: "quantitative", timing: "point_in_time", method: key.includes("neutrophils") ? "manual" : "automated", valueKind: "numeric", aliases: cbcAliases([key, analyteKey, ...(key === "reticulocytes_percent" ? ["retic_percent"] : []), ...(key === "reticulocytes_abs" ? ["absolute_reticulocyte_count"] : [])], { fixtureValues: [fixtureLabel] }), unitPolicy, ...(key.includes("neutrophils") ? { requiredMethods: ["manual"] } : {}) })),
  ...(["lymphocytes", "monocytes", "eosinophils"] as const).map((analyteKey) => reviewed({ key: `${analyteKey}_manual_percent`, analyteKey, displayName: `${analyteKey}, manual differential`, specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "manual", valueKind: "numeric", aliases: cbcAliases([`${analyteKey}_manual`, `${analyteKey}_manual_differential`], { fixtureValues: [`${analyteKey[0]!.toUpperCase()}${analyteKey.slice(1)}, manual differential`] }), unitPolicy: PERCENT_POLICY, requiredMethods: ["manual"] })),
  // Nutrients and inflammation
  reviewed({ key: "vitamin_d_serum", analyteKey: "vitamin_d", displayName: "25-hydroxy vitamin D", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["vitamin_d", "25_oh_vitamin_d", "25_oh_d"], "registry", "reviewed"), unitPolicy: VITAMIN_D_POLICY, conversion: VITAMIN_D_CONVERSION, binding: assessment("nutrients", "vitamin_d", "core", { coversConfidence: true, readinessGroup: "vitamin_d", contributionGroup: "vitamin_d" }) }),
  reviewed({ key: "b12_serum", analyteKey: "b12", displayName: "Vitamin B12", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["b12", "vitamin_b12", "cobalamin"], "registry", "reviewed"), unitPolicy: B12_POLICY, binding: assessment("nutrients", "b12", "core", { coversConfidence: true, readinessGroup: "b12", contributionGroup: "b12" }) }),
  reviewed({ key: "folate_serum", analyteKey: "folate", displayName: "Folate", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["folate", "folic_acid"], "registry", "reviewed"), unitPolicy: B12_POLICY, binding: assessment("nutrients", "folate", "core", { coversConfidence: true, readinessGroup: "folate", contributionGroup: "folate" }) }),
  reviewed({ key: "crp_serum", analyteKey: "crp", displayName: "C-reactive protein", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["crp", "c_reactive_protein", "C-reactive protein, quantitative"], "registry", "reviewed"), unitPolicy: { dimensions: ["mass_concentration"], acceptedUnits: ["mg/l"], canonicalUnit: "mg/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous" }, binding: assessment("inflammation", "crp", "display", { coversConfidence: true }) }),
];

/**
 * De-identified corpus labels remain provisional evidence records. They make
 * raw results recognisable without granting a concrete Registry 2.0 identity.
 */
const SAMPLE_FIXTURES: readonly [string, string, "numeric" | "qualitative"][] = [
  ["total_protein", "Total protein", "numeric"], ["total_bilirubin", "Total bilirubin", "numeric"], ["direct_bilirubin", "Direct bilirubin", "numeric"], ["crp", "C-reactive protein, quantitative", "numeric"], ["aso", "Antistreptolysin-O (ASO)", "numeric"],
  ["alt_sample", "ALT (alanine aminotransferase)", "numeric"], ["ast_sample", "AST (aspartate aminotransferase)", "numeric"],
  ["red_blood_cells", "Red blood cells (RBC)", "numeric"], ["hemoglobin", "Hemoglobin (HGB)", "numeric"], ["hematocrit", "Hematocrit (HCT)", "numeric"], ["mcv", "Mean corpuscular volume (MCV)", "numeric"], ["mch", "Mean corpuscular hemoglobin (MCH)", "numeric"], ["mchc", "Mean corpuscular hemoglobin concentration (MCHC)", "numeric"], ["rdw_sample", "Red cell distribution width (RDW)", "numeric"], ["platelets", "Platelets (PLT)", "numeric"], ["mpv", "Mean platelet volume (MPV)", "numeric"], ["pdw", "Platelet distribution width (PDW)", "numeric"], ["plateletcrit", "Plateletcrit (PCT)", "numeric"], ["white_blood_cells", "White blood cells (WBC)", "numeric"], ["neutrophils_percent_sample", "Neutrophils (NEU%)", "numeric"], ["neutrophils_abs_sample", "Neutrophils, absolute (NEU)", "numeric"], ["lymphocytes_percent_sample", "Lymphocytes (LYMF%)", "numeric"], ["lymphocytes_abs_sample", "Lymphocytes, absolute (LYMF)", "numeric"],
  ["monocytes_percent", "Monocytes (MON%)", "numeric"], ["monocytes_abs", "Monocytes, absolute (MON)", "numeric"], ["eosinophils_percent", "Eosinophils (EOS%)", "numeric"], ["eosinophils_abs", "Eosinophils, absolute (EOS)", "numeric"], ["basophils_percent", "Basophils (BAS%)", "numeric"], ["basophils_abs", "Basophils, absolute (BAS)", "numeric"], ["esr", "ESR, Westergren automated", "numeric"], ["segmented_neutrophils", "Segmented neutrophils", "numeric"], ["band_neutrophils", "Band neutrophils", "numeric"], ["lymphocytes_manual", "Lymphocytes, manual differential", "numeric"], ["monocytes_manual", "Monocytes, manual differential", "numeric"], ["eosinophils_manual", "Eosinophils, manual differential", "numeric"],
  ["giardia_antibodies_total", "Giardia antibodies, total", "numeric"], ["ascaris_igg", "Ascaris IgG antibodies", "qualitative"], ["toxocara_igg", "anti-Toxocara IgG, qualitative ELISA", "qualitative"], ["opisthorchis_felineus_igg", "anti-Opisthorchis felineus IgG, qualitative ELISA", "qualitative"], ["echinococcus_igg", "anti-Echinococcus IgG, qualitative ELISA", "qualitative"], ["trichinella_igg", "anti-Trichinella sp. IgG, qualitative ELISA", "qualitative"], ["total_ige", "Total IgE", "numeric"], ["eosinophilic_cationic_protein", "Eosinophilic cationic protein (ECP)", "numeric"],
];
export const SAMPLE_NEWEST_LAUNCH_CORPUS = {
  id: "sample_newest.pdf",
  owner: "registry-release",
  deIdentified: true,
  fixtures: SAMPLE_FIXTURES.map(([key, label]) => ({
    id: `sample-newest:${key}`,
    rawLabel: label,
    authorizedAliasKeys: [`sample_${key}:fixture:1`, `sample_${key}:fixture:2`],
  })),
} as const;

const TYPED_LAUNCH_FIXTURE_KEYS: Record<string, true> = {
  total_protein: true, total_bilirubin: true, direct_bilirubin: true, crp: true, aso: true, alt_sample: true, ast_sample: true, esr: true,
  giardia_antibodies_total: true, ascaris_igg: true, toxocara_igg: true, opisthorchis_felineus_igg: true, echinococcus_igg: true,
  trichinella_igg: true, total_ige: true, eosinophilic_cationic_protein: true,
};

const PROVISIONAL_LAUNCH_DEFINITIONS: readonly MeasurementDefinition[] = [
  provisional({ key: "total_protein_unspecified", analyteKey: "total_protein", displayName: "Total protein", specimen: "unspecified", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "unspecified", valueKind: "numeric", aliases: aliases(["Total protein", "total_protein"], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: PROTEIN_POLICY }),
  provisional({ key: "direct_bilirubin_unspecified", analyteKey: "direct_bilirubin", displayName: "Direct bilirubin", specimen: "unspecified", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "unspecified", valueKind: "numeric", aliases: aliases(["Direct bilirubin", "direct_bilirubin", "conjugated_bilirubin"], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: BILIRUBIN_POLICY }),
  provisional({ key: "aso_unspecified", analyteKey: "aso", displayName: "Antistreptolysin-O (ASO)", specimen: "unspecified", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "unspecified", valueKind: "numeric", aliases: aliases(["Antistreptolysin-O (ASO)", "aso"], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: ASO_POLICY }),
  provisional({ key: "esr_westergren_automated", analyteKey: "esr", displayName: "ESR, Westergren automated", specimen: "unspecified", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["ESR, Westergren automated", "esr"], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: ESR_POLICY }),
  provisional({ key: "giardia_antibodies_total", analyteKey: "giardia_antibodies_total", displayName: "Giardia antibodies, total", specimen: "unspecified", property: "presence", scale: "quantitative", timing: "point_in_time", method: "unspecified", valueKind: "numeric", aliases: aliases(["Giardia antibodies, total", "giardia_antibodies_total"], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: POSITIVITY_COEFFICIENT_POLICY }),
  provisional({ key: "ascaris_igg", analyteKey: "ascaris_igg", displayName: "Ascaris IgG antibodies", specimen: "unspecified", property: "presence", scale: "nominal", timing: "point_in_time", method: "unspecified", valueKind: "qualitative", aliases: aliases(["Ascaris IgG antibodies", "ascaris_igg"], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: TITER_POLICY }),
  ...([["toxocara_igg", "anti-Toxocara IgG, qualitative ELISA"], ["opisthorchis_felineus_igg", "anti-Opisthorchis felineus IgG, qualitative ELISA"], ["echinococcus_igg", "anti-Echinococcus IgG, qualitative ELISA"], ["trichinella_igg", "anti-Trichinella sp. IgG, qualitative ELISA"]] as const).map(([analyteKey, displayName]) => provisional({ key: analyteKey, analyteKey, displayName, specimen: "unspecified", property: "presence", scale: "nominal", timing: "point_in_time", method: "unspecified", valueKind: "qualitative", aliases: aliases([displayName, analyteKey], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: DISPLAY_POLICY })),
  provisional({ key: "total_ige_unspecified", analyteKey: "total_ige", displayName: "Total IgE", specimen: "unspecified", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "unspecified", valueKind: "numeric", aliases: aliases(["Total IgE", "total_ige"], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: TOTAL_IGE_POLICY }),
  provisional({ key: "ecp_unspecified", analyteKey: "eosinophilic_cationic_protein", displayName: "Eosinophilic cationic protein (ECP)", specimen: "unspecified", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "unspecified", valueKind: "numeric", aliases: aliases(["Eosinophilic cationic protein (ECP)", "eosinophilic_cationic_protein"], "fixture", "provisional", ["sample_newest.pdf"]), unitPolicy: ECP_POLICY }),
];

const SAMPLE_FIXTURE_DEFINITIONS: readonly MeasurementDefinition[] = SAMPLE_FIXTURES
  .filter(([key]) => !TYPED_LAUNCH_FIXTURE_KEYS[key])
  .map(([key, label, valueKind]) => {
  const definitionKey = `sample_${key}`;
  const sourceProvenance = { kind: "sample_fixture" as const, sourceRecordKey: "sample_newest.pdf" };
  return {
    key: definitionKey,
    analyteKey: key,
    displayName: label,
    maturity: "provisional",
    sourceProvenance,
    specimen: "unspecified",
    property: "unspecified",
    scale: valueKind === "qualitative" ? "nominal" : "quantitative",
    timing: "unspecified",
    method: "unspecified",
    valueKind,
    aliases: aliases([label, key], "fixture", "provisional", ["sample_newest.pdf"]).map((alias, index): AliasDefinition => ({
      ...alias,
      key: `${definitionKey}:fixture:${index + 1}`,
      measurementDefinitionKey: definitionKey,
      matchType: "normalized",
      matchAuthority: "recognition_only",
      lifecycle: "active",
      provenance: sourceProvenance,
    })),
    unitPolicy: DISPLAY_POLICY,
    conversion: null,
    assessmentBindings: [],
  };
  });

/** Only reviewed Registry 2.0 definitions are eligible for concrete runtime behavior. */
export const CURATED_MEASUREMENT_DEFINITIONS = REVIEWED_DEFINITIONS;
export const MEASUREMENT_DEFINITIONS: readonly MeasurementDefinition[] = [...REVIEWED_DEFINITIONS, ...PROVISIONAL_LAUNCH_DEFINITIONS, ...SAMPLE_FIXTURE_DEFINITIONS];

export const ANALYTES: readonly Analyte[] = [...new Map(MEASUREMENT_DEFINITIONS.map((definition) => [
  definition.analyteKey,
  { key: definition.analyteKey, displayName: definition.displayName, aliases: definition.aliases.map((alias) => alias.value), status: "active" as const },
])).values()];

const DEFINITION_BY_KEY = new Map(MEASUREMENT_DEFINITIONS.map((definition) => [definition.key, definition]));
const ANALYTE_BY_KEY = new Map(ANALYTES.map((analyte) => [analyte.key, analyte]));

function normalizeRawUnit(rawUnit: string): string {
  return rawUnit
    .trim()
    .toLowerCase()
    .replace(/[µμ]/g, "u")
    .replace(/[×]/g, "x")
    .replace(/[²]/g, "2")
    .replace(/\s+/g, "")
    .replace(/x?10\^?9\/l/g, "10^9/l")
    .replace(/x?10\^?12\/l/g, "10^12/l")
    .replace(/x?10\^?3\/(ul|u?l)/g, "10^3/ul");
}

export function normalizeMeasurementUnit(rawUnit: string | null | undefined): NormalizedMeasurementUnit {
  const raw = rawUnit?.trim() ?? "";
  const unit = normalizeRawUnit(raw);
  if (!unit) return { raw, normalizedUnit: null, dimension: null };
  if (["%", "percent", "mmol/mol"].includes(unit)) return { raw, normalizedUnit: unit === "percent" ? "%" : unit, dimension: "ratio" };
  if (["fl", "femtoliter", "femtolitre"].includes(unit)) return { raw, normalizedUnit: "fl", dimension: "volume" };
  if (["pg", "picogram"].includes(unit)) return { raw, normalizedUnit: "pg", dimension: "mass_per_cell" };
  if (["10^9/l", "10^3/ul", "10^12/l"].includes(unit)) return { raw, normalizedUnit: unit, dimension: "cell_concentration" };
  if (["u/l", "iu/l"].includes(unit)) return { raw, normalizedUnit: "u/l", dimension: "catalytic_activity_concentration" };
  if (["mmol/l", "umol/l", "nmol/l", "pmol/l"].includes(unit)) return { raw, normalizedUnit: unit, dimension: "molar_concentration" };
  if (["mg/dl", "g/dl", "g/l", "mg/l", "ng/ml", "ng/dl", "pg/ml", "ug/dl"].includes(unit)) return { raw, normalizedUnit: unit, dimension: "mass_concentration" };
  if (["miu/l", "uiu/ml", "iu/ml", "mg/g", "mg/mmol", "ml/min/1.73m2", "mm/hour", "titer", "positivitycoefficient"].includes(unit)) return { raw, normalizedUnit: unit, dimension: "arbitrary" };
  return { raw, normalizedUnit: unit, dimension: null };
}

export function normalizeUnitToken(unit: string | null | undefined): UnitToken {
  return normalizeMeasurementUnit(unit).dimension ?? "unknown";
}

export function getMeasurementDefinition(key: string): MeasurementDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

/** Returns conversion metadata only for a reviewed, concrete Registry 2.0 definition key. */
export function getMeasurementConversionPolicy(key: string): ConversionRule | null {
  const definition = getMeasurementDefinition(key);
  return definition?.maturity === "reviewed" ? definition.conversion ?? null : null;
}

export function getAnalyte(key: string): Analyte | undefined {
  return ANALYTE_BY_KEY.get(key);
}

export function getMeasurementIdentity(definition: MeasurementDefinition) {
  return [definition.analyteKey, definition.specimen, definition.property, definition.scale, definition.timing, definition.method, definition.valueKind] as const;
}

export function getMeasurementDefinitionsForAnalyte(analyteKey: string): readonly MeasurementDefinition[] {
  return MEASUREMENT_DEFINITIONS.filter((definition) => definition.analyteKey === analyteKey);
}


export type ReviewedAssessmentBinding = {
  definition: MeasurementDefinition;
  binding: AssessmentBinding & {
    status: "reviewed";
    compatibility: "compatible";
    system: BodySystemId;
    scoreRole: ScoreRole;
    coversConfidence: boolean;
  };
};

/**
 * Resolves an active definition key (preferred) or a reviewed assessment input
 * key emitted by the read boundary. It never evaluates aliases or raw labels.
 */
export function getReviewedAssessmentBinding(key: string | null | undefined): ReviewedAssessmentBinding | null {
  if (!key) return null;
  const candidates = getMeasurementDefinition(key)
    ? [getMeasurementDefinition(key)!]
    : MEASUREMENT_DEFINITIONS.filter((definition) => definition.assessmentBindings.some((binding) => binding.assessmentInputKey === key));

  for (const definition of candidates) {
    if (definition.maturity !== "reviewed" || definition.sourceProvenance.kind !== "registry_v2_review") continue;
    const binding = definition.assessmentBindings.find((candidate) =>
      candidate.status === "reviewed" &&
      candidate.compatibility === "compatible" &&
      candidate.system !== undefined &&
      candidate.scoreRole !== undefined &&
      candidate.coversConfidence !== undefined
    );
    if (binding && binding.system && binding.scoreRole && binding.coversConfidence !== undefined) {
      return { definition, binding: binding as ReviewedAssessmentBinding["binding"] };
    }
  }
  return null;
}

function reviewedBindingsForSystem(system: BodySystemId): ReviewedAssessmentBinding[] {
  return MEASUREMENT_DEFINITIONS.flatMap((definition) =>
    definition.maturity === "reviewed"
      ? definition.assessmentBindings.flatMap((binding) => {
          if (
            binding.status !== "reviewed" ||
            binding.compatibility !== "compatible" ||
            binding.system !== system ||
            binding.scoreRole === undefined ||
            binding.coversConfidence === undefined
          ) return [];
          return [{ definition, binding: binding as ReviewedAssessmentBinding["binding"] }];
        })
      : []
  );
}

export function getReviewedScoreReadinessGroups(system: BodySystemId): readonly ScoreRequiredGroup[] {
  const groups = new Map<string, string[]>();
  for (const { binding } of reviewedBindingsForSystem(system)) {
    if (!binding.readinessGroup) continue;
    const keys = groups.get(binding.readinessGroup) ?? [];
    if (!keys.includes(binding.assessmentInputKey)) keys.push(binding.assessmentInputKey);
    groups.set(binding.readinessGroup, keys);
  }
  return [...groups.values()];
}

export function getReviewedScoreContributionGroups(system: BodySystemId): readonly ScoreContributionGroup[] {
  const groups = new Map<string, string[]>();
  for (const { binding } of reviewedBindingsForSystem(system)) {
    if (!binding.contributionGroup) continue;
    const keys = groups.get(binding.contributionGroup) ?? [];
    if (!keys.includes(binding.assessmentInputKey)) keys.push(binding.assessmentInputKey);
    groups.set(binding.contributionGroup, keys);
  }
  return [...groups.entries()].map(([id, keys]) => ({ id, keys }));
}

export function listReviewedCoverageKeys(system: BodySystemId): readonly string[] {
  return [...new Set(
    reviewedBindingsForSystem(system)
      .filter(({ binding }) => binding.coversConfidence && binding.scoreRole !== "display")
      .map(({ binding }) => binding.assessmentInputKey)
  )];
}

function evidence(code: ResolutionReasonCode, source: ResolutionEvidence["source"], strength: ResolutionEvidence["strength"], score: number, observed?: string, expected?: readonly string[]): ResolutionEvidence {
  return { code, source, strength, score, ...(observed ? { observed } : {}), ...(expected ? { expected } : {}) };
}

function canonicalLabel(value: string): string {
  return value.normalize("NFKC").trim();
}

function normalizedMealTimingModifier(value: string | null | undefined): "fasting" | "post_prandial" | null {
  const modifier = snakeCaseToken(value ?? "");
  if (modifier === "fasting") return "fasting";
  return modifier === "post_prandial" || modifier === "postprandial" ? "post_prandial" : null;
}

function damerauLevenshtein(left: string, right: string): number {
  const table = Array.from({ length: left.length + 1 }, (_, row) => Array.from({ length: right.length + 1 }, (_, column) => row === 0 ? column : column === 0 ? row : 0));
  for (let row = 1; row <= left.length; row++) for (let column = 1; column <= right.length; column++) {
    const cost = left[row - 1] === right[column - 1] ? 0 : 1;
    table[row]![column] = Math.min(table[row - 1]![column]! + 1, table[row]![column - 1]! + 1, table[row - 1]![column - 1]! + cost, row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1] ? table[row - 2]![column - 2]! + cost : Number.MAX_SAFE_INTEGER);
  }
  return table[left.length]![right.length]!;
}

function aliasMatches(alias: AliasDefinition, rawLabel: string, normalizedLabel: string, laboratory: string | null | undefined): boolean {
  if (alias.lifecycle !== "active" || (alias.laboratory && alias.laboratory !== laboratory)) return false;
  if (alias.matchType === "exact") return canonicalLabel(alias.value) === canonicalLabel(rawLabel);
  if (alias.matchType === "normalized" || alias.matchType === "ocr_variant") return alias.normalizedValue === normalizedLabel;
  return normalizedLabel.length >= 5 && alias.maxNormalizedEditDistance !== undefined && damerauLevenshtein(alias.normalizedValue, normalizedLabel) <= alias.maxNormalizedEditDistance;
}

export function findAliasAdmissions(input: Pick<MeasurementResolutionInput, "rawLabel" | "laboratory">, definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS): Array<{ definition: MeasurementDefinition; alias: MatchedAlias }> {
  const normalizedLabel = snakeCaseToken(input.rawLabel);
  return definitions.flatMap((definition) => definition.aliases.filter((alias) => aliasMatches(alias, input.rawLabel, normalizedLabel, input.laboratory)).map((alias) => ({ definition, alias })));
}

const SUPPORTED_SPECIMENS: readonly Exclude<SpecimenKey, "unspecified">[] = [
  "serum",
  "plasma",
  "whole_blood",
  "urine",
];

export function evaluateUnitCompatibility(
  policy: MeasurementUnitPolicy,
  unit: NormalizedMeasurementUnit
): CompatibilityEvidenceResult {
  if (!unit.normalizedUnit) {
    if (policy.missingUnitPolicy === "display_only") {
      return {
        disposition: "compatible",
        evidence: evidence("unit_not_required", "unit", "weak", 0, undefined, ["display_only"]),
        selectable: true,
      };
    }
    return {
      disposition: "missing",
      evidence: evidence("unit_missing", "unit", "weak", 0, undefined, [policy.missingUnitPolicy]),
      missingAxis: "unit",
      selectable: policy.missingUnitPolicy !== "reject",
    };
  }
  if (policy.missingUnitPolicy === "display_only") {
    return {
      disposition: "compatible",
      evidence: evidence("unit_not_required", "unit", "weak", 0, unit.normalizedUnit, ["display_only"]),
      selectable: true,
    };
  }
  if (!unit.dimension) {
    return {
      disposition: "conflict",
      evidence: evidence("unit_unsupported", "unit", "hard", 0, unit.normalizedUnit, policy.acceptedUnits),
      selectable: false,
    };
  }
  if (!policy.dimensions.includes(unit.dimension)) {
    return {
      disposition: "conflict",
      evidence: evidence("unit_dimension_conflict", "unit", "hard", 0, unit.normalizedUnit, policy.dimensions),
      selectable: false,
    };
  }
  if (!policy.acceptedUnits.includes(unit.normalizedUnit)) {
    return {
      disposition: "conflict",
      evidence: evidence("unit_not_accepted", "unit", "hard", 0, unit.normalizedUnit, policy.acceptedUnits),
      selectable: false,
    };
  }
  return {
    disposition: "compatible",
    evidence: evidence("unit_compatible", "unit", "strong", 15, unit.normalizedUnit, policy.acceptedUnits),
    selectable: true,
  };
}

export function evaluateValueKindCompatibility(
  expected: MeasurementValueKind,
  observed: MeasurementValueKind | null | undefined
): CompatibilityEvidenceResult | null {
  if (expected === "unspecified") return null;
  if (!observed || observed === "unspecified") {
    return {
      disposition: "missing",
      evidence: evidence("value_kind_missing", "value_kind", "weak", 0, undefined, [expected]),
      missingAxis: "value_kind",
      selectable: true,
    };
  }
  const compatible =
    observed === expected ||
    ((expected === "qualitative" || expected === "ordinal") &&
      (observed === "qualitative" || observed === "ordinal"));
  return compatible
    ? {
        disposition: "compatible",
        evidence: evidence("value_kind_compatible", "value_kind", "strong", 15, observed, [expected]),
        selectable: true,
      }
    : {
        disposition: "conflict",
        evidence: evidence("value_kind_conflict", "value_kind", "hard", 0, observed, [expected]),
        selectable: false,
      };
}

export function evaluateSpecimenCompatibility(
  expected: SpecimenKey,
  observed: string | null | undefined
): CompatibilityEvidenceResult | null {
  if (expected === "unspecified") return null;
  const normalized = snakeCaseToken(observed ?? "");
  if (!normalized || normalized === "unspecified") {
    return {
      disposition: "missing",
      evidence: evidence("specimen_missing", "specimen", "weak", 0, undefined, [expected]),
      missingAxis: "specimen",
      selectable: true,
    };
  }
  if (!SUPPORTED_SPECIMENS.includes(normalized as Exclude<SpecimenKey, "unspecified">)) {
    return {
      disposition: "conflict",
      evidence: evidence("specimen_unsupported", "specimen", "hard", 0, normalized, SUPPORTED_SPECIMENS),
      selectable: false,
    };
  }
  return normalized === expected
    ? {
        disposition: "compatible",
        evidence: evidence("specimen_compatible", "specimen", "strong", 10, normalized, [expected]),
        selectable: true,
      }
    : {
        disposition: "conflict",
        evidence: evidence("specimen_conflict", "specimen", "hard", 0, normalized, [expected]),
        selectable: false,
      };
}

function candidateEvidence(
  definition: MeasurementDefinition,
  alias: MatchedAlias,
  input: MeasurementResolutionInput,
  unit: NormalizedMeasurementUnit
): CandidateEvidence {
  const label: readonly [ResolutionReasonCode, number] =
    alias.matchType === "exact"
      ? ["alias_exact_match", 40]
      : alias.matchType === "bounded_fuzzy"
        ? ["alias_bounded_fuzzy_match", 28]
        : alias.matchType === "ocr_variant"
          ? ["alias_ocr_variant_match", 28]
          : ["alias_normalized_match", 36];
  const accepted: ResolutionEvidence[] = [
    evidence(label[0], "label", "strong", label[1], alias.value),
  ];
  const missing: ResolutionEvidence[] = [];
  const rejected: ResolutionEvidence[] = [];
  const missingAxes: ClinicalCompatibilityAxis[] = [];
  let selectable = true;
  const applyCompatibility = (result: CompatibilityEvidenceResult | null) => {
    if (!result) return;
    selectable &&= result.selectable;
    if (result.disposition === "compatible") accepted.push(result.evidence);
    if (result.disposition === "missing") {
      missing.push(result.evidence);
      if (result.missingAxis) missingAxes.push(result.missingAxis);
    }
    if (result.disposition === "conflict") rejected.push(result.evidence);
  };
  const conflict = (
    code: ResolutionReasonCode,
    source: ResolutionEvidence["source"],
    observed: string,
    expected: readonly string[]
  ) => {
    selectable = false;
    rejected.push(evidence(code, source, "hard", 0, observed, expected));
  };

  applyCompatibility(evaluateValueKindCompatibility(definition.valueKind, input.valueKind));
  applyCompatibility(evaluateUnitCompatibility(definition.unitPolicy, unit));
  applyCompatibility(evaluateSpecimenCompatibility(definition.specimen, input.specimen));

  if (definition.requiredModifiers?.length) {
    const modifier = normalizedMealTimingModifier(input.modifier) ?? snakeCaseToken(input.modifier ?? "");
    if (!modifier || modifier === "none") {
      missingAxes.push("modifier");
      if (definition.timing !== "point_in_time" && definition.timing !== "unspecified") missingAxes.push("timing");
      missing.push(evidence("modifier_missing", "modifier", "weak", 0, undefined, definition.requiredModifiers));
    } else if (!definition.requiredModifiers.includes(modifier)) {
      conflict("modifier_conflict", "modifier", modifier, definition.requiredModifiers);
    } else {
      accepted.push(evidence("modifier_compatible", "modifier", "strong", 5, modifier));
    }
  } else {
    const timingModifier = normalizedMealTimingModifier(input.modifier);
    if (timingModifier && definition.timing !== timingModifier) {
      conflict("modifier_conflict", "modifier", timingModifier, [definition.timing]);
    }
  }
  const timing = input.timing ?? normalizedMealTimingModifier(input.modifier);
  for (const [axis, value, expected, compatible, conflictCode, missingCode] of [
    ["timing", timing, definition.timing, "timing_compatible", "timing_conflict", "timing_missing"],
    ["method", input.method, definition.method, "method_compatible", "method_conflict", "method_missing"],
  ] as const) {
    if (expected === "unspecified" || expected === "point_in_time" || expected === "automated") continue;
    if (!value || value === "unspecified") {
      missingAxes.push(axis);
      missing.push(evidence(missingCode, axis === "timing" ? "section" : "label", "weak", 0, undefined, [expected]));
    } else if (value !== expected) {
      conflict(conflictCode, axis === "timing" ? "section" : "label", value, [expected]);
    } else {
      accepted.push(evidence(compatible, axis === "timing" ? "section" : "label", "strong", 5, value));
    }
  }
  if (input.section) accepted.push(evidence("section_support", "section", "weak", 3, input.section));
  if (input.neighbourLabels?.length) accepted.push(evidence("neighbour_support", "neighbour", "weak", 3));
  if (input.referenceLow != null || input.referenceHigh != null) {
    accepted.push(evidence("reference_shape_support", "reference", "weak", 2));
  }
  const score = selectable ? accepted.reduce((sum, item) => sum + item.score, 0) : null;
  return {
    candidateKey: definition.key,
    matchedAlias: alias,
    accepted,
    missing,
    rejected,
    missingAxes,
    score,
    selectable,
    eligible: false,
  };
}

/** Resolve raw evidence against authorized Registry 2.0 candidates. */
export function resolveMeasurementDefinition(
  input: MeasurementResolutionInput,
  definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS
): MeasurementResolution {
  const unit = normalizeMeasurementUnit(input.rawUnit);
  const definitionByKey = new Map(
    definitions.map((definition) => [definition.key, definition])
  );
  const byDefinition = new Map<string, CandidateEvidence>();
  for (const { definition, alias } of findAliasAdmissions(input, definitions)) {
    const candidate = candidateEvidence(definition, alias, input, unit);
    const current = byDefinition.get(candidate.candidateKey);
    if (!current || (candidate.score ?? -1) > (current.score ?? -1)) {
      byDefinition.set(candidate.candidateKey, candidate);
    }
  }
  const candidates = [...byDefinition.values()].sort((a, b) =>
    a.candidateKey.localeCompare(b.candidateKey)
  );
  const ranked = candidates
    .filter((candidate) => candidate.selectable && candidate.score !== null)
    .sort((a, b) => (b.score! - a.score!) || a.candidateKey.localeCompare(b.candidateKey));
  const admissible = ranked.filter((candidate) => {
    const definition = definitionByKey.get(candidate.candidateKey)!;
    return (
      definition.maturity === "reviewed" &&
      definition.sourceProvenance.kind === "registry_v2_review" &&
      candidate.matchedAlias.matchAuthority === "reviewed_resolution" &&
      candidate.matchedAlias.approvalStatus === "reviewed" &&
      candidate.missingAxes.length === 0 &&
      candidate.score! >= 55
    );
  });
  const winner = admissible[0];
  const runnerUp = admissible[1];
  const resolved = !!winner && (!runnerUp || winner.score! - runnerUp.score! >= 5);
  const result = resolved
    ? "resolved"
    : admissible.length > 1
      ? "ambiguous"
      : candidates.length
        ? "partial"
        : "unmapped";
  const selected = resolved ? definitionByKey.get(winner!.candidateKey) : undefined;
  const confidence =
    result === "unmapped"
      ? 0
      : Math.min(0.99, ((winner ?? ranked[0])?.score ?? 0) / 100);
  const band: MappingConfidenceBand =
    confidence >= 0.85 ? "high" : confidence >= 0.6 ? "medium" : "low";
  const evidenceByCandidate = candidates.map((candidate) => ({
    ...candidate,
    eligible: admissible.some(
      ({ candidateKey }) => candidateKey === candidate.candidateKey
    ),
  }));
  const analytes = new Set(
    candidates
      .map((candidate) => definitionByKey.get(candidate.candidateKey)?.analyteKey)
      .filter((key): key is string => Boolean(key))
  );
  return {
    result,
    measurementDefinitionKey: selected?.key ?? null,
    analyteKey:
      selected?.analyteKey ?? (analytes.size === 1 ? [...analytes][0] : null),
    mappingConfidence: confidence,
    mappingConfidenceBand: band,
    unit,
    unitToken: unit.dimension ?? "unknown",
    candidateKeys: ranked.map(({ candidateKey }) => candidateKey),
    missingAxes: [...new Set(candidates.flatMap(({ missingAxes }) => missingAxes))],
    conflicts: [
      ...new Set(
        candidates.flatMap(({ rejected }) => rejected.map(({ code }) => code))
      ),
    ],
    candidateEvidence: evidenceByCandidate,
    reasons: [
      ...new Set(
        candidates.flatMap(({ accepted, missing, rejected }) =>
          [...accepted, ...missing, ...rejected].map(({ code }) => code)
        )
      ),
    ],
    decisionTrace: {
      version: 2,
      compatibilityPolicyVersion: MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
      selectedCandidateKey: selected?.key ?? null,
      runnerUpCandidateKey: runnerUp?.candidateKey ?? null,
      outcome: result,
      confidence,
      candidates: evidenceByCandidate,
    },
  };
}

const TRACE_REASON_CODES: Record<ResolutionReasonCode, true> = {
  definition_key_match: true,
  alias_exact_match: true,
  alias_normalized_match: true,
  alias_ocr_variant_match: true,
  alias_bounded_fuzzy_match: true,
  proposed_key_match: true,
  unit_compatible: true,
  unit_not_required: true,
  unit_dimension_conflict: true,
  unit_not_accepted: true,
  unit_unsupported: true,
  unit_missing: true,
  specimen_compatible: true,
  specimen_conflict: true,
  specimen_unsupported: true,
  modifier_compatible: true,
  modifier_conflict: true,
  section_support: true,
  neighbour_support: true,
  reference_shape_support: true,
  specimen_missing: true,
  modifier_missing: true,
  manual_selection: true,
  value_kind_compatible: true,
  value_kind_conflict: true,
  value_kind_missing: true,
  timing_compatible: true,
  timing_conflict: true,
  timing_missing: true,
  method_compatible: true,
  method_conflict: true,
  method_missing: true,
  candidate_not_selected: true,
};
const TRACE_MISSING_AXES: Record<ClinicalCompatibilityAxis, true> = {
  unit: true,
  specimen: true,
  modifier: true,
  timing: true,
  method: true,
  value_kind: true,
};
const TRACE_STRENGTHS = { hard: true, strong: true, weak: true } as const;
const TRACE_MATURITIES = { provisional: true, reviewed: true, retired: true } as const;
const TRACE_DECISION_KINDS: Record<ResolverDecisionKind, true> = {
  single_reviewed_candidate: true,
  multiple_reviewed_candidates: true,
  recognized_incomplete: true,
  no_matching_candidate: true,
  manual_selection: true,
};
const TRACE_IDENTIFIER = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const TRACE_VERSION = /^[A-Za-z0-9._:-]{1,128}$/;
const TRACE_HASH = /^[0-9a-f]{64}$/;
const TRACE_OUTCOMES = ["resolved", "ambiguous", "partial", "unmapped"] as const;

export type BuildPersistedResolverDecisionTraceOptions = {
  inputEvidenceHash: string;
  catalogManifestVersion: string;
  catalogManifestDigest: string;
  resolverVersion: string;
};

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

function isCanonicalStringList(values: readonly string[]) {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

const traceEvidenceSchema = z
  .object({
    code: z.string().refine((code) => Object.hasOwn(TRACE_REASON_CODES, code)),
    strength: z.string().refine((strength) => Object.hasOwn(TRACE_STRENGTHS, strength)),
  })
  .strict();
const traceCandidateSchema = z
  .object({
    candidateKey: z.string().regex(TRACE_IDENTIFIER),
    maturity: z.string().refine((maturity) => Object.hasOwn(TRACE_MATURITIES, maturity)),
    score: z.number().finite().nonnegative().nullable(),
    accepted: z.array(traceEvidenceSchema),
    rejected: z.array(traceEvidenceSchema),
    missingAxes: z.array(z.string().refine((axis) => Object.hasOwn(TRACE_MISSING_AXES, axis))),
    conflicts: z.array(z.string().refine((code) => Object.hasOwn(TRACE_REASON_CODES, code))),
  })
  .strict()
  .superRefine((candidate, context) => {
    const accepted = candidate.accepted.map((item) => `${item.code}:${item.strength}`);
    const rejected = candidate.rejected.map((item) => `${item.code}:${item.strength}`);
    const expectedConflicts = sortedUnique(
      candidate.rejected
        .filter((item) => item.strength === "hard")
        .map((item) => item.code)
    );
    if (!isCanonicalStringList(accepted)) {
      context.addIssue({ code: "custom", message: "Accepted trace evidence must be canonical" });
    }
    if (!isCanonicalStringList(rejected)) {
      context.addIssue({ code: "custom", message: "Rejected trace evidence must be canonical" });
    }
    if (!isCanonicalStringList(candidate.missingAxes)) {
      context.addIssue({ code: "custom", message: "Missing axes must be canonical" });
    }
    if (
      !isCanonicalStringList(candidate.conflicts) ||
      JSON.stringify(candidate.conflicts) !== JSON.stringify(expectedConflicts)
    ) {
      context.addIssue({ code: "custom", message: "Candidate conflicts must be canonical hard rejections" });
    }
  });
const resolverDecisionTraceSchema = z
  .object({
    schemaVersion: z.literal(RESOLVER_DECISION_TRACE_SCHEMA_VERSION),
    outcome: z.enum(TRACE_OUTCOMES),
    decisionKind: z.string().refine((kind) => Object.hasOwn(TRACE_DECISION_KINDS, kind)),
    inputEvidenceHash: z.string().regex(TRACE_HASH),
    catalogManifestVersion: z.string().regex(TRACE_VERSION),
    catalogManifestDigest: z.string().regex(TRACE_VERSION),
    resolverVersion: z.string().regex(TRACE_VERSION),
    winningCandidateKey: z.string().regex(TRACE_IDENTIFIER).nullable(),
    candidates: z.array(traceCandidateSchema),
    missingAxes: z.array(z.string().refine((axis) => Object.hasOwn(TRACE_MISSING_AXES, axis))),
    conflicts: z.array(z.string().refine((code) => Object.hasOwn(TRACE_REASON_CODES, code))),
  })
  .strict();

function traceDecisionKind(resolution: MeasurementResolution): ResolverDecisionKind {
  if (
    resolution.result === "resolved" &&
    resolution.candidateEvidence.some((candidate) =>
      candidate.accepted.some((evidenceItem) => evidenceItem.code === "manual_selection")
    )
  ) {
    return "manual_selection";
  }
  if (resolution.result === "resolved") return "single_reviewed_candidate";
  if (resolution.result === "ambiguous") return "multiple_reviewed_candidates";
  if (resolution.result === "partial") return "recognized_incomplete";
  return "no_matching_candidate";
}

/**
 * Produces the privacy-safe, canonical explanation stored with a normalization
 * revision. Raw resolver input and evidence observations are intentionally not
 * represented in this trace.
 */
export function buildPersistedResolverDecisionTrace(
  resolution: MeasurementResolution,
  options: BuildPersistedResolverDecisionTraceOptions
): PersistedResolverDecisionTrace {
  const candidates: PersistedResolverDecisionTraceCandidate[] = resolution.candidateEvidence
    .map((candidate) => {
      const definition = getMeasurementDefinition(candidate.candidateKey);
      if (!definition) {
        throw new Error(`Cannot trace an unknown measurement definition: ${candidate.candidateKey}`);
      }
      const rejected = candidate.rejected
        .map(({ code, strength }) => ({ code, strength }))
        .sort((left, right) =>
          left.code === right.code
            ? left.strength.localeCompare(right.strength)
            : left.code.localeCompare(right.code)
        );
      return {
        candidateKey: candidate.candidateKey,
        maturity: definition.maturity,
        score: candidate.score,
        accepted: candidate.accepted
          .map(({ code, strength }) => ({ code, strength }))
          .sort((left, right) =>
            left.code === right.code
              ? left.strength.localeCompare(right.strength)
              : left.code.localeCompare(right.code)
          ),
        rejected,
        missingAxes: sortedUnique(candidate.missingAxes),
        conflicts: sortedUnique(
          rejected
            .filter((evidenceItem) => evidenceItem.strength === "hard")
            .map((evidenceItem) => evidenceItem.code)
        ),
      };
    })
    .sort((left, right) => left.candidateKey.localeCompare(right.candidateKey));
  const trace: PersistedResolverDecisionTrace = {
    schemaVersion: RESOLVER_DECISION_TRACE_SCHEMA_VERSION,
    outcome: resolution.result,
    decisionKind: traceDecisionKind(resolution),
    inputEvidenceHash: options.inputEvidenceHash,
    catalogManifestVersion: options.catalogManifestVersion,
    catalogManifestDigest: options.catalogManifestDigest,
    resolverVersion: options.resolverVersion,
    winningCandidateKey:
      resolution.result === "resolved" ? resolution.measurementDefinitionKey : null,
    candidates,
    missingAxes: sortedUnique(candidates.flatMap((candidate) => candidate.missingAxes)),
    conflicts: sortedUnique(candidates.flatMap((candidate) => candidate.conflicts)),
  };
  if (!isPersistedResolverDecisionTrace(trace)) {
    throw new Error("Resolver decision trace is not canonical");
  }
  return trace;
}

/** Validates the persisted allowlisted schema before a trace is written or read. */
export function isPersistedResolverDecisionTrace(value: unknown): value is PersistedResolverDecisionTrace {
  const parsed = resolverDecisionTraceSchema.safeParse(value);
  if (!parsed.success) return false;
  const trace = parsed.data;
  const candidateKeys = trace.candidates.map((candidate) => candidate.candidateKey);
  const expectedMissingAxes = sortedUnique(
    trace.candidates.flatMap((candidate) => candidate.missingAxes)
  );
  const expectedConflicts = sortedUnique(
    trace.candidates.flatMap((candidate) => candidate.conflicts)
  );
  const decisionMatchesOutcome =
    (trace.outcome === "resolved" &&
      (trace.decisionKind === "single_reviewed_candidate" || trace.decisionKind === "manual_selection") &&
      trace.winningCandidateKey !== null) ||
    (trace.outcome === "ambiguous" &&
      trace.decisionKind === "multiple_reviewed_candidates" &&
      trace.winningCandidateKey === null) ||
    (trace.outcome === "partial" &&
      trace.decisionKind === "recognized_incomplete" &&
      trace.winningCandidateKey === null) ||
    (trace.outcome === "unmapped" &&
      trace.decisionKind === "no_matching_candidate" &&
      trace.winningCandidateKey === null);
  return (
    decisionMatchesOutcome &&
    isCanonicalStringList(candidateKeys) &&
    (trace.winningCandidateKey === null || candidateKeys.includes(trace.winningCandidateKey)) &&
    isCanonicalStringList(trace.missingAxes) &&
    isCanonicalStringList(trace.conflicts) &&
    JSON.stringify(trace.missingAxes) === JSON.stringify(expectedMissingAxes) &&
    JSON.stringify(trace.conflicts) === JSON.stringify(expectedConflicts)
  );
}

export type MeasurementRegistryValidation = { valid: boolean; errors: string[]; warnings: string[] };

export function validateMeasurementRegistry(definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS): MeasurementRegistryValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const keys = new Set<string>();
  const reviewedIdentities = new Map<string, string>();
  const aliasKeys = new Set<string>();
  for (const definition of definitions) {
    if (keys.has(definition.key)) errors.push(`Duplicate measurement definition key: ${definition.key}`);
    keys.add(definition.key);
    if (!definition.analyteKey || !definition.maturity || !definition.sourceProvenance || !definition.valueKind) errors.push(`Incomplete measurement definition: ${definition.key}`);
    if (definition.maturity === "reviewed") {
      if (definition.sourceProvenance.kind !== "registry_v2_review") errors.push(`Reviewed definition lacks Registry 2.0 provenance: ${definition.key}`);
      const identity = getMeasurementIdentity(definition).join("|");
      const existing = reviewedIdentities.get(identity);
      if (existing) errors.push(`Duplicate reviewed measurement identity: ${existing} and ${definition.key}`);
      reviewedIdentities.set(identity, definition.key);
      for (const binding of definition.assessmentBindings) {
        if (binding.status === "reviewed" && binding.compatibility === "compatible" && (binding.system === undefined || binding.scoreRole === undefined || binding.coversConfidence === undefined)) {
          errors.push(`Reviewed assessment binding lacks runtime metadata: ${definition.key}`);
        }
      }
    }
    for (const alias of definition.aliases) {
      if (aliasKeys.has(alias.key)) errors.push(`Duplicate alias key: ${alias.key}`);
      aliasKeys.add(alias.key);
      if (alias.measurementDefinitionKey !== definition.key) errors.push(`Alias owner mismatch: ${alias.key}`);
      if (!alias.provenance?.sourceRecordKey) errors.push(`Alias lacks provenance: ${alias.key}`);
      if (alias.source === "fixture" && !alias.fixtureRefs?.length) errors.push(`Fixture alias lacks fixture reference: ${alias.key}`);
      if (alias.matchType === "bounded_fuzzy" && (
        alias.matchAuthority !== "reviewed_resolution" ||
        alias.approvalStatus !== "reviewed" ||
        alias.lifecycle !== "active" ||
        alias.maxNormalizedEditDistance === undefined
      )) errors.push(`Bounded fuzzy alias lacks reviewed active authority: ${alias.key}`);
    }
    const { unitPolicy } = definition;
    if (unitPolicy.missingUnitPolicy === "display_only") {
      if (
        unitPolicy.dimensions.length ||
        unitPolicy.acceptedUnits.length ||
        unitPolicy.canonicalUnit !== null ||
        unitPolicy.conversionPolicyRef !== null
      ) {
        errors.push(`Display-only unit policy contains numeric metadata: ${definition.key}`);
      }
      if (definition.maturity === "reviewed" && definition.valueKind === "numeric") {
        errors.push(`Reviewed numeric definition uses display-only unit policy: ${definition.key}`);
      }
    } else {
      if (!unitPolicy.dimensions.length || !unitPolicy.acceptedUnits.length) {
        errors.push(`Numeric unit policy lacks dimensions or accepted units: ${definition.key}`);
      }
      if (!unitPolicy.canonicalUnit || !unitPolicy.acceptedUnits.includes(unitPolicy.canonicalUnit)) {
        errors.push(`Numeric unit policy canonical unit is not accepted: ${definition.key}`);
      }
      if (
        definition.maturity === "reviewed" &&
        (definition.valueKind === "qualitative" || definition.valueKind === "ordinal")
      ) {
        errors.push(`Reviewed non-numeric definition uses numeric unit policy: ${definition.key}`);
      }
    }
  }
  if (!definitions.some((definition) => definition.maturity === "reviewed")) warnings.push("No reviewed Registry 2.0 definitions are available");
  return { valid: errors.length === 0, errors, warnings };
}
