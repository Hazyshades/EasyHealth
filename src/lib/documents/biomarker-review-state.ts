export type BiomarkerPanelMode = "extracted-review" | "observations-fallback" | "review-error" | "empty";

export function measurementMappingLabel(
  result: "resolved" | "ambiguous" | "partial" | "unmapped",
  _confidenceBand: "high" | "medium" | "low"
): string {
  if (result === "resolved") return "Matched measurement";
  if (result === "partial") return "More details needed";
  if (result === "ambiguous") return "Multiple possible matches";
  return "Measurement not recognized";
}

/** Clinical English for a clinical axis the document did not state. */
const AXIS_NOUNS: Record<string, string> = {
  specimen: "specimen",
  modifier: "clinical qualifier",
  method: "method",
  timing: "collection timing",
  unit: "unit",
  value_kind: "value type",
};

function axisPhrase(axes: readonly string[]): string | null {
  const nouns = [...new Set(axes.map((axis) => AXIS_NOUNS[axis] ?? axis.replaceAll("_", " ")))];
  if (nouns.length === 0) return null;
  if (nouns.length === 1) return `The ${nouns[0]} is not stated in this report.`;
  const last = nouns[nouns.length - 1];
  return `The ${nouns.slice(0, -1).join(", ")} and ${last} are not stated in this report.`;
}

/**
 * #114: guidance is chosen by WHY a row is incomplete, not only by its outcome.
 *
 * The previous single sentence — "required context is missing" — was false for
 * every row blocked by catalog review: no context existed for the reader to
 * supply. Telling a clinician that a detail is missing invites them to guess
 * one, and a guessed specimen is exactly what #106 removed from the machine.
 */
export function measurementMappingGuidance(
  result: "resolved" | "ambiguous" | "partial" | "unmapped",
  context?: {
    incompleteReason?: "unit_or_value_conflict" | "axis_not_stated" | "definition_not_reviewed" | "no_candidate" | null;
    missingAxes?: readonly string[];
  }
): string {
  if (result === "resolved") {
    return "Mapping confidence describes classification evidence, not medical certainty.";
  }
  // The reason class, when present, is more specific than the outcome and wins.
  switch (context?.incompleteReason) {
    case "definition_not_reviewed":
      return "This measurement is recognized and is awaiting review in our catalog. Your report is complete for this result, which is preserved exactly as reported.";
    case "unit_or_value_conflict":
      return "The reported unit or value type does not match any reviewed measurement. The raw result remains available.";
    case "no_candidate":
      return "The raw result is preserved, but no authorized Registry 2.0 measurement matched.";
    default:
      break;
  }
  if (result === "partial") {
    const phrase = axisPhrase(context?.missingAxes ?? []);
    return phrase
      ? `The result is recognized. ${phrase} The raw result remains available.`
      : "The result is recognized, but required context is missing. The raw result remains available.";
  }
  if (result === "ambiguous") {
    return "More than one reviewed measurement remains possible. No measurement was selected.";
  }
  return "The raw result is preserved, but no authorized Registry 2.0 measurement matched.";
}

const REASON_LABELS: Record<string, string> = {
  // Clinical axes, which are fed here directly as well as via reason codes.
  specimen: "Specimen",
  modifier: "Clinical qualifier",
  method: "Method",
  timing: "Collection timing",
  unit: "Unit",
  value_kind: "Value type",
  // Reason codes emitted by the resolver.
  unit_missing: "Unit is missing",
  value_kind_missing: "Value type is missing",
  specimen_missing: "Specimen is missing",
  modifier_missing: "Clinical qualifier is missing",
  timing_missing: "Collection timing is missing",
  method_missing: "Method is missing",
  unit_unsupported: "Unit is not supported",
  unit_not_accepted: "Unit is not accepted for this measurement",
  unit_dimension_conflict: "Unit measures a different quantity",
  value_kind_conflict: "Value type is incompatible",
  specimen_conflict: "Specimen is incompatible",
  specimen_unsupported: "Specimen is not supported",
  modifier_conflict: "Clinical qualifier is incompatible",
  timing_conflict: "Collection timing is incompatible",
  method_conflict: "Method is incompatible",
};

export function measurementReasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code.replaceAll("_", " ");
}

export function resolveBiomarkerPanelMode(options: { extractedCount: number; observationCount: number; reviewDataError?: string | null }): BiomarkerPanelMode {
  if (options.reviewDataError) return "review-error";
  if (options.extractedCount > 0) return "extracted-review";
  if (options.observationCount > 0) return "observations-fallback";
  return "empty";
}

export type BiomarkerReviewAction = "accept-extracted" | "confirm-observations" | "none";
export function resolveBiomarkerReviewAction(options: { mode: BiomarkerPanelMode; documentStatus: string; reviewableExtractedCount: number }): BiomarkerReviewAction {
  if (options.documentStatus !== "needs_review") return "none";
  if (options.mode === "extracted-review" && options.reviewableExtractedCount > 0) return "accept-extracted";
  if (options.mode === "observations-fallback") return "confirm-observations";
  return "none";
}

export function shouldCompleteDocumentReview(options: {
  documentStatus: string;
  reviewableExtractedCount: number;
}): boolean {
  return options.documentStatus === "needs_review" && options.reviewableExtractedCount === 0;
}

export function reviewDataErrorMessage(error: { message?: string | null } | null | undefined): string | null { return error ? "Biomarker review data could not be loaded." : null; }
export type ObservationFallbackValidation = { ok: true } | { ok: false; status: number; error: string };
function sameIds(left: readonly string[], right: readonly string[]) { const a = [...new Set(left)].sort(); const b = [...new Set(right)].sort(); return a.length === b.length && a.every((value, index) => value === b[index]); }
export function validateObservationFallbackConfirmation(options: { documentStatus: string; submittedObservationIds: readonly string[]; linkedObservationIds: readonly string[]; reviewableExtractedCount: number; reviewDataQueryFailed?: boolean }): ObservationFallbackValidation {
  if (options.documentStatus !== "needs_review") return { ok: false, status: 409, error: "Document is not awaiting review" };
  if (options.reviewDataQueryFailed) return { ok: false, status: 503, error: "Biomarker review data could not be validated" };
  if (options.reviewableExtractedCount > 0) return { ok: false, status: 409, error: "Extracted biomarkers are available and must be reviewed" };
  if (options.linkedObservationIds.length === 0) return { ok: false, status: 409, error: "No linked biomarkers are available" };
  if (!sameIds(options.submittedObservationIds, options.linkedObservationIds)) return { ok: false, status: 400, error: "Observation selection does not match this document" };
  return { ok: true };
}
