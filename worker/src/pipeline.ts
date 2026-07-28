import {
  DOCUMENT_PROCESSING_VERSION,
} from "../../src/lib/documents/constants.js";
import {
  extractConsultationFromImage,
  extractConsultationFromText,
} from "../../src/lib/documents/consultation-extraction.js";
import {
  extractDischargeFromImage,
  extractDischargeFromText,
} from "../../src/lib/documents/discharge-extraction.js";
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
  extractPrescriptionFromImage,
  extractPrescriptionFromText,
} from "../../src/lib/documents/prescription-extraction.js";
import {
  extractReferralFromImage,
  extractReferralFromText,
} from "../../src/lib/documents/referral-extraction.js";
import { buildPageOcrArtifact } from "../../src/lib/biomarkers/ocr-artifact.js";
import {
  ocrFulltextPath,
  ocrPageJsonPath,
  pagePreviewObjectPath,
  resolveOriginalStoragePath,
  thumbnailObjectPath,
} from "../../src/lib/documents/paths.js";
import {
  classifyDocumentFromImage,
  classifyDocumentFromText,
  computeTypeMismatch,
} from "../../src/lib/documents/type-classification.js";
import { normalizeDocumentType, type DocumentType } from "../../src/lib/health-systems.js";
import {
  instrumentalSnapshotDigest,
  normalizeInstrumentalSnapshot,
  type FinalizeInstrumentalPublicationArgs,
  type FinalizeInstrumentalPublicationRow,
  type InstrumentalPublicationCompletion,
  type InstrumentalSnapshotInput,
  type PrepareInstrumentalPublicationArgs,
  type PrepareInstrumentalPublicationRow,
} from "../../src/lib/documents/instrumental-publication.js";
import { finalizeDocumentProcessing } from "./document-completion.js";
import { modelIdForStage, resolveModelForStage, type AiProviderId } from "./ai.js";
import {
  makePipelineTrace,
  runClassifyTextOrImage,
  runStageTextOrImage,
} from "./pipeline-llm.js";
import { extractPdfText, generatePagePreviews, generateThumbnail } from "./previews.js";
import { LAB_DOCUMENTS_BUCKET, supabase } from "./supabase.js";

type JobRow = {
  id: string;
  document_id: string;
  profile_id: string;
  attempts: number;
  max_attempts: number;
  processing_attempt_id: string;
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

type SupabaseMutationResult = {
  error: { message: string } | null;
};

function requireMutationSuccess<T extends SupabaseMutationResult>(
  result: T,
  operation: string
): T {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message}`);
  }
  return result;
}

async function uploadToLabDocuments(
  storagePath: string,
  body: Buffer | string,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage.from(LAB_DOCUMENTS_BUCKET).upload(storagePath, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Storage upload failed (${storagePath}): ${error.message}`);
  }
}

export async function failJob(
  job: Pick<JobRow, "processing_attempt_id">,
  message: string
) {
  const { error } = await supabase.rpc("fail_document_processing_attempt", {
    p_attempt_id: job.processing_attempt_id,
    p_message: message,
  });
  if (error) {
    throw new Error(`fail document processing attempt: ${error.message}`);
  }
}

async function runTextOrImageExtraction<T>(
  ocrText: string,
  pageBuffer: Buffer,
  provider: AiProviderId,
  profileId: string,
  documentId: string,
  filename: string,
  fromText: (
    text: string,
    model: import("ai").LanguageModel,
    filename: string,
    ctx: import("../../src/lib/ai/pipeline-trace.js").PipelineLlmContext
  ) => Promise<T>,
  fromImage: (
    buffer: Buffer,
    model: import("ai").LanguageModel,
    filename: string,
    ctx: import("../../src/lib/ai/pipeline-trace.js").PipelineLlmContext
  ) => Promise<T>
): Promise<{ result: T; modelId: string }> {
  return runStageTextOrImage({
    ocrText,
    pageBuffer,
    provider,
    profileId,
    documentId,
    filename,
    textStage: "extract_text",
    visionStage: "extract_vision",
    runText: fromText,
    runImage: (buffer, model, name, ctx) => fromImage(buffer, model, name, ctx),
  });
}

