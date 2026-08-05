"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, ChevronLeft, Download, RotateCcw } from "lucide-react";
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
import { DocumentSourcePane } from "@/components/documents/review/document-source-pane";
import { ObservationReviewList } from "@/components/documents/review/observation-review-list";
import { ObservationReviewRow } from "@/components/documents/review/observation-review-row";
import { ReviewTechnicalDetails } from "@/components/documents/review/review-technical-details";
import { ReviewWorkspaceSkeleton } from "@/components/documents/review/review-workspace-skeleton";
import { normalizeDocumentType, type DocumentType } from "@/lib/health-systems";
import {
  fileCacheKey,
  getCachedSignedUrl,
  pageCacheKey,
  setCachedSignedUrl,
} from "@/lib/documents/signed-url-cache";
import {
  resolveBiomarkerPanelMode,
  resolveBiomarkerReviewAction,
} from "@/lib/documents/biomarker-review-state";
import {
  buildExtractedReviewRow,
  buildObservationReviewRow,
  findReviewRow,
  groupReviewRowsByPage,
  hasIncompleteOutcomes,
  resolveSelectionForPage,
  resolveSourceLocation,
  summarizeReviewRows,
  type ReviewRow,
  type ReviewRowSourceLocation,
} from "@/lib/documents/observation-review-workspace";
import type { NormalizationReview } from "@/lib/documents/normalization-review";
import type { LaboratoryResolutionDetails } from "@/lib/documents/incomplete-laboratory-outcomes";

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
  observation_kind?: "lab" | "instrumental";
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  resolver_result?: string | null;
  verification_status?: string | null;
  registry_binding_ready?: boolean;
  resolution_details?: LaboratoryResolutionDetails;
  name: string;
  raw_name?: string | null;
  value: number | string | null;
  value_kind?: string | null;
  value_text?: string | null;
  unit: string;
  raw_unit?: string | null;
  raw_value_text?: string | null;
  raw_reference_text?: string | null;
  specimen?: string | null;
  modifier?: string | null;
  confidence?: number | null;
  source_page?: number | null;
  source_text?: string | null;
  ref_low: number | string | null;
  ref_high: number | string | null;
  observed_at: string;
};

