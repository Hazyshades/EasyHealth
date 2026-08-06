/**
 * Bumped for #106: extraction no longer stores an unstated clinical axis.
 * `-v2`: the prompt no longer offers a section heading as grounds for a
 * specimen. Headings are not captured with the row, so a specimen read from one
 * cannot be verified and was being discarded anyway.
 */
export const DOCUMENT_PROCESSING_VERSION = "2026-08-06-v1";
export const SIGNED_URL_TTL_SECONDS = 900;

export type DocumentProcessingStatus =
  | "processing"
  | "needs_review"
  | "ready"
  | "failed";

export type ExtractedBiomarkerStatus =
  | "pending_review"
  | "needs_review"
  | "accepted"
  | "rejected"
  | "auto_accepted";
