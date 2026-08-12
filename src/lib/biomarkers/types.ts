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

export type VerificationStatus =
  | "pending"
  | "auto_verified"
  | "user_verified"
  | "manually_corrected";

export type VerificationActorType = "system" | "user";

export type AssessmentCompatibility = "compatible" | "display_only" | "incompatible";

export type AnalyteKey = string;
export type MeasurementDefinitionKey = string;
export type NormalizedUnitKey = string;
export type MeasurementMaturity = "provisional" | "reviewed" | "retired";
/** Provenance for Registry 2.0 definition data used by the runtime resolver. */
export type RegistrySourceKind = "registry_v2_review" | "sample_fixture";
export type AnalyteStatus = "active" | "deprecated";
export type SpecimenKey = "serum" | "plasma" | "whole_blood" | "urine" | "unspecified";
export type MeasurementPropertyKey = "cell_count" | "percentage" | "segmented_percentage" | "band_percentage" | "distribution_width_cv" | "distribution_width_sd" | "mean_cell_volume" | "mass_per_cell" | "substance_concentration" | "catalytic_activity_concentration" | "presence" | "unspecified";
export type MeasurementScaleKey = "quantitative" | "ordinal" | "nominal" | "unspecified";
export type MeasurementTimingKey = "point_in_time" | "fasting" | "post_prandial" | "unspecified";
export type MeasurementMethodKey = "automated" | "manual" | "dipstick" | "unspecified";
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
  | "mass_per_cell"
  | "mass_concentration"
  | "molar_concentration"
  | "catalytic_activity_concentration"
  | "arbitrary";

/** @deprecated Use `UnitDimension`; retained for registry call-site compatibility. */
export type UnitToken = UnitDimension | "unknown";

export type MissingUnitPolicy = "reject" | "ambiguous" | "display_only";
export type ClinicalCompatibilityAxis =
  | "unit"
  | "specimen"
  | "modifier"
  | "timing"
  | "method"
  | "value_kind";
export type CompatibilityDisposition = "compatible" | "missing" | "conflict";

export type AliasSource = "canonical" | "registry" | "laboratory" | "fixture";
export type AliasMatchType =
  | "exact"
  | "normalized"
  | "ocr_variant"
  | "bounded_fuzzy"
  /** #105: order-insensitive projection derived from an exact/normalized alias. */
  | "token_set";
export type AliasMatchAuthority = "recognition_only" | "reviewed_resolution";
export type AliasApprovalStatus = "reviewed" | "provisional";
export type AliasLifecycle = "active" | "deprecated";

export type AliasDefinition = {
  key: string;
  measurementDefinitionKey: MeasurementDefinitionKey;
  value: string;
  normalizedValue: string;
  source: AliasSource;
  matchType: AliasMatchType;
  matchAuthority: AliasMatchAuthority;
  approvalStatus: AliasApprovalStatus;
  lifecycle: AliasLifecycle;
  provenance: MeasurementSourceProvenance;
  reviewReference?: string;
  maxNormalizedEditDistance?: 1 | 2;
  locale?: string;
  laboratory?: string;
  fixtureRefs?: readonly string[];
};

export type MatchedAlias = Pick<
  AliasDefinition,
  | "key"
  | "measurementDefinitionKey"
  | "matchType"
  | "matchAuthority"
  | "approvalStatus"
  | "lifecycle"
  | "provenance"
  | "locale"
  | "laboratory"
> & {
  value: string;
  normalizedValue: string;
  /** True when the accent-folded Spanish form admitted this alias. */
  foldFallback?: boolean;
};

