export function documentStoragePrefix(profileId: string, documentId: string): string {
  return `${profileId}/${documentId}`;
}

export function attemptStoragePrefix(
  profileId: string,
  documentId: string,
  processingAttemptId: string,
): string {
  return `${documentStoragePrefix(profileId, documentId)}/attempts/${processingAttemptId}`;
}

export function attemptThumbnailObjectPath(
  profileId: string,
  documentId: string,
  processingAttemptId: string,
): string {
  return `${attemptStoragePrefix(profileId, documentId, processingAttemptId)}/thumb.webp`;
}

export function attemptPagePreviewObjectPath(
  profileId: string,
  documentId: string,
  processingAttemptId: string,
  pageNumber: number,
): string {
  return `${attemptStoragePrefix(profileId, documentId, processingAttemptId)}/pages/page-${pageNumber}.webp`;
}

export function attemptOcrFulltextPath(
  profileId: string,
  documentId: string,
  processingAttemptId: string,
): string {
  return `${attemptStoragePrefix(profileId, documentId, processingAttemptId)}/ocr/fulltext.txt`;
}

export function attemptOcrPageJsonPath(
  profileId: string,
  documentId: string,
  processingAttemptId: string,
  pageNumber: number,
): string {
  return `${attemptStoragePrefix(profileId, documentId, processingAttemptId)}/ocr/page-${pageNumber}.json`;
}

export function originalObjectPath(
  profileId: string,
  documentId: string,
  filename: string
): string {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "bin";
  return `${documentStoragePrefix(profileId, documentId)}/original.${ext}`;
}

export function thumbnailObjectPath(profileId: string, documentId: string): string {
  return `${documentStoragePrefix(profileId, documentId)}/thumb.webp`;
}

export function pagePreviewObjectPath(
  profileId: string,
  documentId: string,
  pageNumber: number
): string {
  return `${documentStoragePrefix(profileId, documentId)}/pages/page-${pageNumber}.webp`;
}

export function ocrFulltextPath(profileId: string, documentId: string): string {
  return `${documentStoragePrefix(profileId, documentId)}/ocr/fulltext.txt`;
}

export function ocrPageJsonPath(
  profileId: string,
  documentId: string,
  pageNumber: number
): string {
  return `${documentStoragePrefix(profileId, documentId)}/ocr/page-${pageNumber}.json`;
}

export function extractionJsonPath(profileId: string, documentId: string): string {
  return `${documentStoragePrefix(profileId, documentId)}/extraction/biomarkers.json`;
}

export function resolveOriginalStoragePath(doc: {
  original_storage_path: string | null;
  storage_path: string;
}): string {
  return doc.original_storage_path ?? doc.storage_path;
}