type ExtractedBiomarker = {
  id: string;
  biomarker_name: string;
  raw_name?: string | null;
  value_numeric: number | null;
  value_text?: string | null;
  value_kind?: string | null;
  unit: string | null;
  raw_unit?: string | null;
  raw_value_text?: string | null;
  reference_range: string | null;
  raw_reference_range?: string | null;
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
  status: string;
  specimen?: string | null;
  modifier?: string | null;
  method?: string | null;
  normalization?: NormalizationReview;
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

type WriterActionPayload = {
  error?: string;
  failures?: Array<{
    id?: string;
    observationId?: string;
    error?: string;
  }>;
};

const PROCESSING_POLL_INTERVAL_MS = 8_000;
const PROCESSING_POLL_TIMEOUT_MS = 150_000;
const PAGE_PREVIEW_ERROR = "This page preview could not be loaded.";

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

function formatWriterFailures(action: string, failures: NonNullable<WriterActionPayload["failures"]>) {
  const details = failures
    .map((failure) => failure.error ?? `Row ${failure.id ?? failure.observationId ?? "unknown"} failed`)
    .join("; ");
  return `${action} completed for some results, but ${failures.length} row${failures.length === 1 ? "" : "s"} failed: ${details}`;
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
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalMime, setOriginalMime] = useState<string | null>(null);
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
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [insightSource, setInsightSource] =
    useState<ReviewRowSourceLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [confirmingObservations, setConfirmingObservations] = useState(false);
  const [manualSelections, setManualSelections] = useState<
    Record<string, string>
  >({});
  const [normalizingId, setNormalizingId] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workerOffline, setWorkerOffline] = useState(false);
  const [processingStuck, setProcessingStuck] = useState(false);
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [retryingLoad, setRetryingLoad] = useState(false);

  /** Skip page-only fetch once after bootstrap seeds pageUrl for the same page. */
  const skipNextPageFetch = useRef(true);
  const processingStartedAt = useRef<number | null>(null);

  const loadAuthoritativeObservations = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}/observations`);
    if (!res.ok) throw new Error("Failed to load document observations");
    const data = (await res.json()) as { observations?: Observation[] };
    setObservations(data.observations ?? []);
  }, [documentId]);

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
        setPageError(null);
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
      await loadAuthoritativeObservations();
      return data.document;
    },
    [documentId, applyBootstrap, loadAuthoritativeObservations],
  );

  const loadPageUrl = useCallback(
    async (pageNumber: number) => {
      const cacheKey = pageCacheKey(documentId, pageNumber);
      const cached = getCachedSignedUrl(cacheKey);
      if (cached) {
        setPageUrl(cached);
        setPageError(null);
        return;
      }
      setPageLoading(true);
      setPageError(null);
      try {
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
        setPageError(PAGE_PREVIEW_ERROR);
      } catch {
        setPageUrl(null);
        setPageError(PAGE_PREVIEW_ERROR);
      } finally {
        setPageLoading(false);
      }
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

  const extractedRows = useMemo(
    () => extracted.map(buildExtractedReviewRow),
    [extracted],
  );
  const observationRows = useMemo(
    () => observations.map(buildObservationReviewRow),
    [observations],
  );

  const biomarkerPanelMode = resolveBiomarkerPanelMode({
    extractedCount: extracted.length,
    observationCount: observations.length,
    reviewDataError,
  });

  const reviewRows = useMemo(() => {
    if (biomarkerPanelMode === "extracted-review") return extractedRows;
    if (biomarkerPanelMode === "observations-fallback") return observationRows;
    return [];
  }, [biomarkerPanelMode, extractedRows, observationRows]);

  const reviewGroups = useMemo(
    () => groupReviewRowsByPage(reviewRows),
    [reviewRows],
  );
  const reviewSummary = useMemo(
    () => summarizeReviewRows(reviewRows),
    [reviewRows],
  );

  // Document -> list synchronization: keep the selected row anchored to the page in view.
  useEffect(() => {
    setSelectedRowId((prev) =>
      resolveSelectionForPage(reviewRows, currentPage, prev),
    );
  }, [reviewRows, currentPage]);

  const selectedRow = findReviewRow(reviewRows, selectedRowId);
  const activeSource = selectedRow?.source ?? insightSource;

  const handleActivateRow = useCallback((row: ReviewRow) => {
    setSelectedRowId(row.id);
    setInsightSource(null);
    if (row.source.page !== null) setCurrentPage(row.source.page);
  }, []);

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
    setActionError(null);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/biomarkers/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as WriterActionPayload;
      if (!res.ok) throw new Error(payload.error ?? "Accept failed");
      await loadBootstrap(currentPage, { soft: true });
      if (payload.failures?.length) {
        setActionError(formatWriterFailures("Acceptance", payload.failures));
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setAccepting(false);
    }
  }

  async function handleConfirmObservations() {
    if (observations.length === 0) return;
    setConfirmingObservations(true);
    setActionError(null);
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
      const payload = (await res.json().catch(() => ({}))) as WriterActionPayload;
      if (!res.ok) throw new Error(payload.error ?? "Confirmation failed");
      await loadBootstrap(currentPage, { soft: true });
      if (payload.failures?.length) {
        setActionError(formatWriterFailures("Confirmation", payload.failures));
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Confirmation failed");
    } finally {
      setConfirmingObservations(false);
    }
  }

  async function handleManualCorrection(extractedBiomarkerId: string) {
    const measurementDefinitionKey = manualSelections[extractedBiomarkerId];
    if (!measurementDefinitionKey) return;
    setNormalizingId(extractedBiomarkerId);
    setActionError(null);
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
      setActionError(
        e instanceof Error ? e.message : "Mapping correction failed",
      );
    } finally {
      setNormalizingId(null);
    }
  }

  async function handleUndoCorrection(
    extractedBiomarkerId: string,
    revertToRevisionId: string,
  ) {
    setNormalizingId(extractedBiomarkerId);
    setActionError(null);
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
      setActionError(
        e instanceof Error ? e.message : "Mapping rollback failed",
      );
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

  async function handleRetryLoad() {
    setRetryingLoad(true);
    setError(null);
    try {
      skipNextPageFetch.current = true;
      await loadBootstrap(currentPage, { soft: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setRetryingLoad(false);
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
    return <ReviewWorkspaceSkeleton />;
  }

  if (error || !doc) {
    return (
      <SurfaceCard padding="lg">
        <p role="alert" className="text-sm text-red-600">
          {error ?? "Document not found"}
        </p>
        <p className="mt-2 max-w-[65ch] text-sm text-[var(--eh-text-secondary)]">
          The review workspace could not be opened. Retry the request, or go
          back to your documents.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            className="rounded-xl"
            disabled={retryingLoad}
            onClick={handleRetryLoad}
          >
            {retryingLoad ? "Retrying…" : "Retry"}
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/app/documents">Back to documents</Link>
          </Button>
        </div>
      </SurfaceCard>
    );
  }

  const pageCount = doc.page_count ?? pages.length ?? 0;
  const documentType = normalizeDocumentType(doc.document_type) ?? "lab_result";
  const biomarkerReviewAction = resolveBiomarkerReviewAction({
    mode: biomarkerPanelMode,
    documentStatus: doc.processing_status,
    reviewableExtractedCount: extracted.filter(
      (item) =>
        item.status === "needs_review" || item.status === "pending_review",
    ).length,
  });
  const hasIncompleteLaboratoryOutcomes =
    hasIncompleteOutcomes(extractedRows) || hasIncompleteOutcomes(observationRows);

  const normalizationById = new Map(
    extracted.map((item) => [item.id, item.normalization ?? null]),
  );

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

  const reprocessButton = (
    <Button
      variant="outline"
      className="mt-3 w-full rounded-xl"
      disabled={reprocessing}
      onClick={() => handleReprocess()}
    >
      <RotateCcw className="size-4" aria-hidden />
      {reprocessing ? "Reprocessing…" : "Reprocess document"}
    </Button>
  );

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
      {actionError && (
        <p role="alert" className="text-sm text-red-600">
          {actionError}
        </p>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_420px]">
        <DocumentSourcePane
          filename={doc.original_filename}
          processingStatus={doc.processing_status}
          mimeType={originalMime}
          pageUrl={pageUrl}
          originalUrl={originalUrl}
          pageCount={pageCount}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          pageLoading={pageLoading}
          pageError={pageError}
          onRetryPage={() => void loadPageUrl(currentPage)}
          activeSource={activeSource}
        />

        <SurfaceCard padding="sm" className="min-w-0">
          <h2 className="mb-1 font-semibold text-[var(--eh-text-primary)]">
            {panelTitle}
          </h2>
          {documentType === "lab_result" && reviewSummary.total > 0 ? (
            <p className="mb-3 text-xs text-[var(--eh-text-muted)]">
              {reviewSummary.total} result
              {reviewSummary.total === 1 ? "" : "s"} ·{" "}
              {reviewSummary.resolved} matched · {reviewSummary.incomplete}{" "}
              incomplete · {reviewSummary.unverified} not verified
            </p>
          ) : null}

          {documentType === "instrumental_report" ? (
            <InstrumentalInsightsPanel
              findings={instrumentalFindings}
              summary={doc.document_summary}
              modality={doc.modality}
              processingStatus={doc.processing_status}
              onSelectSource={(page, text) => {
                if (page) setCurrentPage(page);
                setInsightSource(resolveSourceLocation(page, text));
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
                  <p role="alert" className="text-sm text-red-600">
                    {reviewDataError}
                  </p>
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
                <div>
                  <ObservationReviewList
                    groups={reviewGroups}
                    currentPage={currentPage}
                    selectedRowId={selectedRowId}
                    onSelectPage={setCurrentPage}
                    renderRow={(row) => {
                      const normalization = normalizationById.get(row.id) ?? null;
                      return (
                        <ObservationReviewRow
                          key={row.id}
                          row={row}
                          selected={row.id === selectedRowId}
                          onActivate={handleActivateRow}
                          selection={
                            row.reviewable
                              ? {
                                  checked: selectedIds.has(row.id),
                                  onChange: (next) =>
                                    setSelectedIds((prev) => {
                                      const updated = new Set(prev);
                                      if (next) updated.add(row.id);
                                      else updated.delete(row.id);
                                      return updated;
                                    }),
                                }
                              : undefined
                          }
                          technicalDetails={
                            <ReviewTechnicalDetails
                              details={row.resolutionDetails}
                              decisionTrace={normalization?.decisionTrace}
                              previewCandidateEvidence={
                                normalization?.previewCandidateEvidence
                              }
                            >
                              {normalization &&
                              normalization.manualOptions.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <select
                                    value={manualSelections[row.id] ?? ""}
                                    onChange={(event) =>
                                      setManualSelections((current) => ({
                                        ...current,
                                        [row.id]: event.target.value,
                                      }))
                                    }
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                    aria-label={`Choose compatible mapping for ${row.rawEvidence.displayName}`}
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
                                      !manualSelections[row.id] ||
                                      normalizingId === row.id
                                    }
                                    onClick={() =>
                                      handleManualCorrection(row.id)
                                    }
                                  >
                                    {normalizingId === row.id
                                      ? "Saving…"
                                      : "Use mapping"}
                                  </Button>
                                </div>
                              ) : null}
                              {normalization?.activeRevision
                                ? normalization.revisions
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
                                        disabled={normalizingId === row.id}
                                        onClick={() =>
                                          handleUndoCorrection(
                                            row.id,
                                            revision.id,
                                          )
                                        }
                                      >
                                        Restore{" "}
                                        {revision.measurement_definition_key}
                                      </Button>
                                    ))
                                : null}
                            </ReviewTechnicalDetails>
                          }
                        />
                      );
                    }}
                  />
                  {hasIncompleteLaboratoryOutcomes && reprocessButton}
                </div>
              ) : biomarkerPanelMode === "observations-fallback" ? (
                <div>
                  {doc.processing_status === "needs_review" && (
                    <p className="mb-3 text-sm text-[var(--eh-text-secondary)]">
                      These Registry 2.0 observations are already linked to this
                      document. Confirm them to complete review.
                    </p>
                  )}
                  <ObservationReviewList
                    groups={reviewGroups}
                    currentPage={currentPage}
                    selectedRowId={selectedRowId}
                    onSelectPage={setCurrentPage}
                    renderRow={(row) => (
                      <ObservationReviewRow
                        key={row.id}
                        row={row}
                        selected={row.id === selectedRowId}
                        onActivate={handleActivateRow}
                        technicalDetails={
                          <ReviewTechnicalDetails
                            details={row.resolutionDetails}
                          />
                        }
                      />
                    )}
                  />
                  {hasIncompleteLaboratoryOutcomes && reprocessButton}
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
                  {doc.processing_status === "needs_review" && reprocessButton}
                </div>
              )}

              {biomarkerReviewAction === "accept-extracted" && (
                <>
                  <Button
                    className="mt-4 w-full rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
                    disabled={accepting || selectedIds.size === 0}
                    onClick={handleAccept}
                  >
                    {accepting
                      ? "Accepting…"
                      : `Accept selected (${selectedIds.size})`}
                  </Button>
                  <p className="mt-2 text-xs text-[var(--eh-text-muted)]">
                    Accepting keeps every selected result exactly as reported.
                    Choosing a measurement is optional.
                  </p>
                </>
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
