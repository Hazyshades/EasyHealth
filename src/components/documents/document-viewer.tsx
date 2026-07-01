"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCcw } from "lucide-react";
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

type PageMeta = { page_number: number; width: number | null; height: number | null };

type Observation = {
  id: string;
  biomarker_key: string;
  name: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
};

type ExtractedBiomarker = {
  id: string;
  biomarker_name: string;
  value_numeric: number | null;
  unit: string | null;
  reference_range: string | null;
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
  status: string;
};

function statusVariant(
  status: string
): "success" | "warning" | "error" | "neutral" {
  if (status === "ready" || status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "needs_review") return "warning";
  return "warning";
}

export function DocumentViewer({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams();
  const initialPage = Number.parseInt(searchParams.get("page") ?? "1", 10);

  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [currentPage, setCurrentPage] = useState(
    Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1
  );
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalMime, setOriginalMime] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [extracted, setExtracted] = useState<ExtractedBiomarker[]>([]);
  const [instrumentalFindings, setInstrumentalFindings] = useState<InstrumentalFinding[]>([]);
  const [clinicalNote, setClinicalNote] = useState<ClinicalNote | null>(null);
  const [prescription, setPrescription] = useState<Record<string, unknown> | null>(null);
  const [referral, setReferral] = useState<Record<string, unknown> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeSourceText, setActiveSourceText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocument = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}`);
    if (!res.ok) throw new Error("Failed to load document");
    const data = await res.json();
    setDoc(data.document);
    setPages(data.pages ?? []);
    setInstrumentalFindings(data.instrumental_findings ?? []);
    setClinicalNote(data.clinical_note ?? null);
    setPrescription(data.prescription ?? null);
    setReferral(data.referral ?? null);
    return data.document as DocumentMeta;
  }, [documentId]);

  const loadBiomarkers = useCallback(async (meta: DocumentMeta) => {
    const useExtracted =
      !meta.is_legacy &&
      (meta.extracted_biomarker_count > 0 || meta.processing_status === "needs_review");

    if (useExtracted) {
      const extRes = await fetch(`/api/documents/${documentId}/biomarkers`);
      if (extRes.ok) {
        const extData = await extRes.json();
        setExtracted(extData.items ?? []);
        setSelectedIds(
          new Set(
            (extData.items as ExtractedBiomarker[])
              .filter((b) => b.status === "needs_review" || b.status === "pending_review")
              .map((b) => b.id)
          )
        );
      }
      const obsRes = await fetch(`/api/documents/${documentId}/observations`);
      if (obsRes.ok) {
        const obsData = await obsRes.json();
        setObservations(obsData.observations ?? []);
      }
      return;
    }

    const obsRes = await fetch(`/api/documents/${documentId}/observations`);
    if (obsRes.ok) {
      const obsData = await obsRes.json();
      setObservations(obsData.observations ?? []);
    }
    setExtracted([]);
  }, [documentId]);

  const loadPageUrl = useCallback(
    async (pageNumber: number) => {
      const res = await fetch(`/api/documents/${documentId}/pages/${pageNumber}`);
      if (res.ok) {
        const data = await res.json();
        setPageUrl(data.url);
        return;
      }
      setPageUrl(null);
    },
    [documentId]
  );

  const loadOriginal = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}/file`);
    if (!res.ok) return;
    const data = await res.json();
    setOriginalUrl(data.url);
    setOriginalMime(data.mimeType);
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const meta = await loadDocument();
        if (cancelled) return;
        await Promise.all([loadBiomarkers(meta), loadOriginal()]);
        if (meta.page_count && meta.page_count > 0) {
          await loadPageUrl(currentPage);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadDocument, loadBiomarkers, loadOriginal, loadPageUrl, currentPage]);

  useEffect(() => {
    if (!doc || doc.processing_status !== "processing") return;
    const timer = setInterval(async () => {
      const meta = await loadDocument();
      await loadBiomarkers(meta);
      if (meta.page_count && meta.page_count > 0) {
        await loadPageUrl(currentPage);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [doc, loadDocument, loadBiomarkers, loadPageUrl, currentPage]);

  useEffect(() => {
    if (!doc?.page_count) return;
    loadPageUrl(currentPage);
  }, [currentPage, doc?.page_count, loadPageUrl]);

  async function handleDownload() {
    const res = await fetch(`/api/documents/${documentId}/file`);
    if (!res.ok) return;
    const data = await res.json();
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
      const res = await fetch(`/api/documents/${documentId}/biomarkers/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Accept failed");
      const meta = await loadDocument();
      await loadBiomarkers(meta);
      const obsRes = await fetch(`/api/documents/${documentId}/observations`);
      if (obsRes.ok) {
        const obsData = await obsRes.json();
        setObservations(obsData.observations ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setAccepting(false);
    }
  }

  async function handleReprocess(documentTypeOverride?: DocumentType) {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/reprocess`, {
        method: "POST",
        headers: documentTypeOverride ? { "Content-Type": "application/json" } : undefined,
        body: documentTypeOverride
          ? JSON.stringify({ document_type: documentTypeOverride })
          : undefined,
      });
      if (!res.ok) throw new Error("Reprocess failed");
      const meta = await loadDocument();
      await loadBiomarkers(meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reprocess failed");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleDismissMismatch() {
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type_mismatch_warning: false }),
    });
    if (res.ok) {
      setDoc((prev) => (prev ? { ...prev, type_mismatch_warning: false } : prev));
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--eh-text-secondary)]">Loading document…</p>;
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
  const pipelineMode =
    !doc.is_legacy &&
    documentType === "lab_result" &&
    (extracted.length > 0 || doc.processing_status === "needs_review");

  const panelTitle =
    documentType === "lab_result"
      ? pipelineMode
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
    doc.suggested_document_type ?? doc.detected_document_type ?? ""
  );
  const showMismatchBanner =
    doc.type_mismatch_warning && suggestedType && suggestedType !== documentType;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 rounded-xl">
            <Link href="/app/documents">
              <ChevronLeft className="size-4" aria-hidden />
              Documents
            </Link>
          </Button>
          <PageHeader title={doc.original_filename} subtitle={doc.lab_name ?? "Medical document"} compact />
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
          <Button variant="outline" className="rounded-xl" onClick={handleDownload}>
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
                      onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
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
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                />
              </div>
            ) : isImage && originalUrl ? (
              <div className="h-full overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalUrl}
                  alt={doc.original_filename}
                  className="mx-auto block max-w-full object-contain"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
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
          <h2 className="mb-3 font-semibold text-[var(--eh-text-primary)]">{panelTitle}</h2>

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
              prescription={prescription as Parameters<typeof PrescriptionInsightsPanel>[0]["prescription"]}
              summary={doc.document_summary}
              processingStatus={doc.processing_status}
            />
          ) : documentType === "referral" ? (
            <ReferralInsightsPanel
              referral={referral as Parameters<typeof ReferralInsightsPanel>[0]["referral"]}
              summary={doc.document_summary}
              processingStatus={doc.processing_status}
            />
          ) : (
            <>
              <DocumentSummaryCard summary={doc.document_summary} />
              {pipelineMode ? (
            <ul className="max-h-[520px] space-y-2 overflow-y-auto">
              {extracted.map((b) => {
                const reviewable = b.status === "needs_review" || b.status === "pending_review";
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--eh-brand)]"
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
                            {b.value_numeric ?? "—"} {b.unit ?? ""}
                            {b.reference_range ? ` · ref ${b.reference_range}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                            {b.confidence != null
                              ? `${Math.round(b.confidence * 100)}% confidence`
                              : ""}
                            {b.source_page ? ` · page ${b.source_page}` : ""}
                            {b.status === "accepted" ? " · accepted" : ""}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : observations.length > 0 ? (
            <ul className="max-h-[520px] space-y-2 overflow-y-auto">
              {observations.map((o) => (
                <li
                  key={o.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <p className="font-medium text-[var(--eh-text-primary)]">{o.name}</p>
                  <p className="text-sm text-[var(--eh-text-secondary)]">
                    {o.value} {o.unit}
                    {o.ref_low != null && o.ref_high != null
                      ? ` · ref ${o.ref_low}–${o.ref_high}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--eh-text-muted)]">{o.observed_at}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--eh-text-secondary)]">
              {doc.processing_status === "processing"
                ? "Extraction in progress…"
                : doc.processing_status === "needs_review"
                  ? "No biomarkers detected yet."
                  : "No biomarkers linked to this document."}
            </p>
          )}

          {pipelineMode && extracted.some((b) => b.status === "needs_review" || b.status === "pending_review") && (
            <Button
              className="mt-4 w-full rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
              disabled={accepting || selectedIds.size === 0}
              onClick={handleAccept}
            >
              {accepting ? "Accepting…" : `Accept selected (${selectedIds.size})`}
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
