import type { LanguageModel } from "ai";
import type { PipelineLlmContext } from "../../src/lib/ai/pipeline-trace.js";
import { workerEnv } from "./env.js";
import { processMistralOcr } from "./ocr/mistral.js";
import { selectOcrSource } from "./ocr/select.js";
import { OcrProviderError, type OcrDocument } from "./ocr/types.js";
import { createHash } from "node:crypto";
import {
  DOCUMENT_PROCESSING_VERSION,
} from "../../src/lib/documents/constants.js";
import {
  isAutomaticVerificationReleaseApproved,
} from "../../src/lib/documents/normalization-policy.js";
import {
  writeAutomaticBiomarkerVerification,
  type ExtractedBiomarkerWriterRow,
} from "../../src/lib/documents/observation-normalization-writer.js";
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
import {
  buildPageOcrArtifactV2,
  type PageOcrBlock,
} from "../../src/lib/biomarkers/ocr-artifact.js";
import {
  buildPageMarkedText,
  type PdfLayoutPage,
} from "../../src/lib/documents/pdf-text-layout.js";
import {
  buildSourceIndex,
  resolveSourceRegion,
  type SourceIndexPage,
} from "../../src/lib/documents/source-region-match.js";
import {
  attemptOcrFulltextPath,
  attemptOcrPageJsonPath,
  attemptPagePreviewObjectPath,
  attemptThumbnailObjectPath,
  resolveOriginalStoragePath,
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
import {
  buildMedicalEventDateSync,
  calendarDateProjection,
  type MedicalEventDateRole,
  type MedicalEventDateSync,
} from "../../src/lib/documents/medical-events.js";
import { finalizeDocumentProcessing } from "./document-completion.js";
import { modelIdForStage, resolveModelForStage, type AiProviderId } from "./ai.js";
import {
  makePipelineTrace,
  runClassifyTextOrImage,
  runStageTextOrImage,
} from "./pipeline-llm.js";
import { extractPdfPageIndex, generatePagePreviews, generateThumbnail } from "./previews.js";
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

function consistentSourceDate(values: readonly unknown[]): string | null {
  const candidates = values.flatMap((value) =>
    typeof value === "string" && value.trim() ? [value.trim()] : []
  );
  if (candidates.length === 0) return null;
  const first = candidates[0];
  return candidates.every((candidate) => candidate === first) ? first : null;
}

async function syncMedicalEventDates(
  documentId: string,
  dates: Partial<Record<MedicalEventDateRole, unknown>>,
): Promise<void> {
  const payload: MedicalEventDateSync[] = Object.entries(dates).map(([role, value]) =>
    buildMedicalEventDateSync(role as MedicalEventDateRole, value)
  );
  const { error } = await supabase.rpc("eh126_sync_document_event_dates", {
    p_document_id: documentId,
    p_dates: payload,
  });
  if (error) {
    throw new Error(`sync medical event dates: ${error.message}`);
  }
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

function lifecycleRequestHash(documentId: string, processingAttemptId: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        documentId,
        processingAttemptId,
        operation: "document_reprocessed",
      }),
    )
    .digest("hex");
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
    model: LanguageModel,
    filename: string,
    ctx: PipelineLlmContext
  ) => Promise<T>,
  fromImage: (
    buffer: Buffer,
    model: LanguageModel,
    filename: string,
    ctx: PipelineLlmContext
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
function layoutPagesFromOcrDocument(
  ocrDocument: OcrDocument,
  renderedPages: readonly { pageNumber: number; width: number; height: number }[],
): PdfLayoutPage[] {
  return ocrDocument.pages.map((page) => {
    const rendered = renderedPages[page.pageNumber - 1];
    return {
      page_number: page.pageNumber,
      width: page.width ?? rendered?.width ?? 1,
      height: page.height ?? rendered?.height ?? 1,
      text: page.plainText,
      lines: [],
    };
  });
}

async function recordOcrInvocation(input: {
  profileId: string;
  documentId: string;
  processingAttemptId: string;
  modelId: string | null;
  inputBytes: number;
  pagesProcessed: number;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
  requestId: string | null;
}): Promise<void> {
  const { error } = await supabase.from("ai_invocations").insert({
    profile_id: input.profileId,
    document_id: input.documentId,
    stage: "ocr",
    provider: "mistral",
    model_id: input.modelId ?? workerEnv.mistralOcrModel,
    latency_ms: input.latencyMs,
    input_tokens: null,
    output_tokens: null,
    success: input.success,
    error_code: input.errorCode,
    provider_switch: false,
    region: workerEnv.mistralOcrRegion,
    input_bytes: input.inputBytes,
    pages_processed: input.pagesProcessed,
    request_id: input.requestId,
    estimated_cost_usd: input.pagesProcessed * workerEnv.mistralOcrPageCostUsd,
    processing_attempt_id: input.processingAttemptId,
  });
  if (error) {
    console.error("[pipeline] OCR invocation telemetry write failed:", error.message);
  }
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
  const processingAttemptId = job.processing_attempt_id;

  let pages;
  try {
    pages = await generatePagePreviews(buffer, mimeType, doc.original_filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview generation failed";
    await failJob(job, message);
    return "failed";
  }

  const thumbBuffer = await generateThumbnail(pages[0].buffer);
  const thumbPath = attemptThumbnailObjectPath(profileId, documentId, processingAttemptId);
  await uploadToLabDocuments(thumbPath, thumbBuffer, "image/webp");

  // EH-118: the page index is the provenance ground truth. Word geometry comes
  // from poppler when the PDF has a complete text layer; Mistral blocks remain
  // coarse metadata and do not become exact clinical row geometry.
  let layoutPages: PdfLayoutPage[] = [];
  if (mimeType === "application/pdf") {
    layoutPages = await extractPdfPageIndex(buffer);
  }
  const popplerPageMarkedText =
    layoutPages.length > 0 ? buildPageMarkedText(layoutPages) : "";
  const pageCount = pages.length;
  const ocrSelection = selectOcrSource({
    mimeType,
    renderedPageCount: pageCount,
    layoutPages,
    pageMarkedText: popplerPageMarkedText,
    mistralEnabled: workerEnv.mistralOcrEnabled,
  });

  let sourceTextOrigin = ocrSelection.sourceTextOrigin;
  let ocrText = ocrSelection.kind === "poppler" ? popplerPageMarkedText : "";
  let ocrDocument: OcrDocument | null = null;
  const sourceSha256 = createHash("sha256").update(buffer).digest("hex");

  if (ocrSelection.kind === "mistral") {
    const startedAt = Date.now();
    try {
      ocrDocument = await processMistralOcr({
        buffer,
        mimeType,
        expectedPageCount: pageCount,
      });
      layoutPages = layoutPagesFromOcrDocument(ocrDocument, pages);
      ocrText = buildPageMarkedText(layoutPages);
      await recordOcrInvocation({
        profileId,
        documentId,
        processingAttemptId,
        modelId: ocrDocument.model,
        inputBytes: buffer.length,
        pagesProcessed: ocrDocument.usage.pagesProcessed ?? pageCount,
        latencyMs: Date.now() - startedAt,
        success: true,
        errorCode: null,
        requestId: null,
      });
    } catch (error) {
      const providerError =
        error instanceof OcrProviderError
          ? error
          : new OcrProviderError("ocr_provider_unavailable");
      await recordOcrInvocation({
        profileId,
        documentId,
        processingAttemptId,
        modelId: null,
        inputBytes: buffer.length,
        pagesProcessed: pageCount,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorCode: providerError.code,
        requestId: providerError.requestId,
      });
      if (
        workerEnv.mistralOcrFailureMode !== "legacy_vision" ||
        process.env.NODE_ENV === "production"
      ) {
        await failJob(job, providerError.code);
        return "failed";
      }
      sourceTextOrigin = "vision_model";
      layoutPages = [];
    }
  } else if (ocrSelection.kind === "unavailable") {
    if (process.env.NODE_ENV === "production") {
      await failJob(job, "ocr_provider_unavailable");
      return "failed";
    }
    layoutPages = [];
  }

  if (ocrText.trim()) {
    await uploadToLabDocuments(
      attemptOcrFulltextPath(profileId, documentId, processingAttemptId),
      ocrText,
      "text/plain"
    );
  }
  const sourceIndex: SourceIndexPage[] = buildSourceIndex(layoutPages);
  const ocrProvider = ocrDocument ? "mistral" : ocrSelection.kind === "poppler" ? "poppler" : null;
  const ocrModel = ocrDocument?.model ?? null;
  const ocrAdapterVersion = ocrDocument?.adapterVersion ?? workerEnv.mistralOcrAdapterVersion;

  for (const page of pages) {
    const previewPath = attemptPagePreviewObjectPath(
      profileId,
      documentId,
      processingAttemptId,
      page.pageNumber
    );
    await uploadToLabDocuments(previewPath, page.buffer, "image/webp");

    const layout = layoutPages.find((candidate) => candidate.page_number === page.pageNumber);
    const ocrPage = ocrDocument?.pages.find((candidate) => candidate.pageNumber === page.pageNumber);
    const pageText = layout?.text.trim() ? layout.text : "";
    const blocks: PageOcrBlock[] =
      ocrPage?.blocks.map((block) => ({
        text: block.text,
        confidence: block.confidence,
        bbox: block.bbox,
      })) ??
      layout?.lines.map((line) => ({ text: line.text, bbox: line.bbox })) ??
      [];
    let ocrJsonPath: string | null = null;
    if (ocrProvider && (ocrPage || pageText)) {
      const artifact = buildPageOcrArtifactV2({
        provider: ocrProvider,
        engine: ocrDocument?.engine ?? "poppler-bbox-layout",
        model: ocrModel,
        adapter_version: ocrAdapterVersion,
        source_sha256: ocrDocument?.sourceSha256 ?? sourceSha256,
        page_number: page.pageNumber,
        width: layout?.width ?? page.width,
        height: layout?.height ?? page.height,
        full_text: pageText,
        markdown: ocrPage?.markdown ?? pageText,
        blocks,
      });
      ocrJsonPath = attemptOcrPageJsonPath(
        profileId,
        documentId,
        processingAttemptId,
        page.pageNumber
      );
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
        processing_attempt_id: processingAttemptId,
        is_current: false,
        page_number: page.pageNumber,
        width: page.width,
        height: page.height,
        preview_storage_path: previewPath,
        ocr_text: pageText ? pageText.slice(0, 50000) : null,
        ocr_json_storage_path: ocrJsonPath,
      }),
      "write document page"
    );
  }

  // EH-118: ground every extracted row against the page index. The model page
  // hint is only a hint; a unique OCR match overrides it, and anything
  // ambiguous degrades to page-only provenance rather than a misplaced box.
  const resolveProvenance = (
    hintedPage: number | null | undefined,
    snippet: string | null | undefined
  ) => resolveSourceRegion({ pages: sourceIndex, pageCount, snippet, hintedPage });

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

  const pendingAutomaticVerificationRows: ExtractedBiomarkerWriterRow[] = [];
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
      await syncMedicalEventDates(documentId, {
        occurred: observedAt,
        collected: consistentSourceDate(extraction.biomarkers.map((row) => row.collected_at)),
        authored: consistentSourceDate(extraction.biomarkers.map((row) => row.reported_at)),
      });

      if (extraction.biomarkers.length > 0) {
        const insertedBiomarkers = requireMutationSuccess(
          await supabase
            .from("document_extracted_biomarkers")
            .insert(
              extraction.biomarkers.map((b) => {
                const anyB = b as {
                  key: string;
                  name: string;
                  raw_name?: string | null;
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
                  collected_at?: string | null;
                  reported_at?: string | null;
                  inferred_axes?: unknown;
                };
                const provenance = resolveProvenance(anyB.source_page, anyB.source_text);
                return {
                  document_id: documentId,
                  profile_id: profileId,
                  processing_attempt_id: processingAttemptId,
                  biomarker_key: anyB.key,
                  biomarker_name: anyB.name,
                  raw_name: anyB.raw_name ?? anyB.name,
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
                  source_page: provenance.page,
                  bounding_box: provenance.region,
                  source_text: anyB.source_text,
                  confidence: anyB.confidence,
                  reported_alt_value: anyB.reported_alt_value ?? null,
                  reported_alt_unit: anyB.reported_alt_unit ?? null,
                  collected_at: calendarDateProjection(anyB.collected_at),
                  reported_at: calendarDateProjection(anyB.reported_at),
                  // #106: observability only, never read by the resolver.
                  inferred_axes: anyB.inferred_axes ?? null,
                  extraction_method: "llm",
                  processing_version: DOCUMENT_PROCESSING_VERSION,
                  extraction_model: extractionModel,
                  source_text_origin: sourceTextOrigin,
                  ocr_provider: ocrProvider,
                  ocr_model: ocrModel,
                  ocr_adapter_version: ocrProvider ? ocrAdapterVersion : null,
                  ocr_artifact_schema_version: ocrProvider ? 2 : null,
                  ocr_source_sha256: ocrProvider ? sourceSha256 : null,
                  status: "needs_review",
                  is_current: true,
                  is_published: false,
                };
              })
            )
            .select(),
          "write extracted laboratory biomarkers"
        );
        const insertedRows = (insertedBiomarkers.data ?? []) as unknown as ExtractedBiomarkerWriterRow[];
        if (insertedRows.length !== extraction.biomarkers.length) {
          throw new Error("write extracted laboratory biomarkers returned an incomplete row set");
        }
        pendingAutomaticVerificationRows.push(...insertedRows);
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
      await syncMedicalEventDates(documentId, { occurred: observedAt });

      // The legacy instrumental publication snapshot has a day-level date
      // projection. The event row above retains any month/year precision.
      // Missing/partial source dates therefore stay null in the snapshot.
      const snapshot = normalizeInstrumentalSnapshot({
        study_date: calendarDateProjection(extraction.study_date),
        modality: extraction.modality,
        body_region: extraction.body_region,
        facility_name: extraction.facility_name,
        impression: extraction.impression,
        processing_version: DOCUMENT_PROCESSING_VERSION,
        extraction_model: extractionModel,
        measures: extraction.numeric_measures.map((measure) => {
          const provenance = resolveProvenance(measure.source_page, measure.source_text);
          return {
            ...measure,
            source_page: provenance.page,
            bounding_box: provenance.region,
          };
        }),
        findings: extraction.findings.map((finding) => ({
          ...finding,
          source_page: resolveProvenance(finding.source_page, finding.source_text).page,
        })),
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
        content_sha256: sourceSha256,
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
      await syncMedicalEventDates(documentId, { occurred: observedAt });

      requireMutationSuccess(
        await supabase.from("document_extracted_clinical_notes").insert({
          document_id: documentId,
          profile_id: profileId,
          processing_attempt_id: processingAttemptId,
          is_published: false,
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
        }),
        "write extracted clinical note"
      );

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
      observedAt = extraction.admission_date ?? extraction.discharge_date;
      labName = extraction.provider_name;
      await syncMedicalEventDates(documentId, {
        occurred: extraction.admission_date,
        occurred_end: extraction.discharge_date,
      });

      requireMutationSuccess(
        await supabase.from("document_extracted_clinical_notes").insert({
          document_id: documentId,
          profile_id: profileId,
          processing_attempt_id: processingAttemptId,
          is_published: false,
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
        }),
        "write extracted discharge note"
      );

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
      await syncMedicalEventDates(documentId, { occurred: observedAt });

      requireMutationSuccess(
        await supabase.from("document_extracted_prescriptions").insert({
          document_id: documentId,
          profile_id: profileId,
          processing_attempt_id: processingAttemptId,
          is_published: false,
          prescriber_name: extraction.prescriber_name,
          prescribed_at: extraction.prescribed_at,
          medications: extraction.medications,
          extraction_method: "llm",
          processing_version: DOCUMENT_PROCESSING_VERSION,
          extraction_model: extractionModel,
          status: "accepted",
        }),
        "write extracted prescription"
      );

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
      await syncMedicalEventDates(documentId, { occurred: observedAt });

      requireMutationSuccess(
        await supabase.from("document_extracted_referrals").insert({
          document_id: documentId,
          profile_id: profileId,
          processing_attempt_id: processingAttemptId,
          is_published: false,
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
        }),
        "write extracted referral"
      );

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
      const lifecycleHash =
        documentType === "lab_result"
          ? lifecycleRequestHash(documentId, job.processing_attempt_id)
          : null;
      const pDocument = {
        processing_status: processingStatus,
        page_count: pages.length,
        thumbnail_storage_path: thumbPath,
        processing_version: DOCUMENT_PROCESSING_VERSION,
        extraction_model: extractionModel,
        content_sha256: sourceSha256,
        lab_name: labName,
        document_summary: documentSummary,
        ocr_status: ocrText ? "completed" : "skipped",
        extraction_status: "completed",
        detected_document_type: detectedDocumentType,
        type_mismatch_warning: typeMismatchWarning,
        type_mismatch_reason: typeMismatchReason,
      };
      const { error } = await supabase.rpc(
        documentType === "lab_result"
          ? "eh120_complete_document_processing_attempt"
          : "complete_document_processing_attempt",
        documentType === "lab_result"
          ? {
              p_attempt_id: job.processing_attempt_id,
              p_document: pDocument,
              p_lifecycle_request_hash: lifecycleHash,
            }
          : {
              p_attempt_id: job.processing_attempt_id,
              p_document: pDocument,
            },
      );
      if (error) {
        throw new Error(`complete document processing: ${error.message}`);
      }
    },
    async writeFailure(message) {
      await failJob(job, message);
    },
  });
  if (completionOutcome === "failed") return "failed";
  if (
    isAutomaticVerificationReleaseApproved() &&
    sourceTextOrigin !== "mistral_ocr"
  ) {
    const automaticObservedAt = calendarDateProjection(observedAt);
    for (const row of pendingAutomaticVerificationRows) {
      try {
        const result = await writeAutomaticBiomarkerVerification({
          profileId,
          documentId,
          observedAt: automaticObservedAt,
          row,
          qualityGateApproved: true,
        });
        if (!("promoted" in result)) {
          console.info("[pipeline] Automatically verified extracted biomarker", {
            documentId,
            extractedBiomarkerId: row.id,
            revisionId: result.revisionId,
          });
        }
      } catch (error) {
        console.error("[pipeline] Automatic biomarker verification skipped:", {
          documentId,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    }
  }


  void structuredPayload;

  return "completed";
}
