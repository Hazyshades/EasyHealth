"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import {
  ConsultationInsightsPanel,
  DischargeInsightsPanel,
  DocumentSummaryCard,
  InstrumentalInsightsPanel,
  PanelDisclaimer,
  PrescriptionInsightsPanel,
  ReferralInsightsPanel,
} from "@/components/documents/document-insight-panels";
import { TypeMismatchBanner } from "@/components/documents/type-mismatch-banner";
import { normalizeDocumentType, type DocumentType } from "@/lib/health-systems";
import {
  fileCacheKey,
  getCachedSignedUrl,
  pageCacheKey,
  setCachedSignedUrl,
} from "@/lib/documents/signed-url-cache";
import {
  measurementMappingGuidance,
  measurementMappingLabel,
  resolveBiomarkerPanelMode,
  resolveBiomarkerReviewAction,
} from "@/lib/documents/biomarker-review-state";
import type { VerificationStatus } from "@/lib/biomarkers";

type DocumentMeta = {
  id: string;
  original_filename: string;
  document_type: string;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  mime_type: string | null;
  page_count: number | null;
  processing_status: string;
  processing_error: string | null;
  is_legacy: boolean;
  has_thumbnail: boolean;
  document_summary: string | null;
  modality: string | null;
  extracted_biomarker_count: number;
  type_mismatch_warning?: boolean;
  type_mismatch_reason?: string | null;
  suggested_document_type?: string | null;
  detected_document_type?: string | null;
};

type InstrumentalFinding = {
  id: string;
  modality: string | null;
  body_region: string | null;
  finding_text: string;
  impression: string | null;
  source_page: number | null;
};

type ClinicalNote = {
  provider_name: string | null;
  visit_date: string | null;
  chief_complaint: string | null;
  history_summary: string | null;
  exam_findings: string | null;
  documented_problems: string[] | null;
  recommendations: string[] | null;
  follow_up_plan: string | null;
};

type PageMeta = {
  page_number: number;
  width: number | null;
  height: number | null;
};

type Observation = {
  id: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  name: string;
  value: number | null;
  value_kind: string;
  value_text: string | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  raw_name: string | null;
  raw_value_text: string | null;
  raw_reference_text: string | null;
  raw_unit: string | null;
  source_page: number | null;
  source_text: string | null;
  extraction_version: string | null;
  provenance_schema_version: string;
  catalog_manifest_version: string | null;
  catalog_manifest_digest: string | null;
  resolver_version: string | null;
  normalization_version: string | null;
};

type ExtractedBiomarker = {
  id: string;
  biomarker_name: string;
  value_numeric: number | null;
  value_text?: string | null;
  value_kind?: string | null;
  unit: string | null;
  reference_range: string | null;
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
  status: string;
  specimen?: string | null;
  modifier?: string | null;
  normalization?: {
    result: "resolved" | "ambiguous" | "partial" | "unmapped";
    candidateDefinitionKey: string | null;
    analyteKey: string | null;
    mappingConfidence: number;
    mappingConfidenceBand: "high" | "medium" | "low";
    candidateEvidence: Array<{
      candidateKey: string;
      accepted: Array<{ code: string }>;
      rejected: Array<{ code: string }>;
    }>;
    manualOptions: Array<{
      key: string;
      displayName: string;
      analyteKey: string;
      maturity: "provisional" | "reviewed" | "retired";
      assessmentBindings: Array<unknown>;
    }>;
    activeRevision: {
      id: string;
      measurement_definition_key: string | null;
      verification_status: VerificationStatus;
    } | null;
    revisions: Array<{
      id: string;
      measurement_definition_key: string | null;
      verification_status: VerificationStatus;
      is_active: boolean;
      catalog_manifest_version: string;
      resolver_version: string;
      normalization_version: string;
    }>;
  };
};

type BootstrapPayload = {
  document: DocumentMeta;
  pages?: PageMeta[];
  instrumental_findings?: InstrumentalFinding[];
  clinical_note?: ClinicalNote | null;
  prescription?: Record<string, unknown> | null;
  referral?: Record<string, unknown> | null;
  extracted_biomarkers?: ExtractedBiomarker[];
  review_data_error?: string | null;
  observations?: Observation[];
  workerOffline?: boolean;
  file?: {
    url: string;
    mimeType: string;
    filename: string;
    expiresIn: number;
  } | null;
  current_page?: {
    url: string;
    pageNumber: number;
    width: number | null;
    height: number | null;
    expiresIn: number;
  } | null;
};