export type AssessmentBinding = {
  assessmentInputKey: string;
  compatibility: AssessmentCompatibility;
  status: "reviewed" | "provisional";
  /** Registry 2.0-owned assessment metadata. Present on every reviewed binding. */
  system?: BodySystemId;
  scoreRole?: ScoreRole;
  coversConfidence?: boolean;
  /** Alternatives that satisfy the same readiness requirement share this id. */
  readinessGroup?: string;
  /** At most one usable marker in a contribution group affects a state score. */
  contributionGroup?: string;
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
  | "value_kind"
  | "modifier"
  | "method"
  | "value_kind"
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
  | "alias_bounded_fuzzy_match"
  | "alias_token_set_match"
  | "proposed_key_match"
  | "unit_compatible"
  | "unit_not_required"
  | "unit_dimension_conflict"
  | "unit_not_accepted"
  | "unit_unsupported"
  | "unit_missing"
  | "specimen_compatible"
  | "specimen_conflict"
  | "specimen_unsupported"
  | "modifier_compatible"
  | "modifier_conflict"
  | "method_compatible"
  | "method_conflict"
  | "method_missing"
  | "value_kind_compatible"
  | "value_kind_conflict"
  | "value_kind_missing"
  | "section_support"
  | "neighbour_support"
  | "reference_shape_support"
  | "specimen_missing"
  | "modifier_missing"
  | "manual_selection"
  | "value_kind_compatible"
  | "value_kind_conflict"
  | "value_kind_missing"
  | "timing_compatible"
  | "timing_conflict"
  | "timing_missing"
  | "method_compatible"
  | "method_conflict"
  | "method_missing"
  | "candidate_not_selected";

export type ResolutionEvidence = {
  code: ResolutionReasonCode;
  source: ResolutionEvidenceSource;
  strength: ResolutionEvidenceStrength;
  score: number;
  observed?: string;
  expected?: readonly string[];
};
export type CompatibilityEvidenceResult = {
  disposition: CompatibilityDisposition;
  evidence: ResolutionEvidence;
  missingAxis?: ClinicalCompatibilityAxis;
  selectable: boolean;
};

export type ResolutionMissingAxis = "unit" | "specimen" | "modifier" | "timing" | "method" | "value_kind";

/**
 * #114: why a recognized candidate was excluded from concrete resolution.
 *
 * These are properties of the catalog entry and of the alias that matched it,
 * not evidence about the measurement, so they are kept out of `rejected` and
 * out of `conflicts` — a provisional definition is not a conflict with the
 * document. Without them the exclusion is a bare boolean and the product cannot
 * tell a reviewer whether the outstanding work is theirs or ours.
 */
export type AdmissibilityRejectionCode =
  | "definition_not_reviewed"
  | "definition_provenance_unverified"
  | "alias_authority_insufficient"
  | "alias_not_approved"
  | "required_axis_missing"
  | "score_below_floor";

/**
 * #114: the single reason presented for a row that did not resolve, in
 * precedence order. A conflict outranks a missing axis, and a missing axis
 * outranks maturity: naming an axis stays actionable even after the definition
 * is reviewed, so it is never hidden behind a reason the reviewer cannot act on.
 */
export type IncompleteReasonClass =
  | "unit_or_value_conflict"
  | "axis_not_stated"
  | "definition_not_reviewed"
  | "no_candidate";

export type CandidateEvidence = {
  candidateKey: MeasurementDefinitionKey;
  matchedAlias: MatchedAlias;
  accepted: readonly ResolutionEvidence[];
  missing: readonly ResolutionEvidence[];
  rejected: readonly ResolutionEvidence[];
  missingAxes: readonly ClinicalCompatibilityAxis[];
  score: number | null;
  selectable: boolean;
  eligible: boolean;
  /**
   * #114: every admissibility condition this candidate failed. Empty when the
   * candidate is admissible. Kept separate from `rejected` so that `conflicts`
   * keeps meaning "the document and the definition disagree".
   */
  admissibilityRejections: readonly AdmissibilityRejectionCode[];
};

export type ResolverDecisionTrace = {
  version: 2;
  compatibilityPolicyVersion: string;
  selectedCandidateKey: MeasurementDefinitionKey | null;
  runnerUpCandidateKey: MeasurementDefinitionKey | null;
  outcome: ResolverResult;
  confidence: number;
  candidates: readonly CandidateEvidence[];
};
/**
 * Persisted trace schema versions.
 *
 * `"1"` is frozen: every trace already stored against a patient revision was
 * written under it and must keep validating without backfill. `"2"` adds the
 * alias evidence that explains which alias admitted the winning candidate.
 */
export type ResolverTraceSchemaVersion = "1" | "2";

export type ResolverDecisionKind =
  | "single_reviewed_candidate"
  | "multiple_reviewed_candidates"
  | "recognized_incomplete"
  | "no_matching_candidate"
  | "manual_selection";

export type PersistedResolverDecisionTraceEvidence = Pick<
  ResolutionEvidence,
  "code" | "strength"
>;

export type PersistedResolverDecisionTraceCandidateBase = {
  candidateKey: MeasurementDefinitionKey;
  maturity: MeasurementMaturity;
  score: number | null;
  accepted: readonly PersistedResolverDecisionTraceEvidence[];
  rejected: readonly PersistedResolverDecisionTraceEvidence[];
  missingAxes: readonly ClinicalCompatibilityAxis[];
  conflicts: readonly ResolutionReasonCode[];
};

/**
 * Schema-2 alias evidence. Catalog-derived only: `aliasKey` resolves to the
 * literal through the release manifest, so no source text enters the trace.
 */
export type PersistedResolverDecisionTraceAliasEvidence = {
  aliasKey: string;
  aliasMatchType: AliasMatchType;
  aliasLocale: string;
  aliasLaboratory: string | null;
  aliasFoldFallback: boolean;
};

export type PersistedResolverDecisionTraceCandidateV1 =
  PersistedResolverDecisionTraceCandidateBase;

export type PersistedResolverDecisionTraceCandidateV2 =
  PersistedResolverDecisionTraceCandidateBase &
    PersistedResolverDecisionTraceAliasEvidence;

export type PersistedResolverDecisionTraceCandidate =
  | PersistedResolverDecisionTraceCandidateV1
  | PersistedResolverDecisionTraceCandidateV2;

type PersistedResolverDecisionTraceCommon = {
  outcome: ResolverResult;
  decisionKind: ResolverDecisionKind;
  inputEvidenceHash: string;
  catalogManifestVersion: string;
  catalogManifestDigest: string;
  resolverVersion: string;
  winningCandidateKey: MeasurementDefinitionKey | null;
  missingAxes: readonly ClinicalCompatibilityAxis[];
  conflicts: readonly ResolutionReasonCode[];
};

export type PersistedResolverDecisionTraceV1 = PersistedResolverDecisionTraceCommon & {
  schemaVersion: "1";
  candidates: readonly PersistedResolverDecisionTraceCandidateV1[];
};

export type PersistedResolverDecisionTraceV2 = PersistedResolverDecisionTraceCommon & {
  schemaVersion: "2";
  candidates: readonly PersistedResolverDecisionTraceCandidateV2[];
};

export type PersistedResolverDecisionTrace =
  | PersistedResolverDecisionTraceV1
  | PersistedResolverDecisionTraceV2;

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
  aliases: readonly AliasDefinition[];
  unitPolicy: MeasurementUnitPolicy;
  /** Display-only conversion rule reviewed with this concrete definition. */
  conversion?: ConversionRule | null;
  requiredModifiers?: string[];
  requiredMethods?: MeasurementMethodKey[];
  assessmentBindings: readonly AssessmentBinding[];
};

export type MeasurementResolutionInput = {
  rawLabel: string;
  rawUnit?: string | null;
  rawValueText?: string | null;
  specimen?: string | null;
  modifier?: string | null;
  section?: string | null;
  neighbourLabels?: string[];
  referenceLow?: number | null;
  referenceHigh?: number | null;
  extractionConfidence?: number | null;
  valueKind?: MeasurementValueKind | null;
  proposedKey?: string | null;
  timing?: MeasurementTimingKey | null;
  method?: string | null;
  laboratory?: string | null;
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
  missingAxes: readonly ClinicalCompatibilityAxis[];
  conflicts: readonly ResolutionReasonCode[];
  candidateEvidence: readonly CandidateEvidence[];
  reasons: readonly ResolutionReasonCode[];
  decisionTrace: ResolverDecisionTrace;
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
export type ResolvedReviewedMeasurementBinding = Readonly<{
  measurementDefinitionKey: MeasurementDefinitionKey;
  analyteKey: AnalyteKey;
  conversion: ConversionRule;
}>;

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
