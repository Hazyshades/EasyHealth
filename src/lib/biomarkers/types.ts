export type BodySystemId =
  | "cardiovascular"
  | "metabolic"
  | "thyroid"
  | "liver"
  | "kidney"
  | "blood"
  | "nutrients"
  | "inflammation"
  | "general";

/** Legacy id used before vitamins → nutrients rename. */
export type LegacyBodySystemId = "vitamins";

export type ScoreRole = "core" | "extended" | "display";

export type ResolverResult = "resolved" | "ambiguous" | "partial" | "unmapped";

export type VerificationStatus = "pending" | "user_verified" | "manually_corrected";

export type AssessmentCompatibility = "compatible" | "display_only" | "incompatible";

export type AnalyteKey = string;
export type MeasurementDefinitionKey = string;
export type NormalizedUnitKey = string;
export type MeasurementMaturity = "provisional" | "reviewed" | "retired";
export type RegistrySourceKind = "registry_v1_migration" | "launch_catalog" | "sample_fixture";
export type AnalyteStatus = "active" | "deprecated";
export type SpecimenKey = "serum" | "plasma" | "whole_blood" | "urine" | "unspecified";
export type MeasurementPropertyKey = "cell_count" | "percentage" | "segmented_percentage" | "band_percentage" | "distribution_width_cv" | "distribution_width_sd" | "substance_concentration" | "catalytic_activity_concentration" | "presence" | "unspecified";
export type MeasurementScaleKey = "quantitative" | "ordinal" | "nominal" | "unspecified";
export type MeasurementTimingKey = "point_in_time" | "fasting" | "unspecified";
export type MeasurementMethodKey = "automated" | "dipstick" | "unspecified";
export type MeasurementValueKind = "numeric" | "qualitative" | "ordinal" | "unspecified";

export type Analyte = { key: AnalyteKey; displayName: string; aliases: readonly string[]; status: AnalyteStatus };
export type MeasurementIdentity = {
  analyteKey: AnalyteKey;
  specimen: SpecimenKey;
  property: MeasurementPropertyKey;
  scale: MeasurementScaleKey;
  timing: MeasurementTimingKey;
  method: MeasurementMethodKey;
  valueKind: MeasurementValueKind;
};

export type UnitDimension =
  | "ratio"
  | "cell_concentration"
  | "volume"
  | "mass_concentration"
  | "molar_concentration"
  | "catalytic_activity_concentration"
  | "arbitrary";

/** @deprecated Use `UnitDimension`; retained for registry call-site compatibility. */
export type UnitToken = UnitDimension | "unknown";

export type MissingUnitPolicy = "reject" | "ambiguous" | "display_only";

export type MeasurementAlias = {
  value: string;
  normalizedValue: string;
  source: "canonical" | "registry" | "laboratory" | "fixture";
  matchType: "exact" | "normalized" | "ocr_variant";
  locale?: string;
  laboratory?: string;
  approvalStatus?: "reviewed" | "provisional";
  fixtureRefs?: readonly string[];
};

export type AssessmentBinding = {
  assessmentInputKey: string;
  compatibility: AssessmentCompatibility;
  status: "reviewed" | "provisional";
};

export type MeasurementSourceProvenance = {
  kind: RegistrySourceKind;
  sourceRecordKey: string;
};

export type MeasurementUnitPolicy = {
  dimensions: readonly UnitDimension[];
  acceptedUnits: readonly NormalizedUnitKey[];
  canonicalUnit: NormalizedUnitKey | null;
  conversionPolicyRef: string | null;
  missingUnitPolicy: MissingUnitPolicy;
};

export type NormalizedMeasurementUnit = {
  raw: string;
  normalizedUnit: NormalizedUnitKey | null;
  dimension: UnitDimension | null;
};

export type ResolutionEvidenceSource =
  | "label"
  | "unit"
  | "specimen"
  | "modifier"
  | "section"
  | "neighbour"
  | "reference"
  | "manual";

export type ResolutionEvidenceStrength = "hard" | "strong" | "weak";

export type ResolutionReasonCode =
  | "definition_key_match"
  | "alias_exact_match"
  | "alias_normalized_match"
  | "alias_ocr_variant_match"
  | "proposed_key_match"
  | "unit_compatible"
  | "unit_dimension_conflict"
  | "unit_not_accepted"
  | "unit_missing"
  | "specimen_compatible"
  | "specimen_conflict"
  | "modifier_compatible"
  | "modifier_conflict"
  | "section_support"
  | "neighbour_support"
  | "reference_shape_support"
  | "specimen_missing"
  | "modifier_missing"
  | "manual_selection"
  | "candidate_not_selected";