const PROCESSING_POLL_INTERVAL_MS = 8_000;
const PROCESSING_POLL_TIMEOUT_MS = 150_000;

function statusVariant(
  status: string,
): "success" | "warning" | "error" | "neutral" {
  if (status === "ready" || status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "needs_review") return "warning";
  return "warning";
}

function applyExtractedSelection(items: ExtractedBiomarker[]) {
  return new Set(
    items
      .filter(
        (b) => b.status === "needs_review" || b.status === "pending_review",
      )
      .map((b) => b.id),
  );
}

export function DocumentViewer({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams();
  const initialPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const startPage =
    Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1;

  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [currentPage, setCurrentPage] = useState(startPage);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalMime, setOriginalMime] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [extracted, setExtracted] = useState<ExtractedBiomarker[]>([]);
  const [reviewDataError, setReviewDataError] = useState<string | null>(null);
  const [instrumentalFindings, setInstrumentalFindings] = useState<
    InstrumentalFinding[]
  >([]);
  const [clinicalNote, setClinicalNote] = useState<ClinicalNote | null>(null);
  const [prescription, setPrescription] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [referral, setReferral] = useState<Record<string, unknown> | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeSourceText, setActiveSourceText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [confirmingObservations, setConfirmingObservations] = useState(false);
  const [manualSelections, setManualSelections] = useState<
    Record<string, string>
  >({});
  const [normalizingId, setNormalizingId] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workerOffline, setWorkerOffline] = useState(false);
  const [processingStuck, setProcessingStuck] = useState(false);
  const [retryingProcessing, setRetryingProcessing] = useState(false);

  /** Skip page-only fetch once after bootstrap seeds pageUrl for the same page. */
  const skipNextPageFetch = useRef(true);
  const processingStartedAt = useRef<number | null>(null);

  const applyBootstrap = useCallback(
    (data: BootstrapPayload, opts?: { applyPage?: boolean }) => {
      const meta = data.document;
      setDoc(meta);
      setWorkerOffline(Boolean(data.workerOffline));
      if (meta.processing_status !== "processing") {
        processingStartedAt.current = null;
        setProcessingStuck(false);
      }
      setPages(data.pages ?? []);
      setInstrumentalFindings(data.instrumental_findings ?? []);
      setClinicalNote(data.clinical_note ?? null);
      setPrescription(data.prescription ?? null);
      setReferral(data.referral ?? null);

      const items = data.extracted_biomarkers ?? [];
      setExtracted(items);
      setReviewDataError(data.review_data_error ?? null);
      setSelectedIds(applyExtractedSelection(items));
      setObservations(data.observations ?? []);

      if (data.file?.url) {
        setOriginalUrl(data.file.url);
        setOriginalMime(data.file.mimeType);
        setCachedSignedUrl(
          fileCacheKey(documentId),
          data.file.url,
          data.file.expiresIn,
        );
      }

      if (opts?.applyPage !== false && data.current_page?.url) {
        setPageUrl(data.current_page.url);
        setCachedSignedUrl(
          pageCacheKey(documentId, data.current_page.pageNumber),
          data.current_page.url,
          data.current_page.expiresIn,
        );
      }

      return meta;
    },
    [documentId],
  );

  const loadBootstrap = useCallback(
    async (pageNumber: number, opts?: { soft?: boolean }) => {
      const soft = Boolean(opts?.soft);
      const res = await fetch(
        `/api/documents/${documentId}?page=${pageNumber}`,
      );
      if (!res.ok) throw new Error("Failed to load document");
      const data = (await res.json()) as BootstrapPayload;
      applyBootstrap(data, {
        applyPage: !soft || data.current_page?.pageNumber === pageNumber,
      });
      return data.document;
    },
    [documentId, applyBootstrap],
  );

  const loadPageUrl = useCallback(
    async (pageNumber: number) => {
      const cacheKey = pageCacheKey(documentId, pageNumber);
      const cached = getCachedSignedUrl(cacheKey);
      if (cached) {
        setPageUrl(cached);
        return;
      }
      const res = await fetch(
        `/api/documents/${documentId}/pages/${pageNumber}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          if (typeof data.expiresIn === "number") {
            setCachedSignedUrl(cacheKey, data.url, data.expiresIn);
          }
          setPageUrl(data.url);
          return;
        }
      }
      setPageUrl(null);
    },
    [documentId],
  );

  // Initial open: single bootstrap request
  useEffect(() => {
    let cancelled = false;
    skipNextPageFetch.current = true;
    setLoading(true);
    setError(null);
    setDoc(null);
    processingStartedAt.current = null;
    setWorkerOffline(false);
    setProcessingStuck(false);

    (async () => {
      try {
        await loadBootstrap(startPage, { soft: false });
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, startPage, loadBootstrap]);

  // Soft processing poll — do not blank the viewer
  useEffect(() => {
    if (!doc || doc.processing_status !== "processing" || processingStuck) {
      return;
    }
    if (workerOffline) {
      setProcessingStuck(true);
      return;
    }

    const startedAt = processingStartedAt.current ?? Date.now();
    processingStartedAt.current = startedAt;
    const remainingMs =
      PROCESSING_POLL_TIMEOUT_MS - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      setProcessingStuck(true);
      return;
    }

    const timer = setInterval(() => {
      void loadBootstrap(currentPage, { soft: true }).catch(() => undefined);
    }, PROCESSING_POLL_INTERVAL_MS);
    const timeout = setTimeout(
      () => setProcessingStuck(true),
      remainingMs,
    );

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [
    doc?.processing_status,
    doc?.id,
    loadBootstrap,
    currentPage,
    processingStuck,
    workerOffline,
  ]);

  // Page navigation only — not full document reload
  useEffect(() => {
    if (!doc?.page_count) return;
    if (skipNextPageFetch.current) {
      skipNextPageFetch.current = false;
      return;
    }
    void loadPageUrl(currentPage);
  }, [currentPage, doc?.page_count, loadPageUrl]);

  async function handleDownload() {
    const cacheKey = fileCacheKey(documentId);
    const cached = getCachedSignedUrl(cacheKey);
    if (cached) {
      const a = document.createElement("a");
      a.href = cached;
      a.download = doc?.original_filename ?? "document";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }
    const res = await fetch(`/api/documents/${documentId}/file`);
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.expiresIn === "number" && data.url) {
      setCachedSignedUrl(cacheKey, data.url, data.expiresIn);
    }
    const a = document.createElement("a");
    a.href = data.url;
    a.download = data.filename ?? "document";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  async function handleAccept() {
    if (selectedIds.size === 0) return;
    setAccepting(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/biomarkers/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        },
      );
      if (!res.ok) throw new Error("Accept failed");
      await loadBootstrap(currentPage, { soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setAccepting(false);
    }
  }

  async function handleConfirmObservations() {
    if (observations.length === 0) return;
    setConfirmingObservations(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/biomarkers/confirm-observations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            observationIds: observations.map((item) => item.id),
          }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Confirmation failed");
      }
      await loadBootstrap(currentPage, { soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirmation failed");
    } finally {
      setConfirmingObservations(false);
    }
  }

  async function handleManualCorrection(extractedBiomarkerId: string) {
    const measurementDefinitionKey = manualSelections[extractedBiomarkerId];
    if (!measurementDefinitionKey) return;
    setNormalizingId(extractedBiomarkerId);
    try {
      const res = await fetch(`/api/documents/${documentId}/biomarkers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedBiomarkerId,
          action: "correct",
          measurementDefinitionKey,
        }),
      });
      if (!res.ok) throw new Error("Mapping correction failed");
      await loadBootstrap(currentPage, { soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mapping correction failed");
    } finally {
      setNormalizingId(null);
    }
  }

  async function handleUndoCorrection(
    extractedBiomarkerId: string,
    revertToRevisionId: string,
  ) {
    setNormalizingId(extractedBiomarkerId);
    try {
      const res = await fetch(`/api/documents/${documentId}/biomarkers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedBiomarkerId,
          action: "undo",
          revertToRevisionId,
        }),
      });
      if (!res.ok) throw new Error("Mapping rollback failed");
      await loadBootstrap(currentPage, { soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mapping rollback failed");
    } finally {
      setNormalizingId(null);
    }
  }

  async function handleReprocess(documentTypeOverride?: DocumentType) {
    processingStartedAt.current = Date.now();
    setWorkerOffline(false);
    setProcessingStuck(false);
    setReprocessing(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/reprocess`, {
        method: "POST",
        headers: documentTypeOverride
          ? { "Content-Type": "application/json" }
          : undefined,
        body: documentTypeOverride
          ? JSON.stringify({ document_type: documentTypeOverride })
          : undefined,
      });
      if (!res.ok) throw new Error("Reprocess failed");
      await loadBootstrap(currentPage, { soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reprocess failed");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleRetryProcessing() {
    processingStartedAt.current = Date.now();
    setWorkerOffline(false);
    setProcessingStuck(false);
    setRetryingProcessing(true);
    setError(null);
    try {
      await loadBootstrap(currentPage, { soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status check failed");
      setProcessingStuck(true);
    } finally {
      setRetryingProcessing(false);
    }
  }

  async function handleDismissMismatch() {
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type_mismatch_warning: false }),
    });
    if (res.ok) {
      setDoc((prev) =>
        prev ? { ...prev, type_mismatch_warning: false } : prev,
      );
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--eh-text-secondary)]">
        Loading document…
      </p>
    );
  }

  if (error || !doc) {
    return (
      <SurfaceCard padding="lg">
        <p className="text-sm text-red-600">{error ?? "Document not found"}</p>
        <Button asChild variant="outline" className="mt-4 rounded-xl">
          <Link href="/app/documents">Back to documents</Link>
        </Button>
      </SurfaceCard>
    );
  }

  const pageCount = doc.page_count ?? pages.length ?? 0;
  const showPagePreviews = pageCount > 0 && pageUrl;
  const isImage = originalMime?.startsWith("image/");
  const isPdf = originalMime === "application/pdf";
  const documentType = normalizeDocumentType(doc.document_type) ?? "lab_result";
  const biomarkerPanelMode = resolveBiomarkerPanelMode({
    extractedCount: extracted.length,
    observationCount: observations.length,
    reviewDataError,
  });
  const biomarkerReviewAction = resolveBiomarkerReviewAction({
    mode: biomarkerPanelMode,
    documentStatus: doc.processing_status,
    reviewableExtractedCount: extracted.filter(
      (item) =>
        item.status === "needs_review" || item.status === "pending_review",
    ).length,
  });

  const panelTitle =
    documentType === "lab_result"
      ? biomarkerPanelMode === "extracted-review"
        ? "Extracted biomarkers"
        : "Biomarkers"
      : documentType === "instrumental_report"
        ? "Study findings"
        : documentType === "consultation_note"
          ? "Consultation details"
          : documentType === "discharge_summary"
            ? "Discharge summary"
            : documentType === "prescription"
              ? "Prescription"
              : documentType === "referral"
                ? "Referral details"
                : "Document details";

  const suggestedType = normalizeDocumentType(
    doc.suggested_document_type ?? doc.detected_document_type ?? "",
  );
  const showMismatchBanner =
    doc.type_mismatch_warning &&
    suggestedType &&
    suggestedType !== documentType;
  const showProcessingRecovery =
    doc.processing_status === "processing" &&
    (processingStuck || workerOffline);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 rounded-xl"
          >
            <Link href="/app/documents">
              <ChevronLeft className="size-4" aria-hidden />
              Documents
            </Link>
          </Button>
          <PageHeader
            title={doc.original_filename}
            subtitle={doc.lab_name ?? "Medical document"}
            compact
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--eh-text-muted)]">
            <span>Uploaded {doc.created_at.slice(0, 10)}</span>
            {doc.observed_at && <span>· Lab date {doc.observed_at}</span>}
            <StatusChip variant={statusVariant(doc.processing_status)}>
              {doc.processing_status}
            </StatusChip>
            {doc.is_legacy && <StatusChip variant="neutral">Legacy</StatusChip>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={handleDownload}
          >
            <Download className="size-4" aria-hidden />
            Download original
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={reprocessing || doc.processing_status === "processing"}
            onClick={() => handleReprocess()}
          >
            <RotateCcw className="size-4" aria-hidden />
            {reprocessing ? "Reprocessing…" : "Reprocess"}
          </Button>
        </div>
      </div>

      {doc.processing_error && (
        <p className="text-sm text-red-600">{doc.processing_error}</p>
      )}

      {showProcessingRecovery && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <CircleAlert
              className="mt-0.5 size-5 shrink-0"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="font-medium">
                {workerOffline
                  ? "Document processing is temporarily unavailable"
                  : "Extraction is taking longer than expected"}
              </p>
              <p className="mt-1 max-w-[65ch] text-sm text-amber-900">
                {workerOffline
                  ? "The processing service has not checked in recently. Retry after the service is restored, or start a fresh processing attempt."
                  : "You can check the status again or start a fresh processing attempt."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              disabled={retryingProcessing || reprocessing}
              onClick={handleRetryProcessing}
            >
              {retryingProcessing ? "Checking…" : "Retry status"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={retryingProcessing || reprocessing}
              onClick={() => handleReprocess()}
            >
              <RotateCcw className="size-4" aria-hidden />
              {reprocessing ? "Reprocessing…" : "Reprocess document"}
            </Button>
          </div>
        </div>
      )}

      {showMismatchBanner && suggestedType ? (
        <TypeMismatchBanner
          selectedType={documentType}
          suggestedType={suggestedType}
          reason={doc.type_mismatch_reason ?? null}
          reprocessing={reprocessing}
          onReprocessAsSuggested={() => handleReprocess(suggestedType)}
          onDismiss={handleDismissMismatch}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-stretch">
        <SurfaceCard
          padding="sm"
          className={`flex flex-col lg:h-full ${isPdf ? "min-h-[874px]" : "min-h-[480px]"}`}
        >
          {!isPdf && (
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {showPagePreviews && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="px-2 text-sm text-[var(--eh-text-secondary)]">
                      Page {currentPage} / {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      disabled={currentPage >= pageCount}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(pageCount, p + 1))
                      }
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  aria-label="Zoom out"
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-12 text-center text-xs text-[var(--eh-text-muted)]">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  aria-label="Zoom in"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          )}

          <div
            className={`flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 ${isPdf ? "min-h-[842px]" : "min-h-[400px]"}`}
          >
            {showPagePreviews ? (
              <div className="h-full overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pageUrl!}
                  alt={`Page ${currentPage}`}
                  className="mx-auto block max-w-full object-contain transition-transform"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                  }}
                />
              </div>
            ) : isImage && originalUrl ? (
              <div className="h-full overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalUrl}
                  alt={doc.original_filename}
                  className="mx-auto block max-w-full object-contain"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                  }}
                />
              </div>
            ) : isPdf && originalUrl ? (
              <iframe
                src={originalUrl}
                title={doc.original_filename}
                className="h-full w-full rounded-lg border-0 bg-white"
              />
            ) : doc.processing_status === "processing" ? (
              <p className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--eh-text-secondary)]">
                Generating preview…
              </p>
            ) : (
              <p className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--eh-text-secondary)]">
                Preview not available. Use Download original.
              </p>
            )}
          </div>

          {activeSourceText && (
            <p className="mt-3 shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs text-[var(--eh-text-secondary)]">
              Source: {activeSourceText}
            </p>
          )}
        </SurfaceCard>

        <SurfaceCard padding="sm">
          <h2 className="mb-3 font-semibold text-[var(--eh-text-primary)]">
            {panelTitle}
          </h2>

          {documentType === "instrumental_report" ? (
            <InstrumentalInsightsPanel
              findings={instrumentalFindings}
              summary={doc.document_summary}
              modality={doc.modality}
              processingStatus={doc.processing_status}
              onSelectSource={(page, text) => {
                if (page) setCurrentPage(page);
                setActiveSourceText(text);
              }}
            />
          ) : documentType === "consultation_note" ? (
            <ConsultationInsightsPanel
              note={clinicalNote}
              summary={doc.document_summary}
              processingStatus={doc.processing_status}
            />
          ) : documentType === "discharge_summary" ? (
            <DischargeInsightsPanel
              note={clinicalNote}
              summary={doc.document_summary}
              processingStatus={doc.processing_status}
            />
          ) : documentType === "prescription" ? (
            <PrescriptionInsightsPanel
              prescription={
                prescription as Parameters<
                  typeof PrescriptionInsightsPanel
                >[0]["prescription"]
              }
              summary={doc.document_summary}
              processingStatus={doc.processing_status}
            />
          ) : documentType === "referral" ? (
            <ReferralInsightsPanel
              referral={
                referral as Parameters<
                  typeof ReferralInsightsPanel
                >[0]["referral"]
              }
              summary={doc.document_summary}
              processingStatus={doc.processing_status}
            />
          ) : (
            <>
              <DocumentSummaryCard summary={doc.document_summary} />
              {biomarkerPanelMode === "review-error" ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-600">{reviewDataError}</p>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => handleReprocess()}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    Reprocess document
                  </Button>
                </div>
              ) : biomarkerPanelMode === "extracted-review" ? (
                <ul className="max-h-[520px] space-y-2 overflow-y-auto">
                  {extracted.map((b) => {
                    const reviewable =
                      b.status === "needs_review" ||
                      b.status === "pending_review";
                    const normalization = b.normalization;
                    return (
                      <li
                        key={b.id}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <button
                          type="button"
                          className="w-full text-left transition hover:text-[var(--eh-brand)]"
                          onClick={() => {
                            if (b.source_page) setCurrentPage(b.source_page);
                            setActiveSourceText(b.source_text);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {reviewable && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(b.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(b.id);
                                    else next.delete(b.id);
                                    return next;
                                  });
                                }}
                                className="mt-1"
                                aria-label={`Select ${b.biomarker_name}`}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-[var(--eh-text-primary)]">
                                {b.biomarker_name}
                              </p>
                              <p className="text-sm text-[var(--eh-text-secondary)]">
                                {b.value_kind && b.value_kind !== "numeric"
                                  ? (b.value_text ?? "—")
                                  : b.value_numeric != null
                                    ? `${b.value_numeric}${b.unit ? ` ${b.unit}` : ""}`
                                    : (b.value_text ?? "—")}
                                {b.reference_range
                                  ? ` · ref ${b.reference_range}`
                                  : ""}
                              </p>
                              <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                                {b.confidence != null
                                  ? `${Math.round(b.confidence * 100)}% extraction confidence`
                                  : ""}
                                {b.source_page
                                  ? ` · page ${b.source_page}`
                                  : ""}
                                {b.source_text
                                  ? ` · “${b.source_text.slice(0, 80)}${b.source_text.length > 80 ? "…" : ""}”`
                                  : ""}
                                {b.status === "accepted" ? " · accepted" : ""}
                              </p>
                            </div>
                          </div>
                        </button>
                        {normalization && (
                          <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-[var(--eh-text-secondary)]">
                            <p className="font-medium text-[var(--eh-text-primary)]">
                              {normalization.result === "partial"
                                ? `${b.biomarker_name} recognized`
                                : measurementMappingLabel(
                                    normalization.result,
                                    normalization.mappingConfidenceBand,
                                  )}
                            </p>
                            {measurementMappingGuidance(
                              normalization.result,
                            ) && (
                              <p className="mt-1 leading-relaxed">
                                {measurementMappingGuidance(
                                  normalization.result,
                                )}
                              </p>
                            )}
                            <details className="mt-2">
                              <summary className="cursor-pointer text-[var(--eh-text-muted)] hover:text-[var(--eh-text-secondary)]">
                                Technical details
                              </summary>
                              <p className="mt-2">
                                Mapping confidence describes classification
                                evidence, not a medical result.
                              </p>
                              <p className="mt-1">
                                Active revision:{" "}
                                {normalization.activeRevision
                                  ?.measurement_definition_key ?? "none"}
                                {normalization.activeRevision
                                  ? ` (${normalization.activeRevision.verification_status})`
                                  : ""}
                              </p>
                              <ul className="mt-2 space-y-1">
                                {normalization.candidateEvidence.map(
                                  (candidate) => (
                                    <li key={candidate.candidateKey}>
                                      <span className="font-medium">
                                        {candidate.candidateKey}
                                      </span>
                                      {candidate.accepted.length
                                        ? ` · supports: ${candidate.accepted.map((item) => item.code).join(", ")}`
                                        : ""}
                                      {candidate.rejected.length
                                        ? ` · rejects: ${candidate.rejected.map((item) => item.code).join(", ")}`
                                        : ""}
                                    </li>
                                  ),
                                )}
                              </ul>
                              <p className="mt-2 text-[var(--eh-text-muted)]">
                                Catalog/resolver:{" "}
                                {normalization.activeRevision?.id
                                  ? (normalization.revisions.find(
                                      (revision) =>
                                        revision.id ===
                                        normalization.activeRevision?.id,
                                    )?.catalog_manifest_version ?? "unknown")
                                  : "pending"}
                                {" / "}
                                {normalization.activeRevision?.id
                                  ? (normalization.revisions.find(
                                      (revision) =>
                                        revision.id ===
                                        normalization.activeRevision?.id,
                                    )?.resolver_version ?? "unknown")
                                  : "pending"}
                              </p>
                              {normalization.manualOptions.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <select
                                    value={manualSelections[b.id] ?? ""}
                                    onChange={(event) =>
                                      setManualSelections((current) => ({
                                        ...current,
                                        [b.id]: event.target.value,
                                      }))
                                    }
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                    aria-label={`Choose compatible mapping for ${b.biomarker_name}`}
                                  >
                                    <option value="">
                                      Select only if the report states the
                                      specimen
                                    </option>
                                    {normalization.manualOptions.map(
                                      (option) => (
                                        <option
                                          key={option.key}
                                          value={option.key}
                                        >
                                          {option.displayName}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                      !manualSelections[b.id] ||
                                      normalizingId === b.id
                                    }
                                    onClick={() => handleManualCorrection(b.id)}
                                  >
                                    {normalizingId === b.id
                                      ? "Saving…"
                                      : "Use mapping"}
                                  </Button>
                                </div>
                              )}
                              {normalization.activeRevision &&
                                normalization.revisions
                                  .filter(
                                    (revision) =>
                                      !revision.is_active &&
                                      revision.measurement_definition_key,
                                  )
                                  .map((revision) => (
                                    <Button
                                      key={revision.id}
                                      variant="ghost"
                                      size="sm"
                                      className="mt-2"
                                      disabled={normalizingId === b.id}
                                      onClick={() =>
                                        handleUndoCorrection(b.id, revision.id)
                                      }
                                    >
                                      Restore{" "}
                                      {revision.measurement_definition_key}
                                    </Button>
                                  ))}
                            </details>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : biomarkerPanelMode === "observations-fallback" ? (
                <div>
                  {doc.processing_status === "needs_review" && (
                    <p className="mb-3 text-sm text-[var(--eh-text-secondary)]">
                      These biomarkers are already stored for this document.
                      Confirm them to complete review.
                    </p>
                  )}
                  <ul className="max-h-[520px] space-y-2 overflow-y-auto">
                    {observations.map((o) => (
                      <li
                        key={o.id}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <p className="font-medium text-[var(--eh-text-primary)]">
                          {o.name}
                        </p>
                        <p className="text-sm text-[var(--eh-text-secondary)]">
                          {o.value} {o.unit}
                          {o.ref_low != null && o.ref_high != null
                            ? ` · ref ${o.ref_low}–${o.ref_high}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                          {o.observed_at}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[var(--eh-text-secondary)]">
                    {doc.processing_status === "processing"
                      ? "Extraction in progress…"
                      : doc.processing_status === "needs_review"
                        ? "No biomarkers are available for review. Reprocess the document to try extraction again."
                        : "No biomarkers linked to this document."}
                  </p>
                  {doc.processing_status === "needs_review" && (
                    <Button
                      variant="outline"
                      className="mt-3 w-full rounded-xl"
                      onClick={() => handleReprocess()}
                    >
                      <RotateCcw className="size-4" aria-hidden />
                      Reprocess document
                    </Button>
                  )}
                </div>
              )}

              {biomarkerReviewAction === "accept-extracted" && (
                <Button
                  className="mt-4 w-full rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
                  disabled={accepting || selectedIds.size === 0}
                  onClick={handleAccept}
                >
                  {accepting
                    ? "Accepting…"
                    : `Accept selected (${selectedIds.size})`}
                </Button>
              )}
              {biomarkerReviewAction === "confirm-observations" && (
                <Button
                  className="mt-4 w-full rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
                  disabled={confirmingObservations || observations.length === 0}
                  onClick={handleConfirmObservations}
                >
                  {confirmingObservations
                    ? "Confirming..."
                    : `Confirm biomarkers (${observations.length})`}
                </Button>
              )}
            </>
          )}

          <PanelDisclaimer />
        </SurfaceCard>
      </div>
    </div>
  );
}
