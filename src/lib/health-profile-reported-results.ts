import type { AssessmentExclusionReason } from "./health-profile-assessment-eligibility";
import type { IncompleteReasonClass } from "./biomarkers";
import type { LaboratoryOutcomeSummary } from "./documents/incomplete-laboratory-outcomes";

export type HealthProfileReportedResults = Readonly<{
  reported_count: number;
  ready_for_scoring_count: number;
  needs_document_details_count: number;
  awaiting_catalog_review_count: number;
  awaiting_verification_count: number;
  source_document_count: number;
}>;

export type ReportedResultProjectionRow = Readonly<{
  id: string;
  document_id: string;
  outcome: LaboratoryOutcomeSummary;
  assessment_input: unknown | null;
}>;

export const EMPTY_HEALTH_PROFILE_REPORTED_RESULTS: HealthProfileReportedResults = {
  reported_count: 0,
  ready_for_scoring_count: 0,
  needs_document_details_count: 0,
  awaiting_catalog_review_count: 0,
  awaiting_verification_count: 0,
  source_document_count: 0,
};

const DOCUMENT_DETAIL_REASONS: Record<IncompleteReasonClass, true | undefined> = {
  axis_not_stated: true,
  unit_or_value_conflict: true,
  no_candidate: undefined,
  definition_not_reviewed: undefined,
};

const CATALOG_REVIEW_REASONS: Record<IncompleteReasonClass, true | undefined> = {
  axis_not_stated: undefined,
  unit_or_value_conflict: undefined,
  no_candidate: true,
  definition_not_reviewed: true,
};

const DOCUMENT_DETAIL_EXCLUSIONS: Record<AssessmentExclusionReason, true | undefined> = {
  non_numeric_value: true,
  numeric_value_missing: true,
  numeric_value_invalid: true,
  missing_document_reference_range: true,
  invalid_document_reference_range: true,
  no_active_revision: undefined,
  incomplete_resolution: undefined,
  candidate_only_identity: undefined,
  assessment_binding_ineligible: undefined,
  verification_required: undefined,
};

const CATALOG_REVIEW_EXCLUSIONS: Record<AssessmentExclusionReason, true | undefined> = {
  no_active_revision: true,
  incomplete_resolution: true,
  candidate_only_identity: true,
  assessment_binding_ineligible: true,
  verification_required: undefined,
  non_numeric_value: undefined,
  numeric_value_missing: undefined,
  numeric_value_invalid: undefined,
  missing_document_reference_range: undefined,
  invalid_document_reference_range: undefined,
};

function incompleteBucket(row: ReportedResultProjectionRow):
  | "needs_document_details"
  | "awaiting_catalog_review"
  | "awaiting_verification" {
  const details = row.outcome.resolutionDetails;
  const incompleteReason = details.incompleteReason;
  if (incompleteReason && DOCUMENT_DETAIL_REASONS[incompleteReason]) {
    return "needs_document_details";
  }
  if (incompleteReason && CATALOG_REVIEW_REASONS[incompleteReason]) {
    return "awaiting_catalog_review";
  }

  const exclusion = details.eligibility.exclusions.assessment;
  if (exclusion === "verification_required") return "awaiting_verification";
  if (exclusion && DOCUMENT_DETAIL_EXCLUSIONS[exclusion]) {
    return "needs_document_details";
  }
  if (exclusion && CATALOG_REVIEW_EXCLUSIONS[exclusion]) {
    return "awaiting_catalog_review";
  }

  // Keep every reported row visible in exactly one safe bucket even if a future
  // eligibility reason is added without updating this projection first. The
  // conservative fallback is catalog review; it never grants identity or score.
  return "awaiting_catalog_review";
}

/**
 * Projects current extracted rows into an explanatory, non-clinical summary.
 * Admission remains delegated to the existing Health Profile input projection;
 * this function only counts rows and never creates a scoreable input.
 */
export function projectHealthProfileReportedResults(
  rows: readonly ReportedResultProjectionRow[],
): HealthProfileReportedResults {
  let readyForScoring = 0;
  let needsDocumentDetails = 0;
  let awaitingCatalogReview = 0;
  let awaitingVerification = 0;
  const sourceDocumentIds = new Set<string>();

  for (const row of rows) {
    sourceDocumentIds.add(row.document_id);
    if (row.assessment_input !== null) {
      readyForScoring += 1;
      continue;
    }

    switch (incompleteBucket(row)) {
      case "needs_document_details":
        needsDocumentDetails += 1;
        break;
      case "awaiting_verification":
        awaitingVerification += 1;
        break;
      case "awaiting_catalog_review":
        awaitingCatalogReview += 1;
        break;
    }
  }

  return {
    reported_count: rows.length,
    ready_for_scoring_count: readyForScoring,
    needs_document_details_count: needsDocumentDetails,
    awaiting_catalog_review_count: awaitingCatalogReview,
    awaiting_verification_count: awaitingVerification,
    source_document_count: sourceDocumentIds.size,
  };
}
