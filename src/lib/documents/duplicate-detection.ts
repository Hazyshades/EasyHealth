export const DUPLICATE_METADATA_THRESHOLD = 0.7;

export const DUPLICATE_DECISIONS = [
  "keep_both",
  "archive_left",
  "archive_right",
] as const;

export type DuplicateDecision = (typeof DUPLICATE_DECISIONS)[number];

export const DUPLICATE_CANDIDATE_STATES = [
  "pending",
  "kept_both",
  "archived_left",
  "archived_right",
] as const;

export type DuplicateCandidateState =
  (typeof DUPLICATE_CANDIDATE_STATES)[number];
export type DuplicateMatchKind = "exact" | "metadata";
export type DuplicateReasonCode =
  | "file_hash"
  | "filename"
  | "file_size"
  | "mime_type"
  | "document_type"
  | "observed_at"
  | "lab_name";

export type DuplicateMetadataInput = {
  filename: string | null | undefined;
  fileSizeBytes: number | null | undefined;
  mimeType: string | null | undefined;
  documentType: string | null | undefined;
  observedAt: string | null | undefined;
  labName: string | null | undefined;
};

export type DuplicateMetadataSimilarity = {
  score: number;
  reasonCodes: DuplicateReasonCode[];
  qualifies: boolean;
};

export type DuplicateDocumentSummary = {
  id: string;
  original_filename: string;
  document_type: string;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  status: string;
  processing_status: string | null;
};

export type DuplicateCandidate = {
  id: string;
  left_document_id: string;
  right_document_id: string;
  match_kind: DuplicateMatchKind;
  similarity_score: number;
  reason_codes: DuplicateReasonCode[];
  state: DuplicateCandidateState;
  detected_at: string;
  updated_at: string;
  reviewed_at: string | null;
  left_document: DuplicateDocumentSummary;
  right_document: DuplicateDocumentSummary;
};

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeDuplicateFilename(
  filename: string | null | undefined,
): string {
  const value = (filename ?? "").trim().toLowerCase();
  return value.replace(/\.[^./]+$/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function calculateMetadataSimilarity(
  left: DuplicateMetadataInput,
  right: DuplicateMetadataInput,
): DuplicateMetadataSimilarity {
  let score = 0;
  const reasonCodes: DuplicateReasonCode[] = [];

  const leftFilename = normalizeDuplicateFilename(left.filename);
  const rightFilename = normalizeDuplicateFilename(right.filename);
  if (leftFilename !== "" && leftFilename === rightFilename) {
    score += 0.3;
    reasonCodes.push("filename");
  }

  if (
    left.fileSizeBytes != null &&
    right.fileSizeBytes != null &&
    left.fileSizeBytes === right.fileSizeBytes
  ) {
    score += 0.25;
    reasonCodes.push("file_size");
  }

  const leftMimeType = normalizeLabel(left.mimeType);
  const rightMimeType = normalizeLabel(right.mimeType);
  if (leftMimeType !== "" && leftMimeType === rightMimeType) {
    score += 0.15;
    reasonCodes.push("mime_type");
  }

  const leftDocumentType = normalizeLabel(left.documentType);
  const rightDocumentType = normalizeLabel(right.documentType);
  if (leftDocumentType !== "" && leftDocumentType === rightDocumentType) {
    score += 0.15;
    reasonCodes.push("document_type");
  }

  if (
    left.observedAt != null &&
    right.observedAt != null &&
    left.observedAt === right.observedAt
  ) {
    score += 0.1;
    reasonCodes.push("observed_at");
  }

  const leftLabName = normalizeLabel(left.labName);
  const rightLabName = normalizeLabel(right.labName);
  if (leftLabName !== "" && leftLabName === rightLabName) {
    score += 0.05;
    reasonCodes.push("lab_name");
  }

  const roundedScore = Number(score.toFixed(4));
  return {
    score: roundedScore,
    reasonCodes,
    qualifies: roundedScore >= DUPLICATE_METADATA_THRESHOLD,
  };
}

export function isDuplicateDecision(value: unknown): value is DuplicateDecision {
  return (
    typeof value === "string" &&
    (DUPLICATE_DECISIONS as readonly string[]).includes(value)
  );
}

export function duplicateMatchLabel(matchKind: DuplicateMatchKind): string {
  return matchKind === "exact" ? "Exact duplicate file" : "Possible duplicate";
}

export function duplicateReasonLabel(code: DuplicateReasonCode): string {
  switch (code) {
    case "file_hash":
      return "same file hash";
    case "filename":
      return "same filename";
    case "file_size":
      return "same file size";
    case "mime_type":
      return "same file type";
    case "document_type":
      return "same document type";
    case "observed_at":
      return "same medical date";
    case "lab_name":
      return "same provider";
  }
}