export type ResolutionEvidence = {
  code: ResolutionReasonCode;
  source: ResolutionEvidenceSource;
  strength: ResolutionEvidenceStrength;
  observed?: string;
  expected?: readonly string[];
};

export type CandidateEvidence = {
  candidateKey: MeasurementDefinitionKey;
  accepted: readonly ResolutionEvidence[];
  rejected: readonly ResolutionEvidence[];
  missingAxes: readonly ("specimen" | "modifier" | "timing" | "method" | "value_kind")[];
  score: number | null;
};

export type MappingConfidenceBand = "high" | "medium" | "low";

export type MeasurementDefinition = {
  key: MeasurementDefinitionKey;
  analyteKey: AnalyteKey;
  maturity: MeasurementMaturity;
  sourceProvenance: MeasurementSourceProvenance;
  specimen: SpecimenKey;
  property: MeasurementPropertyKey;
  scale: MeasurementScaleKey;
  timing: MeasurementTimingKey;
  method: MeasurementMethodKey;
  valueKind: MeasurementValueKind;
  displayName: string;
  aliases: readonly MeasurementAlias[];
  unitPolicy: MeasurementUnitPolicy;
  allowedSpecimens?: string[];
  requiredModifiers?: string[];
  assessmentBindings: readonly AssessmentBinding[];
};

export type LaunchCatalogMigrationRecord = {
  key: string;
  analyteKey: string;
  displayName: string;
  aliases: readonly string[];
  specimen: SpecimenKey;
  system: BodySystemId;
  scoreRole: ScoreRole;
  conversion: ConversionRule | null;
  sourceRecordKey: string;
};

export type MeasurementResolutionInput = {
  rawLabel: string;
  rawUnit?: string | null;
  specimen?: string | null;
  modifier?: string | null;
  section?: string | null;
  neighbourLabels?: string[];
  referenceLow?: number | null;
  referenceHigh?: number | null;
  extractionConfidence?: number | null;
  valueKind?: MeasurementValueKind | null;
  proposedKey?: string | null;
};

export type MeasurementResolution = {
  result: ResolverResult;
  measurementDefinitionKey: string | null;
  analyteKey: string | null;
  mappingConfidence: number;
  mappingConfidenceBand: MappingConfidenceBand;
  unit: NormalizedMeasurementUnit;
  /** @deprecated Use `unit.dimension`; retained for callers built on Registry 2.0 draft types. */
  unitToken: UnitToken;
  candidateKeys: string[];
  missingAxes: readonly ("specimen" | "modifier" | "timing" | "method" | "value_kind")[];
  conflicts: readonly ResolutionReasonCode[];
  candidateEvidence: readonly CandidateEvidence[];
  reasons: readonly ResolutionReasonCode[];
};

export type NamedBodySystemId = Exclude<BodySystemId, "general">;

/** Alternative biomarker keys that satisfy one score-readiness condition. */
export type ScoreRequiredGroup = readonly string[];

/** A deterministic score axis. At most one usable marker contributes per group. */
export type ScoreContributionGroup = {
  id: string;
  keys: readonly string[];
};

export type SystemScoreability = "scoreable" | "incomplete" | "non_scoreable" | "supporting_only";

export type LabUnitSystem = "us" | "si";

export type ConversionRule =
  | {
      type: "linear";
      conventionalUnit: string;
      siUnit: string;
      /** Multiply conventional → SI */
      factorCo: number;
      /** Multiply SI → conventional */
      factorSi: number;
    }
  | {
      type: "equal";
      conventionalUnit: string;
      siUnit: string;
    }
  | {
      type: "formula";
      formula: "hba1c_ngsp_ifcc" | "bun_urea";
      conventionalUnit: string;
      siUnit: string;
    }
  | {
      type: "none";
      reason: string;
    };

export type BiomarkerDefinition = {
  key: string;
  displayName: string;
  system: BodySystemId;
  scoreRole: ScoreRole;
  /** Counts toward system data-confidence coverage denominator when true. */
  coversConfidence: boolean;
  aliases: string[];
  specimen?: "serum" | "plasma" | "whole_blood" | "urine" | "any";
  tags?: string[];
  conversion?: ConversionRule;
  equivalenceGroup?: string;
  derived?: boolean;
};

export type PresentedObservation = {
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  converted: boolean;
  original_value: number;
  original_unit: string;
  original_ref_low: number | null;
  original_ref_high: number | null;
  conversion_note: string | null;
};
