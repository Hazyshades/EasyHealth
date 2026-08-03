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

export function measurementMappingGuidance(
  result: "resolved" | "ambiguous" | "partial" | "unmapped"
): string {
  if (result === "resolved") {
    return "Mapping confidence describes classification evidence, not medical certainty.";
  }
  if (result === "partial") {
    return "The result is recognized, but required context is missing. The raw result remains available.";
  }
  if (result === "ambiguous") {
    return "More than one reviewed measurement remains possible. No measurement was selected.";
  }
  return "The raw result is preserved, but no authorized Registry 2.0 measurement matched.";
}

const REASON_LABELS: Record<string, string> = {
  unit_missing: "Unit is missing",
  value_kind_missing: "Value type is missing",
  specimen_missing: "Specimen is missing",
  unit_unsupported: "Unit is not supported",
  unit_conflict: "Unit is incompatible",
  value_kind_conflict: "Value type is incompatible",
  specimen_conflict: "Specimen is incompatible",
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
