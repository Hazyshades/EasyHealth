import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDocumentType } from "@/lib/health-systems";
import { getEligibleDocumentIds } from "@/lib/reports";
import {
  isLegacyDocument,
  resolveDisplayProcessingStatus,
} from "@/lib/documents/access";

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
      "id, original_filename, status, document_type, lab_name, observed_at, created_at, error_message, mime_type, thumbnail_storage_path, page_count, processing_status, processing_version, processing_error"
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (typeParam) {
    if (!isDocumentType(typeParam)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }
    query = query.eq("document_type", typeParam);
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

  const enriched = (documents ?? []).map((doc) => ({
    ...doc,
    processing_status: resolveDisplayProcessingStatus(doc as Parameters<typeof resolveDisplayProcessingStatus>[0]),
    is_legacy: isLegacyDocument(doc as Parameters<typeof isLegacyDocument>[0]),
    has_thumbnail: Boolean(doc.thumbnail_storage_path),
  }));

  return NextResponse.json({ documents: enriched });
}
