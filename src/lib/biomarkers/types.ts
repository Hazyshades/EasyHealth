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
