"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { LaboratoryEventCard } from "@/components/timeline/laboratory-event-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type DocumentType,
} from "@/lib/health-systems";
import {
  groupLaboratoryObservations,
  type TimelineLaboratoryObservation,
} from "@/lib/timeline/panel-grouping";

const PAGE_SIZE = 10;
type TimelineTypeFilter = DocumentType | "all";

type TimelineDocument = Readonly<{
  id: string;
  original_filename: string;
  status: string;
  processing_status: string;
  document_type: DocumentType;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  error_message: string | null;
}>;

const DOCUMENT_FILTERS: { id: TimelineTypeFilter; label: string }[] = [
  { id: "all", label: "All events" },
  ...DOCUMENT_TYPES.filter((type) => type !== "dicom").map((type) => ({
    id: type,
    label: DOCUMENT_TYPE_LABELS[type],
  })),
];

function eventDateValue(document: TimelineDocument): string {
  return document.observed_at ?? document.created_at.slice(0, 10);
}

function compareTimelineDocuments(left: TimelineDocument, right: TimelineDocument): number {
  const dateOrder = eventDateValue(right).localeCompare(eventDateValue(left));
  if (dateOrder !== 0) return dateOrder;
  const createdOrder = right.created_at.localeCompare(left.created_at);
  if (createdOrder !== 0) return createdOrder;
  return left.id.localeCompare(right.id);
}

function formatEventDate(document: TimelineDocument): string {
  const date = eventDateValue(document);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(parsed);
}

function eventDateLabel(document: TimelineDocument): string {
  return document.observed_at ? "Event date" : "Uploaded";
}

function displayDocumentStatus(document: TimelineDocument): string {
  return document.processing_status || document.status || "available";
}

function SimpleTimelineEvent({ document }: { document: TimelineDocument }) {
  const eventHref = `/app/documents/${encodeURIComponent(document.id)}`;
  return (
    <SurfaceCard padding="md" className="space-y-3" data-testid="timeline-event-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
            {DOCUMENT_TYPE_LABELS[document.document_type] ?? document.document_type}
          </p>
          <h2 className="mt-1 truncate text-base font-semibold text-[var(--eh-text-primary)]">
            {document.original_filename}
          </h2>
          <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
            {[eventDateLabel(document), formatEventDate(document), document.lab_name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Link
          href={eventHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--eh-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--eh-text-secondary)] hover:border-[var(--eh-brand)] hover:text-[var(--eh-brand)]"
        >
          Open document
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip variant="neutral">{displayDocumentStatus(document)}</StatusChip>
        {document.error_message ? (
          <p className="text-xs text-[var(--eh-text-secondary)]">{document.error_message}</p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

export default function TimelinePage() {
  const [documents, setDocuments] = useState<TimelineDocument[]>([]);
  const [observations, setObservations] = useState<TimelineLaboratoryObservation[]>([]);
  const [activeType, setActiveType] = useState<TimelineTypeFilter>("all");
  const [activeDate, setActiveDate] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [documentsResponse, observationsResponse] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/biomarkers"),
      ]);
      const documentsData = (await documentsResponse.json().catch(() => ({}))) as {
        documents?: TimelineDocument[];
        error?: string;
      };
      const observationsData = (await observationsResponse.json().catch(() => ({}))) as {
        observations?: TimelineLaboratoryObservation[];
        error?: string;
      };
      if (!documentsResponse.ok) {
        throw new Error(documentsData.error ?? "Failed to load timeline events");
      }
      if (!observationsResponse.ok) {
        throw new Error(observationsData.error ?? "Failed to load laboratory measurements");
      }
      setDocuments(documentsData.documents ?? []);
      setObservations(observationsData.observations ?? []);
      setVisibleCount(PAGE_SIZE);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const filteredDocuments = useMemo(
    () =>
      documents
        .filter((document) => activeType === "all" || document.document_type === activeType)
        .filter((document) => !activeDate || document.observed_at === activeDate)
        .sort(compareTimelineDocuments),
    [activeDate, activeType, documents],
  );

  const visibleDocuments = filteredDocuments.slice(0, visibleCount);
  const hasMore = visibleDocuments.length < filteredDocuments.length;
  const observationsByDocument = useMemo(() => {
    const byDocument = new Map<string, TimelineLaboratoryObservation[]>();
    for (const observation of observations) {
      if (!observation.document_id) continue;
      const documentObservations = byDocument.get(observation.document_id) ?? [];
      documentObservations.push(observation);
      byDocument.set(observation.document_id, documentObservations);
    }
    return byDocument;
  }, [observations]);

  function clearFilters() {
    setActiveType("all");
    setActiveDate("");
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader subtitle="A chronological view of your profile-owned medical events" />

      <SurfaceCard padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--eh-text-primary)]">Filter timeline</p>
            <p className="mt-0.5 text-xs text-[var(--eh-text-muted)]">
              Laboratory panels use normalized Registry 2.0 measurement identities.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => void loadTimeline()}
            disabled={loading}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by document type">
          {DOCUMENT_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              active={activeType === filter.id}
              onClick={() => {
                setActiveType(filter.id);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              {filter.label}
            </FilterChip>
          ))}
        </div>
        <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-[var(--eh-text-secondary)]">
          Event date
          <input
            type="date"
            value={activeDate}
            onChange={(event) => {
              setActiveDate(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="rounded-xl border border-[var(--eh-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--eh-text-primary)] outline-none focus:border-[var(--eh-brand)] focus:ring-2 focus:ring-[var(--eh-brand)]/20"
            aria-label="Filter by event date"
          />
        </label>
      </SurfaceCard>

      {error ? (
        <SurfaceCard padding="lg" className="border-red-200 bg-red-50/40">
          <p className="text-sm font-semibold text-red-800">Timeline could not be loaded</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => void loadTimeline()}
          >
            Try again
          </Button>
        </SurfaceCard>
      ) : loading ? (
        <SurfaceCard padding="md" className="space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </SurfaceCard>
      ) : filteredDocuments.length === 0 ? (
        <SurfaceCard padding="lg" className="border-dashed text-center">
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">No timeline events found</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--eh-text-secondary)]">
            Upload a record or clear the filters to see profile-owned events here.
          </p>
          <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={clearFilters}>
            Clear filters
          </Button>
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[var(--eh-text-secondary)]">
              Showing {visibleDocuments.length} of {filteredDocuments.length} event
              {filteredDocuments.length === 1 ? "" : "s"}
            </p>
            {activeType !== "all" || activeDate ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
          {visibleDocuments.map((document) => {
            const eventObservations = observationsByDocument.get(document.id) ?? [];
            if (document.document_type === "lab_result") {
              const grouped = groupLaboratoryObservations(eventObservations);
              return (
                <LaboratoryEventCard
                  key={document.id}
                  document={document}
                  panels={grouped.panels}
                  ungrouped={grouped.ungrouped}
                  totalObservationCount={eventObservations.length}
                  eventHref={`/app/documents/${encodeURIComponent(document.id)}`}
                />
              );
            }
            return <SimpleTimelineEvent key={document.id} document={document} />;
          })}
          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Load more events
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
