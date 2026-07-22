import { snakeCaseToken } from "./normalize";
import type {
  Analyte,
  AssessmentBinding,
  BodySystemId,
  CandidateEvidence,
  ConversionRule,
  MappingConfidenceBand,
  MeasurementAlias,
  MeasurementDefinition,
  MeasurementResolution,
  MeasurementResolutionInput,
  MeasurementUnitPolicy,
  NormalizedMeasurementUnit,
  ResolutionEvidence,
  ResolutionReasonCode,
  ScoreContributionGroup,
  ScoreRequiredGroup,
  ScoreRole,
  UnitDimension,
  UnitToken,
} from "./types";

export const MEASUREMENT_CATALOG_MANIFEST_VERSION = "2026-07-20.0";
export const MEASUREMENT_RESOLVER_VERSION = "5";
export const MEASUREMENT_NORMALIZATION_VERSION = "4";
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

function aliases(
  values: readonly string[],
  source: MeasurementAlias["source"],
  approvalStatus: "reviewed" | "provisional",
  fixtureRefs?: readonly string[]
): MeasurementAlias[] {
  return [...new Set(values)].map((value) => ({
    value,
    normalizedValue: snakeCaseToken(value),
    source,
    matchType: "normalized",
    approvalStatus,
    ...(fixtureRefs ? { fixtureRefs } : {}),
  }));
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
  "maturity" | "sourceProvenance" | "assessmentBindings"
> & { binding?: RuntimeBinding };

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

  return {
    ...record,
    maturity: "reviewed",
    sourceProvenance: { kind: "registry_v2_review", sourceRecordKey: `registry-2.0:${record.key}` },
    conversion: record.conversion ?? null,
    assessmentBindings,
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
  reviewed({ key: "glucose_serum", analyteKey: "glucose", displayName: "Glucose, serum", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "blood_glucose", "serum_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["serum"], conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "glucose", "core", { coversConfidence: true, contributionGroup: "glycemia" }) }),
  reviewed({ key: "glucose_plasma", analyteKey: "glucose", displayName: "Glucose, plasma", specimen: "plasma", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["glucose", "blood_glucose", "plasma_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["plasma"], conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "glucose", "core", { coversConfidence: true, contributionGroup: "glycemia" }) }),
  reviewed({ key: "glucose_whole_blood", analyteKey: "glucose", displayName: "Glucose, whole blood", specimen: "whole_blood", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["whole_blood_glucose"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["whole_blood"], conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "glucose", "core", { coversConfidence: true, contributionGroup: "glycemia" }) }),
  reviewed({ key: "fasting_glucose", analyteKey: "glucose", displayName: "Fasting glucose", specimen: "plasma", property: "substance_concentration", scale: "quantitative", timing: "fasting", method: "automated", valueKind: "numeric", aliases: aliases(["fasting_glucose", "fpg"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["plasma"], requiredModifiers: ["fasting"], conversion: GLUCOSE_CONVERSION, binding: assessment("metabolic", "fasting_glucose", "core", { coversConfidence: true, readinessGroup: "glycemia", contributionGroup: "glycemia" }) }),
  reviewed({ key: "hba1c_whole_blood", analyteKey: "hba1c", displayName: "Hemoglobin A1c", specimen: "whole_blood", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["hba1c", "hb_a1c", "glycated_hemoglobin"], "registry", "reviewed"), unitPolicy: HBA1C_POLICY, allowedSpecimens: ["whole_blood"], conversion: HBA1C_CONVERSION, binding: assessment("metabolic", "hba1c", "core", { coversConfidence: true, readinessGroup: "glycemia", contributionGroup: "glycemia" }) }),

  // Cardiovascular
  reviewed({ key: "ldl_serum", analyteKey: "ldl", displayName: "LDL cholesterol", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["ldl", "ldl_c", "ldl_cholesterol"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, allowedSpecimens: ["serum"], conversion: CHOLESTEROL_CONVERSION, binding: assessment("cardiovascular", "ldl", "core", { coversConfidence: true, readinessGroup: "atherogenic_cholesterol", contributionGroup: "atherogenic_cholesterol" }) }),
  reviewed({ key: "non_hdl_cholesterol_serum", analyteKey: "non_hdl_cholesterol", displayName: "Non-HDL cholesterol", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["non_hdl", "non_hdl_c", "non_hdl_cholesterol"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, allowedSpecimens: ["serum"], conversion: CHOLESTEROL_CONVERSION, binding: assessment("cardiovascular", "non_hdl_cholesterol", "core", { coversConfidence: true, readinessGroup: "atherogenic_cholesterol", contributionGroup: "atherogenic_cholesterol" }) }),
  reviewed({ key: "hdl_serum", analyteKey: "hdl", displayName: "HDL cholesterol", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["hdl", "hdl_c", "hdl_cholesterol"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, allowedSpecimens: ["serum"], conversion: CHOLESTEROL_CONVERSION, binding: assessment("cardiovascular", "hdl", "core", { coversConfidence: true, readinessGroup: "hdl", contributionGroup: "hdl" }) }),
  reviewed({ key: "triglycerides_serum", analyteKey: "triglycerides", displayName: "Triglycerides", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["triglycerides", "tg", "trig"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, allowedSpecimens: ["serum"], conversion: TRIGLYCERIDE_CONVERSION, binding: assessment("cardiovascular", "triglycerides", "core", { coversConfidence: true, readinessGroup: "triglycerides", contributionGroup: "triglycerides" }) }),
  reviewed({ key: "total_cholesterol_serum", analyteKey: "total_cholesterol", displayName: "Total cholesterol", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["total_cholesterol", "cholesterol_total", "tc", "chol"], "registry", "reviewed"), unitPolicy: LIPID_POLICY, allowedSpecimens: ["serum"], conversion: CHOLESTEROL_CONVERSION, binding: assessment("cardiovascular", "total_cholesterol", "extended", { contributionGroup: "total_cholesterol" }) }),

  // Thyroid
  reviewed({ key: "tsh_serum", analyteKey: "tsh", displayName: "Thyroid stimulating hormone", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["tsh", "thyroid_stimulating_hormone"], "registry", "reviewed"), unitPolicy: TSH_POLICY, allowedSpecimens: ["serum"], binding: assessment("thyroid", "tsh", "core", { coversConfidence: true, readinessGroup: "tsh", contributionGroup: "tsh" }) }),
  reviewed({ key: "free_t4_serum", analyteKey: "free_t4", displayName: "Free thyroxine", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["free_t4", "free_thyroxine", "ft4"], "registry", "reviewed"), unitPolicy: FREE_T4_POLICY, allowedSpecimens: ["serum"], binding: assessment("thyroid", "free_t4", "core", { coversConfidence: true, readinessGroup: "free_t4", contributionGroup: "free_t4" }) }),

  // Liver
  ...(["alt", "ast", "alp", "ggt"] as const).flatMap((analyteKey) => (["serum", "plasma"] as const).map((specimen) => reviewed({ key: `${analyteKey}_${specimen}_catalytic_activity`, analyteKey, displayName: `${analyteKey.toUpperCase()}, ${specimen} catalytic activity`, specimen, property: "catalytic_activity_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases([analyteKey, ...(analyteKey === "alt" ? ["alanine_aminotransferase", "ALT (alanine aminotransferase)"] : analyteKey === "ast" ? ["aspartate_aminotransferase", "AST (aspartate aminotransferase)"] : [])], "registry", "reviewed"), unitPolicy: ENZYME_POLICY, allowedSpecimens: [specimen], conversion: ENZYME_DISPLAY_ONLY, binding: assessment("liver", analyteKey, analyteKey === "ggt" ? "extended" : "core", { coversConfidence: analyteKey !== "ggt", ...(analyteKey !== "ggt" ? { readinessGroup: analyteKey } : {}), contributionGroup: analyteKey }) }))),
  reviewed({ key: "bilirubin_serum", analyteKey: "bilirubin", displayName: "Total bilirubin", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["bilirubin", "total_bilirubin"], "registry", "reviewed"), unitPolicy: BILIRUBIN_POLICY, allowedSpecimens: ["serum"], conversion: BILIRUBIN_CONVERSION, binding: assessment("liver", "bilirubin", "core", { coversConfidence: true, readinessGroup: "bilirubin", contributionGroup: "bilirubin" }) }),
  reviewed({ key: "albumin_serum", analyteKey: "albumin", displayName: "Albumin", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["albumin", "serum_albumin"], "registry", "reviewed"), unitPolicy: PROTEIN_POLICY, allowedSpecimens: ["serum"], conversion: PROTEIN_CONVERSION, binding: assessment("liver", "albumin", "core", { coversConfidence: true, readinessGroup: "albumin", contributionGroup: "albumin" }) }),

  // Kidney
  reviewed({ key: "egfr", analyteKey: "egfr", displayName: "Estimated glomerular filtration rate", specimen: "unspecified", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["egfr", "e_gfr", "estimated_gfr"], "registry", "reviewed"), unitPolicy: EGFR_POLICY, binding: assessment("kidney", "egfr", "core", { coversConfidence: true, readinessGroup: "filtration", contributionGroup: "filtration" }) }),
  reviewed({ key: "creatinine_serum", analyteKey: "creatinine", displayName: "Creatinine", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["creatinine", "serum_creatinine"], "registry", "reviewed"), unitPolicy: CREATININE_POLICY, allowedSpecimens: ["serum"], conversion: CREATININE_CONVERSION, binding: assessment("kidney", "creatinine", "core", { coversConfidence: true, readinessGroup: "filtration", contributionGroup: "filtration" }) }),
  reviewed({ key: "uacr_urine", analyteKey: "uacr", displayName: "Urine albumin to creatinine ratio", specimen: "urine", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["uacr", "urine_albumin_creatinine_ratio"], "registry", "reviewed"), unitPolicy: UACR_POLICY, allowedSpecimens: ["urine"], binding: assessment("kidney", "uacr", "core", { coversConfidence: true, readinessGroup: "albuminuria", contributionGroup: "albuminuria" }) }),
  reviewed({ key: "bun_serum", analyteKey: "bun", displayName: "Blood urea nitrogen", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["bun", "blood_urea_nitrogen"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["serum"], conversion: BUN_UREA_CONVERSION, binding: assessment("kidney", "bun", "extended", { contributionGroup: "nitrogen_waste" }) }),
  reviewed({ key: "urea_serum", analyteKey: "urea", displayName: "Urea", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["urea"], "registry", "reviewed"), unitPolicy: GLUCOSE_POLICY, allowedSpecimens: ["serum"], conversion: BUN_UREA_CONVERSION, binding: assessment("kidney", "urea", "extended", { contributionGroup: "nitrogen_waste" }) }),
  ...(["sodium", "potassium", "chloride", "bicarbonate", "calcium"] as const).map((analyteKey) => reviewed({ key: `${analyteKey}_serum`, analyteKey, displayName: analyteKey === "bicarbonate" ? "Bicarbonate" : analyteKey[0]!.toUpperCase() + analyteKey.slice(1), specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases([analyteKey, ...(analyteKey === "sodium" ? ["na"] : analyteKey === "potassium" ? ["k"] : analyteKey === "chloride" ? ["cl"] : analyteKey === "bicarbonate" ? ["co2", "carbon_dioxide"] : analyteKey === "calcium" ? ["ca"] : [])], "registry", "reviewed"), unitPolicy: ELECTROLYTE_POLICY, allowedSpecimens: ["serum"], binding: assessment("kidney", analyteKey, "extended", { contributionGroup: analyteKey === "bicarbonate" ? "acid_base" : analyteKey }) })),

  // Blood
  reviewed({ key: "hemoglobin_whole_blood", analyteKey: "hemoglobin", displayName: "Hemoglobin", specimen: "whole_blood", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["hemoglobin", "hgb", "hb"], "registry", "reviewed"), unitPolicy: PROTEIN_POLICY, allowedSpecimens: ["whole_blood"], conversion: PROTEIN_CONVERSION, binding: assessment("blood", "hemoglobin", "core", { coversConfidence: true, readinessGroup: "red_cell_mass", contributionGroup: "red_cell_mass" }) }),
  reviewed({ key: "hematocrit_whole_blood", analyteKey: "hematocrit", displayName: "Hematocrit", specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["hematocrit", "hct"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"], binding: assessment("blood", "hematocrit", "core", { coversConfidence: true, readinessGroup: "red_cell_mass", contributionGroup: "red_cell_mass" }) }),
  reviewed({ key: "rbc_whole_blood", analyteKey: "rbc", displayName: "Red blood cell count", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["rbc", "red_blood_cells"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"], binding: assessment("blood", "rbc", "extended", { contributionGroup: "red_cell_mass" }) }),
  reviewed({ key: "wbc_whole_blood", analyteKey: "wbc", displayName: "White blood cell count", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["wbc", "white_blood_cells"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"], binding: assessment("blood", "wbc", "core", { coversConfidence: true, readinessGroup: "white_cells", contributionGroup: "white_cells" }) }),
  reviewed({ key: "platelets_whole_blood", analyteKey: "platelets", displayName: "Platelet count", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["platelets", "plt"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"], binding: assessment("blood", "platelets", "core", { coversConfidence: true, readinessGroup: "platelets", contributionGroup: "platelets" }) }),
  reviewed({ key: "mcv_whole_blood", analyteKey: "mcv", displayName: "Mean corpuscular volume", specimen: "whole_blood", property: "distribution_width_sd", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["mcv", "mean_corpuscular_volume"], "registry", "reviewed"), unitPolicy: VOLUME_POLICY, allowedSpecimens: ["whole_blood"], binding: assessment("blood", "mcv", "core", { coversConfidence: true, readinessGroup: "red_cell_size", contributionGroup: "red_cell_size" }) }),
  reviewed({ key: "rdw_cv", analyteKey: "red_cell_distribution_width", displayName: "RDW-CV", specimen: "whole_blood", property: "distribution_width_cv", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["rdw", "rdw_cv", "rdw-cv"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"], binding: assessment("blood", "rdw", "extended", { contributionGroup: "red_cell_variation" }) }),
  reviewed({ key: "rdw_sd", analyteKey: "red_cell_distribution_width", displayName: "RDW-SD", specimen: "whole_blood", property: "distribution_width_sd", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["rdw", "rdw_sd", "rdw-sd"], "registry", "reviewed"), unitPolicy: VOLUME_POLICY, allowedSpecimens: ["whole_blood"], binding: assessment("blood", "rdw", "extended", { contributionGroup: "red_cell_variation" }) }),
  reviewed({ key: "neutrophils_percent", analyteKey: "neutrophils", displayName: "Neutrophils, percent", specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["neutrophils", "neutrophils_percent", "neu%", "neu_percent"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "neutrophils_abs", analyteKey: "neutrophils", displayName: "Neutrophils, absolute", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["neutrophils", "neutrophils_absolute", "neutrophils_abs", "absolute_neutrophil_count", "neu"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "lymphocytes_percent", analyteKey: "lymphocytes", displayName: "Lymphocytes, percent", specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["lymphocytes", "lymphocytes_percent", "lymf%", "lym_percent"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "lymphocytes_abs", analyteKey: "lymphocytes", displayName: "Lymphocytes, absolute", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["lymphocytes_absolute", "lymphocytes_abs", "absolute_lymphocyte_count", "lymf"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "reticulocytes_percent", analyteKey: "reticulocytes", displayName: "Reticulocytes, percent", specimen: "whole_blood", property: "percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["reticulocytes_percent", "retic_percent"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "reticulocytes_abs", analyteKey: "reticulocytes", displayName: "Reticulocytes, absolute", specimen: "whole_blood", property: "cell_count", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["reticulocytes_abs", "absolute_reticulocyte_count"], "registry", "reviewed"), unitPolicy: CELL_POLICY, allowedSpecimens: ["whole_blood"] }),
  reviewed({ key: "band_neutrophils_percent", analyteKey: "neutrophils", displayName: "Band neutrophils, percent", specimen: "whole_blood", property: "band_percentage", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["band_neutrophils", "band_neutrophils_percent"], "registry", "reviewed"), unitPolicy: PERCENT_POLICY, allowedSpecimens: ["whole_blood"] }),

  // Nutrients and inflammation
  reviewed({ key: "vitamin_d_serum", analyteKey: "vitamin_d", displayName: "25-hydroxy vitamin D", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["vitamin_d", "25_oh_vitamin_d", "25_oh_d"], "registry", "reviewed"), unitPolicy: VITAMIN_D_POLICY, allowedSpecimens: ["serum"], conversion: VITAMIN_D_CONVERSION, binding: assessment("nutrients", "vitamin_d", "core", { coversConfidence: true, readinessGroup: "vitamin_d", contributionGroup: "vitamin_d" }) }),
  reviewed({ key: "b12_serum", analyteKey: "b12", displayName: "Vitamin B12", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["b12", "vitamin_b12", "cobalamin"], "registry", "reviewed"), unitPolicy: B12_POLICY, allowedSpecimens: ["serum"], binding: assessment("nutrients", "b12", "core", { coversConfidence: true, readinessGroup: "b12", contributionGroup: "b12" }) }),
  reviewed({ key: "folate_serum", analyteKey: "folate", displayName: "Folate", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["folate", "folic_acid"], "registry", "reviewed"), unitPolicy: B12_POLICY, allowedSpecimens: ["serum"], binding: assessment("nutrients", "folate", "core", { coversConfidence: true, readinessGroup: "folate", contributionGroup: "folate" }) }),
  reviewed({ key: "crp_serum", analyteKey: "crp", displayName: "C-reactive protein", specimen: "serum", property: "substance_concentration", scale: "quantitative", timing: "point_in_time", method: "automated", valueKind: "numeric", aliases: aliases(["crp", "c_reactive_protein"], "registry", "reviewed"), unitPolicy: { dimensions: ["mass_concentration"], acceptedUnits: ["mg/l"], canonicalUnit: "mg/l", conversionPolicyRef: null, missingUnitPolicy: "ambiguous" }, allowedSpecimens: ["serum"], binding: assessment("inflammation", "crp", "display", { coversConfidence: true }) }),
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

const SAMPLE_FIXTURE_DEFINITIONS: readonly MeasurementDefinition[] = SAMPLE_FIXTURES.map(([key, label, valueKind]) => ({
  key: `sample_${key}`,
  analyteKey: key,
  displayName: label,
  maturity: "provisional",
  sourceProvenance: { kind: "sample_fixture", sourceRecordKey: "sample_newest.pdf" },
  specimen: "unspecified",
  property: "unspecified",
  scale: valueKind === "qualitative" ? "nominal" : "quantitative",
  timing: "unspecified",
  method: "unspecified",
  valueKind,
  aliases: aliases([label, key], "fixture", "provisional", ["sample_newest.pdf"]),
  unitPolicy: DISPLAY_POLICY,
  conversion: null,
  assessmentBindings: [],
}));

/** Only reviewed Registry 2.0 definitions are eligible for concrete runtime behavior. */
export const CURATED_MEASUREMENT_DEFINITIONS = REVIEWED_DEFINITIONS;
export const MEASUREMENT_DEFINITIONS: readonly MeasurementDefinition[] = [...REVIEWED_DEFINITIONS, ...SAMPLE_FIXTURE_DEFINITIONS];

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

export function getAnalyte(key: string): Analyte | undefined {
  return ANALYTE_BY_KEY.get(key);
}

export function getMeasurementIdentity(definition: MeasurementDefinition) {
  return [definition.analyteKey, definition.specimen, definition.property, definition.scale, definition.timing, definition.method, definition.valueKind] as const;
}

export function getMeasurementDefinitionsForAnalyte(analyteKey: string): readonly MeasurementDefinition[] {
  return MEASUREMENT_DEFINITIONS.filter((definition) => definition.analyteKey === analyteKey);
}

/** Returns conversion metadata only for a reviewed, concrete Registry 2.0 definition key. */
export function getMeasurementConversionPolicy(key: string): ConversionRule | null {
  const definition = getMeasurementDefinition(key);
  return definition?.maturity === "reviewed" ? definition.conversion ?? null : null;
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

function evidence(code: ResolutionReasonCode, source: ResolutionEvidence["source"], strength: ResolutionEvidence["strength"], observed?: string, expected?: readonly string[]): ResolutionEvidence {
  return { code, source, strength, ...(observed ? { observed } : {}), ...(expected ? { expected } : {}) };
}

function matches(definition: MeasurementDefinition, label: string) {
  return definition.key === label || definition.aliases.some((alias) => alias.normalizedValue === label);
}

function normalizedSpecimen(value: string | null | undefined) {
  const normalized = snakeCaseToken(value ?? "");
  return ["serum", "plasma", "whole_blood", "urine"].includes(normalized) ? normalized : "unspecified";
}

function candidateEvidence(definition: MeasurementDefinition, input: MeasurementResolutionInput, label: string, unit: NormalizedMeasurementUnit): CandidateEvidence {
  const accepted: ResolutionEvidence[] = [evidence(definition.key === label ? "definition_key_match" : "alias_normalized_match", "label", "strong", definition.displayName)];
  const rejected: ResolutionEvidence[] = [];
  const missingAxes: Array<"specimen" | "modifier" | "timing" | "method" | "value_kind"> = [];
  if (unit.normalizedUnit && definition.unitPolicy.dimensions.length) {
    if (!unit.dimension || !definition.unitPolicy.dimensions.includes(unit.dimension)) rejected.push(evidence("unit_dimension_conflict", "unit", "hard", unit.normalizedUnit, definition.unitPolicy.dimensions));
    else if (!definition.unitPolicy.acceptedUnits.includes(unit.normalizedUnit)) rejected.push(evidence("unit_not_accepted", "unit", "hard", unit.normalizedUnit, definition.unitPolicy.acceptedUnits));
    else accepted.push(evidence("unit_compatible", "unit", "strong", unit.normalizedUnit));
  } else if (!unit.normalizedUnit) {
    accepted.push(evidence("unit_missing", "unit", "weak"));
  }
  const specimen = normalizedSpecimen(input.specimen);
  if (definition.specimen !== "unspecified") {
    if (specimen === "unspecified") {
      missingAxes.push("specimen");
      accepted.push(evidence("specimen_missing", "specimen", "weak"));
    } else if (specimen !== definition.specimen) {
      rejected.push(evidence("specimen_conflict", "specimen", "hard", specimen, [definition.specimen]));
    } else {
      accepted.push(evidence("specimen_compatible", "specimen", "strong", specimen));
    }
  }
  if (definition.requiredModifiers?.length) {
    const modifier = snakeCaseToken(input.modifier ?? "");
    if (!modifier) {
      missingAxes.push("modifier");
      accepted.push(evidence("modifier_missing", "modifier", "weak"));
    } else if (!definition.requiredModifiers.includes(modifier)) {
      rejected.push(evidence("modifier_conflict", "modifier", "hard", modifier, definition.requiredModifiers));
    } else {
      accepted.push(evidence("modifier_compatible", "modifier", "strong", modifier));
    }
  }
  if (definition.valueKind !== "unspecified" && input.valueKind && input.valueKind !== definition.valueKind) missingAxes.push("value_kind");
  const score = rejected.length ? null : accepted.reduce((sum, item) => sum + (item.strength === "strong" ? 2 : 1), 0);
  return { candidateKey: definition.key, accepted, rejected, missingAxes, score };
}

/** Resolve raw evidence against reviewed Registry 2.0 definitions only. */
export function resolveMeasurementDefinition(input: MeasurementResolutionInput): MeasurementResolution {
  const label = snakeCaseToken(input.rawLabel);
  const proposed = snakeCaseToken(input.proposedKey ?? "");
  const matched = MEASUREMENT_DEFINITIONS.filter((definition) => matches(definition, label) || (!label && proposed && matches(definition, proposed)));
  const unit = normalizeMeasurementUnit(input.rawUnit);
  const evidenceByCandidate = matched.map((definition) => candidateEvidence(definition, input, label || proposed, unit));
  const compatible = evidenceByCandidate.filter((candidate) => candidate.rejected.length === 0);
  const concrete = compatible.filter((candidate) => {
    const definition = getMeasurementDefinition(candidate.candidateKey)!;
    return definition.maturity === "reviewed" && definition.sourceProvenance.kind === "registry_v2_review" && candidate.missingAxes.length === 0;
  });
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
  const reviewedIdentities = new Map<string, string>();
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
    if (definition.unitPolicy.dimensions.length && !definition.unitPolicy.acceptedUnits.length) errors.push(`Unit policy has dimensions but no units: ${definition.key}`);
  }
  if (!definitions.some((definition) => definition.maturity === "reviewed")) warnings.push("No reviewed Registry 2.0 definitions are available");
  return { valid: errors.length === 0, errors, warnings };
}
