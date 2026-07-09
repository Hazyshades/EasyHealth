import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertDocumentOwner,
  createSignedStorageUrl,
  getOriginalPath,
  guessMimeType,
  isLegacyDocument,
  noStoreJson,
  resolveDisplayProcessingStatus,
} from "@/lib/documents/access";
import { normalizeDocumentType } from "@/lib/health-systems";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/documents/constants";

type RouteContext = { params: Promise<{ id: string }> };

const EXTRACTED_BIOMARKER_SELECT =
  "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, reference_range, source_page, source_text, confidence, status, processing_version, extraction_model, specimen, modifier, reported_alt_value, reported_alt_unit, created_at";

const OBSERVATION_SELECT =
  "id, biomarker_key, name, value, unit, ref_low, ref_high, observed_at, source_extracted_biomarker_id";

async function safeSignedUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  try {
    return await createSignedStorageUrl(storagePath);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const supabase = createAdminClient();
  const documentType = normalizeDocumentType(doc!.document_type) ?? "lab_result";
  const pageParam = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const requestedPage =
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [
    pagesResult,
    extractedResult,
    observationsResult,
    findingsResult,
    clinicalNoteResult,
    prescriptionResult,
    referralResult,
    fileSigned,
  ] = await Promise.all([
    supabase
      .from("document_pages")
      .select("page_number, width, height, preview_storage_path")
      .eq("document_id", id)
      .order("page_number", { ascending: true }),
    supabase
      .from("document_extracted_biomarkers")
      .select(EXTRACTED_BIOMARKER_SELECT)
      .eq("document_id", id)
      .eq("profile_id", profileId)
      .order("biomarker_name", { ascending: true }),
    supabase
      .from("observations")
      .select(OBSERVATION_SELECT)
      .eq("profile_id", profileId)
      .eq("document_id", id)
      .order("name", { ascending: true }),
    documentType === "instrumental_report"
      ? supabase
          .from("document_extracted_findings")
          .select("*")
          .eq("document_id", id)
          .eq("status", "accepted")
      : Promise.resolve({ data: [] as unknown[] }),
    documentType === "consultation_note" || documentType === "discharge_summary"
      ? supabase
          .from("document_extracted_clinical_notes")
          .select("*")
          .eq("document_id", id)
          .eq("status", "accepted")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    documentType === "prescription"
      ? supabase
          .from("document_extracted_prescriptions")
          .select("*")
          .eq("document_id", id)
          .eq("status", "accepted")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    documentType === "referral"
      ? supabase
          .from("document_extracted_referrals")
          .select("*")
          .eq("document_id", id)
          .eq("status", "accepted")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    safeSignedUrl(getOriginalPath(doc!)),
  ]);

  const pageRows = pagesResult.data ?? [];
  const pages = pageRows.map((p) => ({
    page_number: p.page_number,
    width: p.width,
    height: p.height,
  }));

  const pageMatch =
    pageRows.find((p) => p.page_number === requestedPage) ?? pageRows[0] ?? null;
  const pageSigned = pageMatch
    ? await safeSignedUrl(pageMatch.preview_storage_path)
    : null;

  const extractedItems = extractedResult.data ?? [];
  const extractedCount = extractedItems.length;

  const file =
    fileSigned != null
      ? {
          url: fileSigned.url,
          mimeType: guessMimeType(doc!.original_filename, doc!.mime_type),
          filename: doc!.original_filename,
          expiresIn: fileSigned.expiresIn ?? SIGNED_URL_TTL_SECONDS,
        }
      : null;

  const current_page =
    pageSigned != null && pageMatch
      ? {
          url: pageSigned.url,
          pageNumber: pageMatch.page_number,
          width: pageMatch.width,
          height: pageMatch.height,
          expiresIn: pageSigned.expiresIn ?? SIGNED_URL_TTL_SECONDS,
        }
      : null;

  return noStoreJson({
    document: {
      id: doc!.id,
      original_filename: doc!.original_filename,
      document_type: documentType,
      lab_name: doc!.lab_name,
      observed_at: doc!.observed_at,
      created_at: doc!.created_at,
      mime_type: doc!.mime_type,
      file_kind: doc!.file_kind,
      page_count: doc!.page_count,
      processing_status: resolveDisplayProcessingStatus(doc!),
      processing_error: doc!.processing_error ?? doc!.error_message,
      processing_version: doc!.processing_version,
      extraction_model: doc!.extraction_model,
      processed_at: doc!.processed_at,
      document_summary: doc!.document_summary,
      modality: doc!.modality,
      is_legacy: isLegacyDocument(doc!),
      has_thumbnail: Boolean(doc!.thumbnail_storage_path),
      extracted_biomarker_count: extractedCount,
      detected_document_type: doc!.detected_document_type ?? null,
      type_mismatch_warning: Boolean(doc!.type_mismatch_warning),
      type_mismatch_reason: doc!.type_mismatch_reason ?? null,
      suggested_document_type: doc!.detected_document_type ?? null,
    },
    pages,
    instrumental_findings: findingsResult.data ?? [],
    clinical_note: clinicalNoteResult.data ?? null,
    prescription: prescriptionResult.data ?? null,
    referral: referralResult.data ?? null,
    extracted_biomarkers: extractedItems,
    observations: observationsResult.data ?? [],
    file,
    current_page,
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  if (body?.type_mismatch_warning === false) {
    const supabase = createAdminClient();
    await supabase
      .from("documents")
      .update({ type_mismatch_warning: false })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported update" }, { status: 400 });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const supabase = createAdminClient();
  const paths = new Set<string>([doc!.storage_path]);
  if (doc!.original_storage_path) paths.add(doc!.original_storage_path);
  if (doc!.thumbnail_storage_path) paths.add(doc!.thumbnail_storage_path);

  const { data: pageRows } = await supabase
    .from("document_pages")
    .select("preview_storage_path")
    .eq("document_id", id);
  for (const row of pageRows ?? []) {
    if (row.preview_storage_path) paths.add(row.preview_storage_path);
  }

  const prefix = `${profileId}/${id}`;
  const { data: listed } = await supabase.storage.from("lab-documents").list(prefix, {
    limit: 100,
  });

  async function removePath(path: string) {
    await supabase.storage.from("lab-documents").remove([path]);
  }

  for (const path of paths) {
    await removePath(path);
  }

  if (listed?.length) {
    const nested = await Promise.all(
      listed.map(async (entry) => {
        if (entry.id) return `${prefix}/${entry.name}`;
        const sub = await supabase.storage.from("lab-documents").list(`${prefix}/${entry.name}`);
        return (sub.data ?? []).map((f) => `${prefix}/${entry.name}/${f.name}`);
      })
    );
    for (const p of nested.flat()) {
      if (typeof p === "string") await removePath(p);
    }
  }

  const { error: deleteError } = await supabase.from("documents").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
