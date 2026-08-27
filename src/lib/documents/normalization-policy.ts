import {
  getMeasurementDefinition,
  resolveMeasurementDefinition,
  type MeasurementResolution,
  type MeasurementResolutionInput,
} from "@/lib/biomarkers";
import { MEASUREMENT_CATALOG_MANIFEST_RELEASE } from "@/lib/biomarkers/measurement-registry-release";
import type { MappingChangeClassification } from "@/lib/biomarkers";
import type { RecordStatus } from "./observation-verification-workflow";

export type PromotionDecision =
  | { allowed: true; reason: "approved" }
  | { allowed: false; reason: string };

export function compatibleManualDefinitions(input: MeasurementResolutionInput) {
  const resolution = resolveMeasurementDefinition(input);
  return resolution.candidateEvidence
    .filter(
      (candidate) =>
        candidate.selectable &&
        candidate.rejected.length === 0 &&
        candidate.missingAxes.length === 0
    )
    .map((candidate) => getMeasurementDefinition(candidate.candidateKey))
    .filter((definition): definition is NonNullable<typeof definition> => definition?.maturity === "reviewed");
}

/**
 * Automatic verification is disabled unless deployment configuration binds the
 * approved release gate to the exact catalog manifest being executed.
 * A missing or mismatched digest is a hard deny, never a user-verification
 * fallback.
 */
export function isAutomaticVerificationReleaseApproved(): boolean {
  const configuredDigest = process.env.EH120_AUTOMATIC_VERIFICATION_RELEASE_DIGEST
    ?.trim()
    .toLowerCase();
  return configuredDigest === MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest;
}

export function acceptancePathForResolution(
  resolution: Pick<MeasurementResolution, "result" | "measurementDefinitionKey">
): "resolved" | "raw" {
  return resolution.result === "resolved" && resolution.measurementDefinitionKey ? "resolved" : "raw";
}

export function decideAutomaticPromotion(options: {
  resolution: MeasurementResolution;
  activeRevision?: {
    verification_status: "pending" | "auto_verified" | "user_verified" | "manually_corrected";
    measurement_override?: Record<string, unknown> | null;
    reversal_of_revision_id?: string | null;
  } | null;
  recordStatus?: RecordStatus;
  sourceIsCurrent?: boolean;
  mappingClassification: MappingChangeClassification;
  qualityGateApproved: boolean;
}): PromotionDecision {
  if (options.recordStatus !== undefined && options.recordStatus !== "active") {
    return { allowed: false, reason: "record_not_active" };
  }
  if (options.sourceIsCurrent === false) {
    return { allowed: false, reason: "source_not_current" };
  }
  if (!options.qualityGateApproved) return { allowed: false, reason: "quality_gate_not_approved" };
  if (options.resolution.result !== "resolved") return { allowed: false, reason: "resolver_not_resolved" };
  if (options.mappingClassification !== "compatibility_preserving") {
    return { allowed: false, reason: "mapping_requires_review" };
  }
  if (options.activeRevision?.measurement_override) {
    return { allowed: false, reason: "manual_correction_protected" };
  }
  if (
    options.activeRevision &&
    (options.activeRevision.verification_status === "user_verified" ||
      options.activeRevision.verification_status === "manually_corrected" ||
      options.activeRevision.reversal_of_revision_id)
  ) {
    return { allowed: false, reason: "manual_decision_protected" };
  }
  const selected = options.resolution.candidateEvidence.find(
    (candidate) => candidate.candidateKey === options.resolution.measurementDefinitionKey
  );
  if (
    !selected ||
    !selected.selectable ||
    selected.rejected.length > 0 ||
    selected.missingAxes.length > 0
  ) {
    return { allowed: false, reason: "hard_conflict_or_missing_axis" };
  }
  return { allowed: true, reason: "approved" };
}
