import type { DocumentRow } from "./access";

export type ReviewMode = "easy" | "pro";

export type ReviewModeAction =
  | "accept"
  | "reject"
  | "correct"
  | "edit_value"
  | "undo"
  | "manual_mapping"
  | "batch_verify"
  | "batch_reverse"
  | "confirm_observations"
  | "reprocess";

export type ReviewModeDocument = Pick<
  DocumentRow,
  | "id"
  | "profile_id"
  | "document_type"
  | "review_mode"
  | "review_mode_locked_at"
>;

export type ReviewModeActionAvailability = Readonly<{
  available: boolean;
  code: string | null;
  message: string | null;
}>;

export class ReviewModePolicyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ReviewModePolicyError";
  }
}

export function isLaboratoryReviewDocument(
  document: ReviewModeDocument,
): boolean {
  return document.document_type === "lab_result";
}

export function effectiveReviewMode(
  document: ReviewModeDocument,
): ReviewMode | null {
  if (!isLaboratoryReviewDocument(document)) return null;
  return document.review_mode === "easy" ? "easy" : "pro";
}

export function hasInitialReviewWrite(document: ReviewModeDocument): boolean {
  return document.review_mode_locked_at != null;
}

export function reviewModeActionAvailability(
  document: ReviewModeDocument,
  action: ReviewModeAction,
): ReviewModeActionAvailability {
  const mode = effectiveReviewMode(document);
  if (!mode) {
    return {
      available: false,
      code: "review_mode_not_applicable",
      message: "Review modes apply only to laboratory Documents.",
    };
  }

  if (action === "accept" || action === "reject" || action === "reprocess") {
    return { available: true, code: null, message: null };
  }

  if (mode === "easy") {
    return {
      available: false,
      code: "easy_mode_restriction",
      message: "This action requires Pro mode.",
    };
  }

  return { available: true, code: null, message: null };
}

export function assertReviewModeActionAllowed(
  document: ReviewModeDocument,
  action: ReviewModeAction,
): void {
  const availability = reviewModeActionAvailability(document, action);
  if (!availability.available) {
    throw new ReviewModePolicyError(
      availability.message ?? "This review action is unavailable.",
      availability.code === "review_mode_not_applicable" ? 409 : 403,
      availability.code ?? "review_mode_action_unavailable",
    );
  }
}

export function canSelectReviewMode(document: ReviewModeDocument): boolean {
  return (
    isLaboratoryReviewDocument(document) && !hasInitialReviewWrite(document)
  );
}

export function assertReviewModeSelectionAllowed(
  document: ReviewModeDocument,
): void {
  if (!isLaboratoryReviewDocument(document)) {
    throw new ReviewModePolicyError(
      "Review modes apply only to laboratory Documents.",
      409,
      "review_mode_not_applicable",
    );
  }
  if (!canSelectReviewMode(document)) {
    throw new ReviewModePolicyError(
      "The review mode is locked after the first accepted or corrected result.",
      409,
      "review_mode_locked",
    );
  }
}

export function assertReviewModeEscalationAllowed(
  document: ReviewModeDocument,
): void {
  if (!isLaboratoryReviewDocument(document)) {
    throw new ReviewModePolicyError(
      "Review modes apply only to laboratory Documents.",
      409,
      "review_mode_not_applicable",
    );
  }
  if (
    effectiveReviewMode(document) !== "easy" ||
    !hasInitialReviewWrite(document)
  ) {
    throw new ReviewModePolicyError(
      "Enter Pro mode is available only for a locked Easy review.",
      409,
      "review_mode_escalation_unavailable",
    );
  }
}