async function clearPriorExtractions(documentId: string, documentType: string) {
  if (documentType === "lab_result") {
    // Keep immutable extracted evidence and its append-only normalization audit trail.
    // The next extraction rows use the default `is_current = true` value.
    requireMutationSuccess(await supabase
      .from("document_extracted_biomarkers")
      .update({ is_current: false, superseded_at: new Date().toISOString() })
      .eq("document_id", documentId)
      .eq("is_current", true), "supersede prior laboratory extractions");
  } else {
    requireMutationSuccess(
      await supabase.from("document_extracted_biomarkers").delete().eq("document_id", documentId),
      "clear prior extracted biomarkers"
    );
    // EH-105 owns instrumental replacement in a single database transaction.
    // Deleting observations here would erase the prior current source snapshot
    // before its replacement has been safely materialized.
    if (documentType !== "instrumental_report") {
      requireMutationSuccess(
        await supabase.from("observations").delete().eq("document_id", documentId),
        "clear prior non-instrumental observations"
      );
    }
  }
  requireMutationSuccess(
    await supabase.from("document_extracted_clinical_notes").delete().eq("document_id", documentId),
    "clear prior extracted clinical notes"
  );
  requireMutationSuccess(
    await supabase.from("document_extracted_prescriptions").delete().eq("document_id", documentId),
    "clear prior extracted prescriptions"
  );
  requireMutationSuccess(
    await supabase.from("document_extracted_referrals").delete().eq("document_id", documentId),
    "clear prior extracted referrals"
  );
  requireMutationSuccess(
    await supabase.from("document_pages").delete().eq("document_id", documentId),
    "clear prior document pages"
  );
}

