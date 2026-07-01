import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LAB_DOCUMENTS_BUCKET } from "@/lib/supabase/storage";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/documents/constants";
import { resolveOriginalStoragePath } from "@/lib/documents/paths";

export type DocumentRow = {
  id: string;
  profile_id: string;
  storage_path: string;
  original_storage_path: string | null;
  original_filename: string;
  status: string;
  document_type: string;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  error_message: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  thumbnail_storage_path: string | null;
  page_count: number | null;
  processing_status: string | null;
  processing_error: string | null;
  processing_version: string | null;
  extraction_model: string | null;
  processed_at: string | null;
  file_kind: string | null;
  document_summary: string | null;
  modality: string | null;
  detected_document_type: string | null;
  type_mismatch_warning: boolean | null;
  type_mismatch_reason: string | null;
};

const DOCUMENT_SELECT =
  "id, profile_id, storage_path, original_storage_path, original_filename, status, document_type, lab_name, observed_at, created_at, error_message, mime_type, file_size_bytes, thumbnail_storage_path, page_count, processing_status, processing_error, processing_version, extraction_model, processed_at, file_kind, document_summary, modality, detected_document_type, type_mismatch_warning, type_mismatch_reason";

export function isLegacyDocument(doc: DocumentRow): boolean {
  return doc.processing_version == null;
}

export function resolveDisplayProcessingStatus(doc: DocumentRow): string {
  if (doc.processing_status) return doc.processing_status;
  if (doc.status === "failed") return "failed";
  if (doc.status === "processing") return "processing";
  if (doc.status === "completed") return "ready";
  return "processing";
}

export async function getOwnedDocument(
  profileId: string,
  documentId: string
): Promise<DocumentRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", documentId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as DocumentRow | null;
}

export async function assertDocumentOwner(profileId: string, documentId: string) {
  const doc = await getOwnedDocument(profileId, documentId);
  if (!doc) {
    return { doc: null, error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { doc, error: null };
}

export async function createSignedStorageUrl(storagePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(LAB_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create signed URL");
  }

  return {
    url: data.signedUrl,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  };
}

export function noStoreJson<T>(body: T, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export function guessMimeType(filename: string, stored: string | null): string {
  if (stored) return stored;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export function getOriginalPath(doc: DocumentRow): string {
  return resolveOriginalStoragePath(doc);
}
