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
import {
  buildNormalizationReview,
  type NormalizationRevisionSummary,
} from "@/lib/documents/normalization-review";
import { reviewDataErrorMessage } from "@/lib/documents/biomarker-review-state";
import { isWorkerOffline } from "@/lib/documents/worker-health";

type RouteContext = { params: Promise<{ id: string }> };

const EXTRACTED_BIOMARKER_SELECT =
  "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, source_page, source_text, confidence, status, processing_version, extraction_model, specimen, modifier, reported_alt_value, reported_alt_unit, raw_value_text, measurement_definition_key, resolver_result, mapping_confidence, mapping_confidence_band, resolver_evidence, catalog_manifest_version, catalog_manifest_digest, resolver_version, normalization_version, verification_status, created_at";

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
  const processingStatus = resolveDisplayProcessingStatus(doc!);
  const pageParam = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const requestedPage =
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [
    pagesResult,
    extractedResult,
    findingsResult,
    clinicalNoteResult,
    prescriptionResult,
    referralResult,
    fileSigned,
    heartbeatResult,
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
      .eq("is_current", true)
      .order("biomarker_name", { ascending: true }),
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
    processingStatus === "processing"
      ? supabase
          .from("worker_heartbeats")
          .select("last_seen")
          .order("last_seen", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (heartbeatResult.error) {
    console.error("Failed to load document worker heartbeat", {
      documentId: id,
      message: heartbeatResult.error.message,
    });
  }
  const workerOffline =
    processingStatus === "processing" &&
    isWorkerOffline(heartbeatResult.data?.last_seen);

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

  const reviewDataError = reviewDataErrorMessage(extractedResult.error);
  if (extractedResult.error) {
    console.error("Failed to load extracted biomarkers", {
      documentId: id,
      message: extractedResult.error.message,
    });
  }
  const extractedItems = extractedResult.error ? [] : (extractedResult.data ?? []);
  const extractedIds = extractedItems.map((item) => item.id);
  const revisionsResult = extractedIds.length
    ? await supabase
        .from("observation_normalization_revisions")
        .select(
          "id, extracted_biomarker_id, analyte_key, measurement_definition_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, is_active, catalog_manifest_version, resolver_version, normalization_version, created_at"
        )
        .in("extracted_biomarker_id", extractedIds)
        .order("created_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>> };
  const revisionsByExtractedId = new Map<string, Array<Record<string, unknown>>>();
  for (const revision of revisionsResult.data ?? []) {
    const key = String(revision.extracted_biomarker_id);
    const entries = revisionsByExtractedId.get(key) ?? [];
    entries.push(revision as Record<string, unknown>);
    revisionsByExtractedId.set(key, entries);
  }
  const enrichedExtractedItems = extractedItems.map((item) => ({
    ...item,
    normalization: buildNormalizationReview(
      item,
      (revisionsByExtractedId.get(item.id) ?? []) as unknown as NormalizationRevisionSummary[]
    ),
  }));
  const extractedCount = enrichedExtractedItems.length;
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
      processing_status: processingStatus,
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
    workerOffline,
    pages,
    instrumental_findings: findingsResult.data ?? [],
    clinical_note: clinicalNoteResult.data ?? null,
    prescription: prescriptionResult.data ?? null,
    referral: referralResult.data ?? null,
    extracted_biomarkers: enrichedExtractedItems,
    review_data_error: reviewDataError,
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
