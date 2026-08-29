/**
 * Bumped for #111: captured section headings are grounded against page OCR
 * text so a fabricated heading cannot unlock a reviewed panel specimen policy.
 */
export const DOCUMENT_PROCESSING_VERSION = "2026-08-28-v1";
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