async function prepareInstrumentalPublicationRpc(
  job: JobRow,
  documentId: string,
  snapshot: InstrumentalSnapshotInput
): Promise<PrepareInstrumentalPublicationRow> {
  const args: PrepareInstrumentalPublicationArgs = {
    p_document_id: documentId,
    p_job_id: job.id,
    p_processing_attempt_id: job.processing_attempt_id,
    p_snapshot: snapshot,
    p_caller_digest: instrumentalSnapshotDigest(snapshot),
  };
  const { data, error } = await supabase.rpc("prepare_instrumental_publication", args);
  if (error) {
    throw new Error(`prepare instrumental publication: ${error.message}`);
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | PrepareInstrumentalPublicationRow
    | undefined;
  if (!row?.publication_id) {
    throw new Error("prepare instrumental publication returned no row");
  }
  return row;
}

async function finalizeInstrumentalPublicationRpc(
  job: JobRow,
  documentId: string,
  prepared: PrepareInstrumentalPublicationRow,
  summaryText: string | null,
  completion: InstrumentalPublicationCompletion
): Promise<FinalizeInstrumentalPublicationRow> {
  const args: FinalizeInstrumentalPublicationArgs = {
    p_document_id: documentId,
    p_job_id: job.id,
    p_processing_attempt_id: job.processing_attempt_id,
    p_publication_id: prepared.publication_id,
    p_snapshot_content_id: prepared.snapshot_content_id,
    p_canonicalization_version: prepared.canonicalization_version,
    p_snapshot_hash: prepared.snapshot_hash,
    p_summary_text: summaryText,
    p_completion: completion,
  };
  const { data, error } = await supabase.rpc("finalize_instrumental_publication", args);
  if (error) {
    throw new Error(`finalize instrumental publication: ${error.message}`);
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | FinalizeInstrumentalPublicationRow
    | undefined;
  if (!row?.publication_id) {
    throw new Error("finalize instrumental publication returned no row");
  }
  return row;
}

export async function runPipeline(job: JobRow): Promise<"failed" | "completed"> {
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select(
      "id, profile_id, storage_path, original_storage_path, original_filename, mime_type, document_type"
    )
    .eq("id", job.document_id)
    .single();

  if (docError || !document) {
    await failJob(job, docError?.message ?? "Document not found");
    return "failed";
  }

  const doc = document as DocumentRow;
  const documentType = normalizeDocumentType(doc.document_type) ?? "lab_result";
  const storagePath = resolveOriginalStoragePath(doc);
  const mimeType =
    doc.mime_type ??
    (doc.original_filename.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg");

  requireMutationSuccess(await supabase
    .from("documents")
    .update({
      processing_status: "processing",
      status: "processing",
      type_mismatch_warning: false,
      type_mismatch_reason: null,
      detected_document_type: null,
    })
    .eq("id", doc.id), "mark document processing");

  await clearPriorExtractions(doc.id, documentType);

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(LAB_DOCUMENTS_BUCKET)
    .download(storagePath);

  if (downloadError || !fileData) {
    await failJob(job, downloadError?.message ?? "Download failed");
    return "failed";
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const profileId = doc.profile_id;
  const documentId = doc.id;

  let pages;
  try {
    pages = await generatePagePreviews(buffer, mimeType, doc.original_filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview generation failed";
    await failJob(job, message);
    return "failed";
  }

  const thumbBuffer = await generateThumbnail(pages[0].buffer);
  const thumbPath = thumbnailObjectPath(profileId, documentId);
  await uploadToLabDocuments(thumbPath, thumbBuffer, "image/webp");

  let ocrText = "";
  if (mimeType === "application/pdf") {
    ocrText = await extractPdfText(buffer);
    const ocrPath = ocrFulltextPath(profileId, documentId);
    await uploadToLabDocuments(ocrPath, ocrText, "text/plain");
  }

  for (const page of pages) {
    const previewPath = pagePreviewObjectPath(profileId, documentId, page.pageNumber);
    await uploadToLabDocuments(previewPath, page.buffer, "image/webp");

    // Page OCR artifact (schema_version 1). Full PDF text stored on page 1 when available.
    let ocrJsonPath: string | null = null;
    if (ocrText && page.pageNumber === 1) {
      const artifact = buildPageOcrArtifact({
        engine: mimeType === "application/pdf" ? "pdf-text" : "none",
        page_number: page.pageNumber,
        full_text: ocrText,
        width: page.width,
        height: page.height,
      });
      ocrJsonPath = ocrPageJsonPath(profileId, documentId, page.pageNumber);
      await uploadToLabDocuments(
        ocrJsonPath,
        Buffer.from(JSON.stringify(artifact), "utf8"),
        "application/json"
      );
    }

    requireMutationSuccess(
      await supabase.from("document_pages").insert({
        document_id: documentId,
        profile_id: profileId,
        page_number: page.pageNumber,
        width: page.width,
        height: page.height,
        preview_storage_path: previewPath,
        ocr_text: page.pageNumber === 1 && ocrText ? ocrText.slice(0, 50000) : null,
        ocr_json_storage_path: ocrJsonPath,
      }),
      "write document page"
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", profileId)
    .single();

  const provider = (profile?.ai_provider as AiProviderId | null) ?? "openai";

  let detectedDocumentType: string | null = null;
  let typeMismatchWarning = false;
  let typeMismatchReason: string | null = null;

  try {
    const classification = await runClassifyTextOrImage({
      ocrText,
      pageBuffer: pages[0].buffer,
      provider,
      profileId,
      documentId,
      filename: doc.original_filename,
      runText: (text, model, filename, ctx) =>
        classifyDocumentFromText(text, model, filename, ctx),
      runImage: (image, model, filename, ctx) =>
        classifyDocumentFromImage(image, "image/webp", model, filename, ctx),
    });

    const mismatch = computeTypeMismatch(documentType, classification);
    detectedDocumentType = mismatch.detectedType;
    typeMismatchWarning = mismatch.warning;
    typeMismatchReason = mismatch.warning ? mismatch.reason : null;
  } catch (error) {
    console.error("[pipeline] classification failed:", error);
  }

  let processingStatus = "ready";
  let observedAt: string | null = null;
  let labName: string | null = null;
  let modality: string | null = null;
  let documentSummary: string | null = null;
  let structuredPayload: unknown = null;
  let extractionModel: string | null = null;

  try {
    if (documentType === "lab_result") {
      const { result: extraction, modelId } = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        provider,
        profileId,
        documentId,
        doc.original_filename,
        (text, model, filename, ctx) => extractPipelineBiomarkersFromText(text, model, filename, ctx),
        (image, model, filename, ctx) =>
          extractPipelineBiomarkersFromImage(image, "image/webp", model, filename, ctx)
      );

      extractionModel = modelId;
      structuredPayload = extraction;
      observedAt = extraction.observed_at;
      labName = extraction.lab_name;

      if (extraction.biomarkers.length > 0) {
        requireMutationSuccess(
          await supabase.from("document_extracted_biomarkers").insert(
            extraction.biomarkers.map((b) => {
              const anyB = b as {
                key: string;
                name: string;
                value: number | null;
                value_text?: string | null;
                value_kind?: string | null;
                ordinal?: number | null;
                unit: string;
                ref_low?: number | null;
                ref_high?: number | null;
                source_page?: number | null;
                source_text?: string | null;
                confidence?: number | null;
                specimen?: string | null;
                modifier?: string | null;
                reported_alt_value?: number | null;
                reported_alt_unit?: string | null;
              };
              return {
                document_id: documentId,
                profile_id: profileId,
                biomarker_key: anyB.key,
                biomarker_name: anyB.name,
                raw_name: anyB.name,
                value_numeric: anyB.value,
                value_text: anyB.value_text ?? (anyB.value != null ? String(anyB.value) : null),
                value_kind: anyB.value_kind ?? (anyB.value != null ? "numeric" : "text"),
                ordinal: anyB.ordinal ?? null,
                unit: anyB.unit,
                raw_unit: anyB.unit,
                raw_value_text: anyB.value_text ?? (anyB.value != null ? String(anyB.value) : null),
                reference_range: formatReferenceRange(anyB.ref_low ?? null, anyB.ref_high ?? null),
                raw_reference_range: formatReferenceRange(anyB.ref_low ?? null, anyB.ref_high ?? null),
                section_context: null,
                source_page: anyB.source_page ?? 1,
                source_text: anyB.source_text,
                confidence: anyB.confidence,
                specimen: anyB.specimen ?? null,
                modifier: anyB.modifier ?? null,
                reported_alt_value: anyB.reported_alt_value ?? null,
                reported_alt_unit: anyB.reported_alt_unit ?? null,
                extraction_method: "llm",
                processing_version: DOCUMENT_PROCESSING_VERSION,
                extraction_model: extractionModel,
                status: "needs_review",
                is_current: true,
              };
            })
          ),
          "write extracted laboratory biomarkers"
        );
        processingStatus = "needs_review";
      }

      const summaryModel = resolveModelForStage(provider, "summarize");
      const summaryCtx = makePipelineTrace(provider, profileId, documentId, "summarize");
      documentSummary = await generateDocumentSummary(
        summaryModel,
        documentType as DocumentType,
        extraction,
        doc.original_filename,
        summaryCtx
      );
    } else if (documentType === "instrumental_report") {
      const { result: extraction, modelId } = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        provider,
        profileId,
        documentId,
        doc.original_filename,
        (text, model, filename, ctx) => extractInstrumentalFromText(text, model, filename, ctx),
        (image, model, filename, ctx) =>
          extractInstrumentalFromImage(image, "image/webp", model, filename, ctx)
      );

      extractionModel = modelId;
      structuredPayload = extraction;
      observedAt = extraction.study_date;
      labName = extraction.facility_name;
      modality = extraction.modality;

      // Stage the immutable snapshot (measures, findings, impression) as an
      // inactive prepared publication; readers keep seeing the prior current
      // version until the finalizer commits.
      const snapshot = normalizeInstrumentalSnapshot({
        study_date:
          extraction.study_date ?? new Date().toISOString().slice(0, 10),
        modality: extraction.modality,
        body_region: extraction.body_region,
        facility_name: extraction.facility_name,
        impression: extraction.impression,
        processing_version: DOCUMENT_PROCESSING_VERSION,
        extraction_model: extractionModel,
        measures: extraction.numeric_measures,
        findings: extraction.findings,
      });

      const prepared = await prepareInstrumentalPublicationRpc(job, documentId, snapshot);

      const summaryModel = resolveModelForStage(provider, "summarize");
      const summaryCtx = makePipelineTrace(provider, profileId, documentId, "summarize");
      documentSummary = await generateDocumentSummary(
        summaryModel,
        documentType as DocumentType,
        extraction,
        doc.original_filename,
        summaryCtx
      );

      // One transaction: publish measures/findings/impression/summary,
      // supersede the prior publication, advance write_generation, complete
      // the document/job/attempt, and invalidate synthesis.
      await finalizeInstrumentalPublicationRpc(job, documentId, prepared, documentSummary, {
        page_count: pages.length,
        thumbnail_storage_path: thumbPath,
        ocr_status: ocrText ? "completed" : "skipped",
        extraction_status: "completed",
        detected_document_type: detectedDocumentType,
        type_mismatch_warning: typeMismatchWarning,
        type_mismatch_reason: typeMismatchReason,
      });

      return "completed";
    } else if (documentType === "consultation_note") {
      const { result: extraction, modelId } = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        provider,
        profileId,
        documentId,
        doc.original_filename,
        (text, model, filename, ctx) => extractConsultationFromText(text, model, filename, ctx),
        (image, model, filename, ctx) =>
          extractConsultationFromImage(image, "image/webp", model, filename, ctx)
      );

      extractionModel = modelId;
      structuredPayload = extraction;
      observedAt = extraction.visit_date;
      labName = extraction.provider_name;

      await supabase.from("document_extracted_clinical_notes").insert({
        document_id: documentId,
        profile_id: profileId,
        note_kind: "consultation",
        provider_name: extraction.provider_name,
        visit_date: extraction.visit_date,
        chief_complaint: extraction.chief_complaint,
        history_summary: extraction.history_summary,
        exam_findings: extraction.exam_findings,
        documented_problems: extraction.documented_problems,
        recommendations: extraction.recommendations,
        follow_up_plan: extraction.follow_up_plan,
        extraction_method: "llm",
        processing_version: DOCUMENT_PROCESSING_VERSION,
        extraction_model: extractionModel,
        status: "accepted",
      });

      documentSummary = await generateDocumentSummary(
        resolveModelForStage(provider, "summarize"),
        documentType as DocumentType,
        extraction,
        doc.original_filename,
        makePipelineTrace(provider, profileId, documentId, "summarize")
      );
    } else if (documentType === "discharge_summary") {
      const { result: extraction, modelId } = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        provider,
        profileId,
        documentId,
        doc.original_filename,
        (text, model, filename, ctx) => extractDischargeFromText(text, model, filename, ctx),
        (image, model, filename, ctx) =>
          extractDischargeFromImage(image, "image/webp", model, filename, ctx)
      );

      extractionModel = modelId;
      structuredPayload = extraction;
      observedAt = extraction.discharge_date ?? extraction.admission_date;
      labName = extraction.provider_name;

      await supabase.from("document_extracted_clinical_notes").insert({
        document_id: documentId,
        profile_id: profileId,
        note_kind: "discharge",
        provider_name: extraction.provider_name,
        visit_date: extraction.discharge_date,
        admission_date: extraction.admission_date,
        discharge_date: extraction.discharge_date,
        hospital_course: extraction.hospital_course,
        discharge_diagnoses: extraction.discharge_diagnoses,
        discharge_medications: extraction.discharge_medications,
        follow_up_instructions: extraction.follow_up_instructions,
        chief_complaint: null,
        history_summary: extraction.history_summary,
        exam_findings: extraction.exam_findings,
        documented_problems: extraction.documented_problems,
        recommendations: extraction.recommendations,
        follow_up_plan: extraction.follow_up_plan,
        extraction_method: "llm",
        processing_version: DOCUMENT_PROCESSING_VERSION,
        extraction_model: extractionModel,
        status: "accepted",
      });

      documentSummary = await generateDocumentSummary(
        resolveModelForStage(provider, "summarize"),
        documentType as DocumentType,
        extraction,
        doc.original_filename,
        makePipelineTrace(provider, profileId, documentId, "summarize")
      );
    } else if (documentType === "prescription") {
      const { result: extraction, modelId } = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        provider,
        profileId,
        documentId,
        doc.original_filename,
        (text, model, filename, ctx) => extractPrescriptionFromText(text, model, filename, ctx),
        (image, model, filename, ctx) =>
          extractPrescriptionFromImage(image, "image/webp", model, filename, ctx)
      );

      extractionModel = modelId;
      structuredPayload = extraction;
      observedAt = extraction.prescribed_at;
      labName = extraction.prescriber_name;

      await supabase.from("document_extracted_prescriptions").insert({
        document_id: documentId,
        profile_id: profileId,
        prescriber_name: extraction.prescriber_name,
        prescribed_at: extraction.prescribed_at,
        medications: extraction.medications,
        extraction_method: "llm",
        processing_version: DOCUMENT_PROCESSING_VERSION,
        extraction_model: extractionModel,
        status: "accepted",
      });

      documentSummary = await generateDocumentSummary(
        resolveModelForStage(provider, "summarize"),
        documentType as DocumentType,
        extraction,
        doc.original_filename,
        makePipelineTrace(provider, profileId, documentId, "summarize")
      );
    } else if (documentType === "referral") {
      const { result: extraction, modelId } = await runTextOrImageExtraction(
        ocrText,
        pages[0].buffer,
        provider,
        profileId,
        documentId,
        doc.original_filename,
        (text, model, filename, ctx) => extractReferralFromText(text, model, filename, ctx),
        (image, model, filename, ctx) =>
          extractReferralFromImage(image, "image/webp", model, filename, ctx)
      );

      extractionModel = modelId;
      structuredPayload = extraction;
      observedAt = extraction.referral_date;
      labName = extraction.referring_provider;

      await supabase.from("document_extracted_referrals").insert({
        document_id: documentId,
        profile_id: profileId,
        referring_provider: extraction.referring_provider,
        referred_to_specialty: extraction.referred_to_specialty,
        referred_to_provider: extraction.referred_to_provider,
        referral_date: extraction.referral_date,
        reason_for_referral: extraction.reason_for_referral,
        clinical_summary: extraction.clinical_summary,
        urgency: extraction.urgency,
        extraction_method: "llm",
        processing_version: DOCUMENT_PROCESSING_VERSION,
        extraction_model: extractionModel,
        status: "accepted",
      });

      documentSummary = await generateDocumentSummary(
        resolveModelForStage(provider, "summarize"),
        documentType as DocumentType,
        extraction,
        doc.original_filename,
        makePipelineTrace(provider, profileId, documentId, "summarize")
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    await failJob(job, message);
    return "failed";
  }

  const completionOutcome = await finalizeDocumentProcessing({
    async complete() {
      const { error } = await supabase.rpc("complete_document_processing_attempt", {
        p_attempt_id: job.processing_attempt_id,
        p_document: {
          processing_status: processingStatus,
          page_count: pages.length,
          thumbnail_storage_path: thumbPath,
          processing_version: DOCUMENT_PROCESSING_VERSION,
          extraction_model: extractionModel,
          lab_name: labName,
          observed_at: observedAt,
          modality,
          document_summary: documentSummary,
          ocr_status: ocrText ? "completed" : "skipped",
          extraction_status: "completed",
          detected_document_type: detectedDocumentType,
          type_mismatch_warning: typeMismatchWarning,
          type_mismatch_reason: typeMismatchReason,
        },
      });
      if (error) {
        throw new Error(`complete document processing: ${error.message}`);
      }
    },
    async writeFailure(message) {
      await failJob(job, message);
    },
  });
  if (completionOutcome === "failed") return "failed";

  void structuredPayload;

  return "completed";
}
