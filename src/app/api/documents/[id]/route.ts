import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertDocumentOwner,
  isLegacyDocument,
  noStoreJson,
  resolveDisplayProcessingStatus,
} from "@/lib/documents/access";
import { normalizeDocumentType } from "@/lib/health-systems";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const supabase = createAdminClient();
  const documentType = normalizeDocumentType(doc!.document_type) ?? "lab_result";

  const [{ data: pages }, { count: extractedCount }, { data: findings }, { data: clinicalNote }] =
    await Promise.all([
      supabase
        .from("document_pages")
        .select("page_number, width, height")
        .eq("document_id", id)
        .order("page_number", { ascending: true }),
      supabase
        .from("document_extracted_biomarkers")
        .select("id", { count: "exact", head: true })
        .eq("document_id", id),
      documentType === "instrumental_report"
        ? supabase
            .from("document_extracted_findings")
            .select("*")
            .eq("document_id", id)
            .eq("status", "accepted")
        : Promise.resolve({ data: [] }),
      documentType === "consultation_note"
        ? supabase
            .from("document_extracted_clinical_notes")
            .select("*")
            .eq("document_id", id)
            .eq("status", "accepted")
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

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
      extracted_biomarker_count: extractedCount ?? 0,
    },
    pages: pages ?? [],
    instrumental_findings: findings ?? [],
    clinical_note: clinicalNote ?? null,
  });
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