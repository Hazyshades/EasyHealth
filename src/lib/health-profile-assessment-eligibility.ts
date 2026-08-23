import type { ResolverResult, VerificationStatus } from "@/lib/biomarkers";

export const ASSESSMENT_EXCLUSION_REASONS = [
  "no_active_revision",
  "incomplete_resolution",
  "candidate_only_identity",
  "assessment_binding_ineligible",
  "verification_required",
  "non_numeric_value",
  "numeric_value_missing",
  "numeric_value_invalid",
  "missing_document_reference_range",
  "invalid_document_reference_range",
] as const;

export type AssessmentExclusionReason =
  (typeof ASSESSMENT_EXCLUSION_REASONS)[number];

export type AssessmentEligibility = Readonly<{
  eligible: boolean;
  exclusionReason: AssessmentExclusionReason | null;
}>;

export type AssessmentEligibilityInput = Readonly<{
  hasActiveRevision: boolean;
  outcome: ResolverResult | null;
  registryBindingReady: boolean;
  hasReviewedAssessmentBinding: boolean;
  verificationStatus: VerificationStatus | string | null | undefined;
  valueKind: string | null | undefined;
  value: unknown;
  rawReferenceText: string | null | undefined;
  refLow: unknown;
  refHigh: unknown;
}>;

export const ASSESSMENT_EXCLUSION_LABELS: Readonly<
  Record<AssessmentExclusionReason, string>
> = {
  no_active_revision: "This result is waiting for an active review decision.",
  incomplete_resolution: "This result needs a resolved measurement before it can be used in an assessment.",
  candidate_only_identity: "This result's measurement mapping is not ready for assessment.",
  assessment_binding_ineligible: "This measurement is not approved for this assessment.",
  verification_required: "This result is not verified yet.",
  non_numeric_value: "This result is qualitative, so it is not used in numeric assessment.",
  numeric_value_missing: "This result has no numeric value available for assessment.",
  numeric_value_invalid: "This result's numeric value cannot be used for assessment.",
  missing_document_reference_range: "The source document has no usable reference range for this result.",
  invalid_document_reference_range: "The source document's reference range cannot be used for assessment.",
};

const VERIFIED_ASSESSMENT_STATUSES: Readonly<Record<string, true>> = {
  auto_verified: true,
  user_verified: true,
  manually_corrected: true,
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericValueExclusion(value: unknown): AssessmentExclusionReason | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return "numeric_value_missing";
  }
  return finiteNumber(value) === null ? "numeric_value_invalid" : null;
}

function documentReferenceRangeExclusion(options: Pick<
  AssessmentEligibilityInput,
  "rawReferenceText" | "refLow" | "refHigh"
>): AssessmentExclusionReason | null {
  if (typeof options.rawReferenceText !== "string" || options.rawReferenceText.trim() === "") {
    return "missing_document_reference_range";
  }

  const hasLow = options.refLow !== null && options.refLow !== undefined && options.refLow !== "";
  const hasHigh = options.refHigh !== null && options.refHigh !== undefined && options.refHigh !== "";
  if (!hasLow && !hasHigh) return "missing_document_reference_range";

  const low = finiteNumber(options.refLow);
  const high = finiteNumber(options.refHigh);
  if ((hasLow && low === null) || (hasHigh && high === null)) {
    return "invalid_document_reference_range";
  }
  if (low !== null && high !== null && low > high) {
    return "invalid_document_reference_range";
  }
  return null;
}

/**
 * The only admission predicate for laboratory observations that may affect a
 * Health Profile assessment. The first failure is deliberate: it prevents
 * downstream claims about an identity that is not yet safe for assessment.
 */
export function evaluateAssessmentEligibility(
  options: AssessmentEligibilityInput,
): AssessmentEligibility {
  if (!options.hasActiveRevision) {
    return { eligible: false, exclusionReason: "no_active_revision" };
  }
  if (options.outcome !== "resolved") {
    return { eligible: false, exclusionReason: "incomplete_resolution" };
  }
  if (!options.registryBindingReady) {
    return { eligible: false, exclusionReason: "candidate_only_identity" };
  }
  if (!options.hasReviewedAssessmentBinding) {
    return { eligible: false, exclusionReason: "assessment_binding_ineligible" };
  }
  if (VERIFIED_ASSESSMENT_STATUSES[options.verificationStatus ?? ""] !== true) {
    return { eligible: false, exclusionReason: "verification_required" };
  }
  if (options.valueKind !== "numeric") {
    return { eligible: false, exclusionReason: "non_numeric_value" };
  }

  const valueExclusion = numericValueExclusion(options.value);
  if (valueExclusion) return { eligible: false, exclusionReason: valueExclusion };

  const rangeExclusion = documentReferenceRangeExclusion(options);
  if (rangeExclusion) return { eligible: false, exclusionReason: rangeExclusion };

  return { eligible: true, exclusionReason: null };
}
