import {
  isUploadableDocumentType,
  normalizeDocumentType,
  type DocumentType,
} from "@/lib/health-systems";

export function getDocumentReprocessTypeOverride(
  body: unknown
): DocumentType | undefined {
  if (!body || typeof body !== "object" || !("document_type" in body)) {
    return undefined;
  }
  const documentType = body.document_type;
  if (typeof documentType !== "string") return undefined;
  const normalized = normalizeDocumentType(documentType);
  return normalized && isUploadableDocumentType(normalized)
    ? normalized
    : undefined;
}
