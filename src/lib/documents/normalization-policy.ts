import { getMeasurementDefinition, resolveMeasurementDefinition } from "@/lib/biomarkers";
import type { MeasurementResolution, MeasurementResolutionInput } from "@/lib/biomarkers";
import type { MappingChangeClassification } from "@/lib/biomarkers";

export type RegistryResolutionMode = "off" | "shadow" | "promote";

export type PromotionDecision =
  | { allowed: true; reason: "approved" }
  | { allowed: false; reason: string };

export function measurementResolutionMode(): RegistryResolutionMode {
  const value = process.env.EASYHEALTH_MEASUREMENT_RESOLUTION_MODE?.toLowerCase();
  if (value === "shadow" || value === "promote") return value;
  return "off";
}

export function compatibleManualDefinitions(input: MeasurementResolutionInput) {
  const resolution = resolveMeasurementDefinition(input);
  return resolution.candidateEvidence
    .filter((candidate) => candidate.rejected.length === 0)
    .map((candidate) => getMeasurementDefinition(candidate.candidateKey))
    .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition));
}

export function decideAutomaticPromotion(options: {
  resolution: MeasurementResolution;
  mappingClassification: MappingChangeClassification;
  activeRevision?: { verification_status: "pending" | "user_verified" | "manually_corrected" } | null;
  mode: RegistryResolutionMode;
  qualityGateApproved: boolean;
}): PromotionDecision {
  if (options.mode !== "promote") return { allowed: false, reason: "rollout_not_enabled" };
  if (!options.qualityGateApproved) return { allowed: false, reason: "quality_gate_not_approved" };
  if (options.resolution.result !== "resolved") return { allowed: false, reason: "resolver_not_resolved" };
  if (options.mappingClassification !== "compatibility_preserving") {
    return { allowed: false, reason: "mapping_requires_review" };
  }
  if (
    options.activeRevision &&
    (options.activeRevision.verification_status === "user_verified" ||
      options.activeRevision.verification_status === "manually_corrected")
  ) {
    return { allowed: false, reason: "manual_decision_protected" };
  }
  const selected = options.resolution.candidateEvidence.find(
    (candidate) => candidate.candidateKey === options.resolution.measurementDefinitionKey
  );
  if (!selected || selected.rejected.length > 0) return { allowed: false, reason: "hard_conflict" };
  return { allowed: true, reason: "approved" };
}
