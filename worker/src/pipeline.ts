import {
  DOCUMENT_PROCESSING_VERSION,
} from "../../src/lib/documents/constants.js";
import {
  extractConsultationFromImage,
  extractConsultationFromText,
} from "../../src/lib/documents/consultation-extraction.js";
import { generateDocumentSummary } from "../../src/lib/documents/document-summary.js";
import {
  extractPipelineBiomarkersFromImage,
  extractPipelineBiomarkersFromText,
  formatReferenceRange,
} from "../../src/lib/documents/extraction.js";
import {
  extractInstrumentalFromImage,
  extractInstrumentalFromText,
} from "../../src/lib/documents/instrumental-extraction.js";
import {
  ocrFulltextPath,
  pagePreviewObjectPath,
  resolveOriginalStoragePath,
  thumbnailObjectPath,
} from "../../src/lib/documents/paths.js";
import { normalizeDocumentType, type DocumentType } from "../../src/lib/health-systems.js";
import { modelIdForProvider, resolveLanguageModel, type AiProviderId } from "./ai.js";
import { extractPdfText, generatePagePreviews, generateThumbnail } from "./previews.js";
import { LAB_DOCUMENTS_BUCKET, supabase } from "./supabase.js";

type JobRow = {
  id: string;
  document_id: string;
  profile_id: string;
  attempts: number;
  max_attempts: number;
};

type DocumentRow = {
  id: string;
  profile_id: string;
  storage_path: string;
  original_storage_path: string | null;
  original_filename: string;
  mime_type: string | null;
  document_type: string;
};

