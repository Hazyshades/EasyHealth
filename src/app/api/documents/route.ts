import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDocumentType } from "@/lib/health-systems";
import { getEligibleDocumentIds } from "@/lib/reports";
import {
  createSignedStorageUrl,
  isLegacyDocument,
  resolveDisplayProcessingStatus,
} from "@/lib/documents/access";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/documents/constants";

const THUMB_SIGN_CONCURRENCY = 8;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
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
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export async function GET(req: NextRequest) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeParam = req.nextUrl.searchParams.get("type");
  const eligibleOnly = req.nextUrl.searchParams.get("eligible_for_report") === "1";
  const supabase = createAdminClient();

  let query = supabase
    .from("documents")
    .select(
      "id, original_filename, status, document_type, lab_name, observed_at, created_at, error_message, mime_type, file_kind, thumbnail_storage_path, page_count, processing_status, processing_version, processing_error"
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (typeParam) {
    const normalized = normalizeDocumentType(typeParam);
    if (!normalized || normalized === "dicom") {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }
    query = query.eq("document_type", normalized);
  }

  if (eligibleOnly) {
    const eligibleIds = await getEligibleDocumentIds(profileId);
    if (eligibleIds.length === 0) {
      return NextResponse.json({ documents: [] });
    }
    query = query.in("id", eligibleIds);
  }

  const { data: documents, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = documents ?? [];

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

  const enriched = rows.map((doc, i) => {
    const { thumbnail_storage_path: _path, ...rest } = doc;
    return {
      ...rest,
      processing_status: resolveDisplayProcessingStatus(
        doc as Parameters<typeof resolveDisplayProcessingStatus>[0]
      ),
      is_legacy: isLegacyDocument(doc as Parameters<typeof isLegacyDocument>[0]),
      has_thumbnail: Boolean(doc.thumbnail_storage_path),
      thumbnail_url: thumbUrls[i]?.thumbnail_url ?? null,
      thumbnail_expires_in: thumbUrls[i]?.thumbnail_expires_in ?? null,
    };
  });

  return NextResponse.json({ documents: enriched });
}
