import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDocumentType } from "@/lib/health-systems";
import { getEligibleDocumentIds } from "@/lib/reports";
import {
  createSignedStorageUrl,
  isLegacyDocument,
  resolveDisplayProcessingStatus,
} from "@/lib/documents/access";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/documents/constants";
import type {
  DocumentListItem,
  ListDocumentsQuery,
  ListDocumentsResult,
} from "@/lib/documents/list-types";

const THUMB_SIGN_CONCURRENCY = 8;

const DOCUMENT_LIST_SELECT =
  "id, original_filename, status, document_type, lab_name, observed_at, created_at, error_message, mime_type, file_kind, thumbnail_storage_path, page_count, processing_status, processing_version, processing_error";

type DocumentListRow = {
  id: string;
  original_filename: string;
  status: string;
  document_type: string;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  error_message: string | null;
  mime_type: string | null;
  file_kind: string | null;
  thumbnail_storage_path: string | null;
  page_count: number | null;
  processing_status: string | null;
  processing_version: string | null;
  processing_error: string | null;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function listDocumentsForProfile(
  profileId: string,
  query: ListDocumentsQuery = {},
): Promise<ListDocumentsResult> {
  const supabase = createAdminClient();

  let dbQuery = supabase
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (query.type) {
    const normalized = normalizeDocumentType(query.type);
    if (!normalized || normalized === "dicom") {
      return { ok: false, status: 400, error: "Invalid document type" };
    }
    dbQuery = dbQuery.eq("document_type", normalized);
  }

  if (query.eligibleOnly) {
    const eligibleIds = await getEligibleDocumentIds(profileId);
    if (eligibleIds.length === 0) {
      return { ok: true, documents: [] };
    }
    dbQuery = dbQuery.in("id", eligibleIds);
  }

  const { data: documents, error } = await dbQuery;
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  const rows = (documents ?? []) as DocumentListRow[];
  const thumbUrls = await mapPool(rows, THUMB_SIGN_CONCURRENCY, async (doc) => {
    if (!doc.thumbnail_storage_path) {
      return { thumbnail_url: null as string | null, thumbnail_expires_in: null as number | null };
    }
    try {
      const signed = await createSignedStorageUrl(doc.thumbnail_storage_path);
      if (!signed) {
        return { thumbnail_url: null, thumbnail_expires_in: null };
      }
      return {
        thumbnail_url: signed.url,
        thumbnail_expires_in: signed.expiresIn ?? SIGNED_URL_TTL_SECONDS,
      };
    } catch {
      return { thumbnail_url: null, thumbnail_expires_in: null };
    }
  });

  const enriched: DocumentListItem[] = rows.map((doc, i) => {
    const { thumbnail_storage_path: _path, ...rest } = doc;
    return {
      ...rest,
      processing_status: resolveDisplayProcessingStatus(
        doc as Parameters<typeof resolveDisplayProcessingStatus>[0],
      ),
      is_legacy: isLegacyDocument(doc as Parameters<typeof isLegacyDocument>[0]),
      has_thumbnail: Boolean(doc.thumbnail_storage_path),
      thumbnail_url: thumbUrls[i]?.thumbnail_url ?? null,
      thumbnail_expires_in: thumbUrls[i]?.thumbnail_expires_in ?? null,
    };
  });

  return { ok: true, documents: enriched };
}