async function failJob(job: JobRow, documentId: string, message: string) {
  await supabase
    .from("document_processing_jobs")
    .update({
      status: "failed",
      error: message,
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await supabase
    .from("documents")
    .update({
      processing_status: "failed",
      status: "failed",
      processing_error: message,
    })
    .eq("id", documentId);
}

async function runTextOrImageExtraction<T>(
  ocrText: string,
  pageBuffer: Buffer,
  fromText: (text: string) => Promise<T>,
  fromImage: (buffer: Buffer) => Promise<T>
): Promise<T> {
  if (ocrText.trim().length > 80) {
    return fromText(ocrText);
  }
  return fromImage(pageBuffer);
}

export async function runPipeline(job: JobRow) {
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select(
      "id, profile_id, storage_path, original_storage_path, original_filename, mime_type, document_type"
    )
    .eq("id", job.document_id)
    .single();

  if (docError || !document) {
    await failJob(job, job.document_id, docError?.message ?? "Document not found");
    return;
  }

  const doc = document as DocumentRow;
  const documentType = normalizeDocumentType(doc.document_type) ?? "lab_result";
  const storagePath = resolveOriginalStoragePath(doc);
  const mimeType =
    doc.mime_type ??
    (doc.original_filename.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg");

  await supabase
    .from("documents")
    .update({ processing_status: "processing", status: "processing" })
    .eq("id", doc.id);

  await supabase.from("document_extracted_biomarkers").delete().eq("document_id", doc.id);
  await supabase.from("document_extracted_findings").delete().eq("document_id", doc.id);
  await supabase.from("document_extracted_clinical_notes").delete().eq("document_id", doc.id);
  await supabase.from("document_pages").delete().eq("document_id", doc.id);

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(LAB_DOCUMENTS_BUCKET)
    .download(storagePath);

  if (downloadError || !fileData) {
    await failJob(job, doc.id, downloadError?.message ?? "Download failed");
    return;
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const profileId = doc.profile_id;
  const documentId = doc.id;

  let pages;
  try {
    pages = await generatePagePreviews(buffer, mimeType, doc.original_filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview generation failed";
    await failJob(job, doc.id, message);
    return;
  }

  const thumbBuffer = await generateThumbnail(pages[0].buffer);
  const thumbPath = thumbnailObjectPath(profileId, documentId);
  await supabase.storage.from(LAB_DOCUMENTS_BUCKET).upload(thumbPath, thumbBuffer, {
    contentType: "image/webp",
    upsert: true,
  });

  for (const page of pages) {
    const previewPath = pagePreviewObjectPath(profileId, documentId, page.pageNumber);
    await supabase.storage.from(LAB_DOCUMENTS_BUCKET).upload(previewPath, page.buffer, {
      contentType: "image/webp",
      upsert: true,
    });

    await supabase.from("document_pages").insert({
      document_id: documentId,
      profile_id: profileId,
      page_number: page.pageNumber,
      width: page.width,
      height: page.height,
      preview_storage_path: previewPath,
    });
  }

  let ocrText = "";
  if (mimeType === "application/pdf") {
    ocrText = await extractPdfText(buffer);
    const ocrPath = ocrFulltextPath(profileId, documentId);
    await supabase.storage.from(LAB_DOCUMENTS_BUCKET).upload(ocrPath, ocrText, {
      contentType: "text/plain",
      upsert: true,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", profileId)
    .single();

  const provider = (profile?.ai_provider as AiProviderId | null) ?? "openai";
  const model = resolveLanguageModel(provider);
  const extractionModel = modelIdForProvider(provider);

  let processingStatus = "ready";
  let observedAt: string | null = null;
  let labName: string | null = null;
  let modality: string | null = null;
  let documentSummary: string | null = null;
  let structuredPayload: unknown = null;

  try {
    if (documentType === "lab_result") {
      const extraction = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        (text) => extractPipelineBiomarkersFromText(text, model, doc.original_filename),
        (image) =>
          extractPipelineBiomarkersFromImage(image, "image/webp", model, doc.original_filename)
      );

      structuredPayload = extraction;
      observedAt = extraction.observed_at;
      labName = extraction.lab_name;

      if (extraction.biomarkers.length > 0) {
        await supabase.from("document_extracted_biomarkers").insert(
          extraction.biomarkers.map((b) => ({
            document_id: documentId,
            profile_id: profileId,
            biomarker_key: b.key,
            biomarker_name: b.name,
            raw_name: b.name,
            value_numeric: b.value,
            unit: b.unit,
            reference_range: formatReferenceRange(b.ref_low ?? null, b.ref_high ?? null),
            source_page: b.source_page ?? 1,
            source_text: b.source_text,
            confidence: b.confidence,
            extraction_method: "llm",
            processing_version: DOCUMENT_PROCESSING_VERSION,
            extraction_model: extractionModel,
            status: "needs_review",
          }))
        );
        processingStatus = "needs_review";
      }

      documentSummary = await generateDocumentSummary(
        model,
        documentType as DocumentType,
        extraction,
        doc.original_filename
      );
    } else if (documentType === "instrumental_report") {
      const extraction = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        (text) => extractInstrumentalFromText(text, model, doc.original_filename),
        (image) =>
          extractInstrumentalFromImage(image, "image/webp", model, doc.original_filename)
      );

      structuredPayload = extraction;
      observedAt = extraction.study_date;
      labName = extraction.facility_name;
      modality = extraction.modality;

      if (extraction.findings.length > 0) {
        await supabase.from("document_extracted_findings").insert(
          extraction.findings.map((finding, index) => ({
            document_id: documentId,
            profile_id: profileId,
            modality: extraction.modality,
            body_region: extraction.body_region,
            finding_text: finding.finding_text,
            impression: index === 0 ? extraction.impression : null,
            source_page: finding.source_page ?? 1,
            source_text: finding.source_text,
            confidence: finding.confidence,
            extraction_method: "llm",
            processing_version: DOCUMENT_PROCESSING_VERSION,
            extraction_model: extractionModel,
            status: "accepted",
          }))
        );
      } else if (extraction.impression) {
        await supabase.from("document_extracted_findings").insert({
          document_id: documentId,
          profile_id: profileId,
          modality: extraction.modality,
          body_region: extraction.body_region,
          finding_text: extraction.impression,
          impression: extraction.impression,
          source_page: 1,
          confidence: 0.8,
          extraction_method: "llm",
          processing_version: DOCUMENT_PROCESSING_VERSION,
          extraction_model: extractionModel,
          status: "accepted",
        });
      }

      documentSummary = await generateDocumentSummary(
        model,
        documentType as DocumentType,
        extraction,
        doc.original_filename
      );
    } else if (documentType === "consultation_note") {
      const extraction = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        (text) => extractConsultationFromText(text, model, doc.original_filename),
        (image) =>
          extractConsultationFromImage(image, "image/webp", model, doc.original_filename)
      );

      structuredPayload = extraction;
      observedAt = extraction.visit_date;
      labName = extraction.provider_name;

      await supabase.from("document_extracted_clinical_notes").insert({
        document_id: documentId,
        profile_id: profileId,
        provider_name: extraction.provider_name,
        visit_date: extraction.visit_date,
        chief_complaint: extraction.chief_complaint,
        history_summary: extraction.history_summary,
        exam_findings: extraction.exam_findings,
        documented_diagnoses: extraction.documented_diagnoses,
        recommendations: extraction.recommendations,
        follow_up_plan: extraction.follow_up_plan,
        extraction_method: "llm",
        processing_version: DOCUMENT_PROCESSING_VERSION,
        extraction_model: extractionModel,
        status: "accepted",
      });

      documentSummary = await generateDocumentSummary(
        model,
        documentType as DocumentType,
        extraction,
        doc.original_filename
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    await failJob(job, doc.id, message);
    return;
  }

  await supabase
    .from("documents")
    .update({
      processing_status: processingStatus,
      status: processingStatus === "ready" ? "completed" : "processing",
      page_count: pages.length,
      thumbnail_storage_path: thumbPath,
      processing_version: DOCUMENT_PROCESSING_VERSION,
      extraction_model: extractionModel,
      processed_at: new Date().toISOString(),
      lab_name: labName,
      observed_at: observedAt,
      modality,
      document_summary: documentSummary,
      ocr_status: ocrText ? "completed" : "skipped",
      extraction_status: "completed",
    })
    .eq("id", documentId);

  await supabase.from("profile_health_synthesis").delete().eq("profile_id", profileId);

  void structuredPayload;

  await supabase
    .from("document_processing_jobs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}
