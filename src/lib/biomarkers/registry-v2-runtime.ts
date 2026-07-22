import {
  getReviewedAssessmentBinding,
  getReviewedScoreContributionGroups,
  getReviewedScoreReadinessGroups,
  listReviewedCoverageKeys,
} from "./measurement-resolution";
import type {
  BodySystemId,
  NamedBodySystemId,
  ScoreContributionGroup,
  ScoreRequiredGroup,
  ScoreRole,
  SystemScoreability,
} from "./types";

/** Registry 2.0-owned runtime boundary for reviewed laboratory assessment data. */
export const NAMED_BODY_SYSTEMS: readonly NamedBodySystemId[] = [
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

export const NON_SCOREABLE_SYSTEMS = new Set<NamedBodySystemId>(["inflammation"]);

export const SCOREABILITY_BY_SYSTEM: Record<NamedBodySystemId, SystemScoreability> = {
  cardiovascular: "incomplete",
  metabolic: "incomplete",
  thyroid: "incomplete",
  liver: "incomplete",
  kidney: "incomplete",
  blood: "incomplete",
  nutrients: "incomplete",
  inflammation: "non_scoreable",
};

export function getRegistryV2System(key: string | null | undefined): BodySystemId {
  return getReviewedAssessmentBinding(key)?.binding.system ?? "general";
}

export function getRegistryV2ScoreRole(key: string | null | undefined): ScoreRole {
  return getReviewedAssessmentBinding(key)?.binding.scoreRole ?? "display";
}

export function getRegistryV2ExpectedSpecimen(key: string | null | undefined): string | null {
  const specimen = getReviewedAssessmentBinding(key)?.definition.specimen;
  return specimen && specimen !== "unspecified" ? specimen : null;
}

export function listRegistryV2CoverageKeys(system: BodySystemId): readonly string[] {
  return listReviewedCoverageKeys(system);
}

export function getRegistryV2ScoreReadinessGroups(system: BodySystemId): readonly ScoreRequiredGroup[] {
  return getReviewedScoreReadinessGroups(system);
}

export function getRegistryV2ScoreContributionGroups(system: BodySystemId): readonly ScoreContributionGroup[] {
  return getReviewedScoreContributionGroups(system);
}
