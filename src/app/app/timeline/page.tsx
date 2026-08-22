"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/health-systems";
import {
  TIMELINE_EVENT_TYPES,
  parseTimelineQuery,
  type TimelineEvent,
  type TimelineEventType,
} from "@/lib/timeline";
import {
  buildHealthNavigationPath,
  healthRouteLabel,
  readHealthNavigationContext,
  type HealthNavigationContext,
} from "@/lib/health-navigation";

type TimelineFilterType = "all" | TimelineEventType;

type TimelineResponse = {
  profile?: { id: string; label: string };
  events?: TimelineEvent[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
  error?: string;
};

const EMPTY_PAGINATION = {
  page: 1,
  pageSize: 10,
  total: 0,
  hasNext: false,
};
const EMPTY_NAVIGATION_CONTEXT: HealthNavigationContext = {
  system: null,
  measurement: null,
  observation: null,
  returnTo: null,
};

function formatEventDate(value: string | null): string {
  if (!value) return "Date not available";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function statusVariant(
  status: string,
): "success" | "warning" | "error" | "neutral" {
  if (status === "completed" || status === "ready") return "success";
  if (status === "failed") return "error";
  if (status === "processing") return "warning";
  return "neutral";
}

function eventStatus(event: TimelineEvent): string | null {
  if (event.processingStatus === "processing") return "Processing";
  if (event.processingStatus === "failed") return "Processing failed";
  return null;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading health timeline" role="status">
      {Array.from({ length: 4 }).map((_, index) => (
        <SurfaceCard key={index} padding="lg" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </SurfaceCard>
      ))}
    </div>
  );
}

function TimelineEventCard({
  event,
  sourceHref,
  timelineReturnPath,
}: {
  event: TimelineEvent;
  sourceHref: string;
  timelineReturnPath: string;
}) {
  const processingLabel = eventStatus(event);
  const location = event.provider ?? event.labName;
  return (
    <article className="relative pl-5 sm:pl-8">
      <span
        className="absolute left-0 top-6 size-3 rounded-full border-2 border-white bg-[var(--eh-brand)] shadow-[0_0_0_2px_var(--eh-brand-soft)] sm:left-1.5"
        aria-hidden
      />
      <SurfaceCard padding="lg" className="transition-colors hover:border-[var(--eh-brand)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip variant="neutral">{event.typeLabel}</StatusChip>
              {processingLabel ? (
                <StatusChip variant={statusVariant(event.processingStatus)}>
                  {processingLabel}
                </StatusChip>
              ) : null}
            </div>
            <h3 className="mt-3 break-words text-lg font-semibold text-[var(--eh-text-primary)]">
              {event.title}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--eh-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden />
                {formatEventDate(event.eventDate)}
              </span>
              {location ? <span>· {location}</span> : null}
            </p>
          </div>
          <Link
            href={sourceHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--eh-brand)] transition-colors hover:bg-[var(--eh-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
            aria-label={`Open source document ${event.source.filename}`}
          >
            Open source
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>

        {event.summary ? (
          <p className="mt-4 text-sm leading-6 text-[var(--eh-text-secondary)]">{event.summary}</p>
        ) : null}

        {event.measurements.length > 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--eh-text-muted)]">
              Measurements{event.measurementCount > event.measurements.length ? ` · ${event.measurementCount} total` : ""}
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {event.measurements.map((measurement) => {
                const measurementHref = buildHealthNavigationPath(
                  `/app/documents/${event.documentId}`,
                  {
                    observation: measurement.id,
                    returnTo: timelineReturnPath,
                  },
                );
                return (
                  <li
                    key={measurement.id}
                    className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
                  >
                    <Link
                      href={measurementHref}
                      className="truncate text-[var(--eh-text-secondary)] hover:text-[var(--eh-brand)] hover:underline"
                    >
                      {measurement.name}
                    </Link>
                    <span className="shrink-0 font-medium text-[var(--eh-text-primary)]">
                      {measurement.value ?? "—"}
                      {measurement.unit ? ` ${measurement.unit}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {event.details.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm text-[var(--eh-text-secondary)]">
            {event.details.map((detail) => (
              <li key={detail} className="leading-5">
                {detail}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--eh-border)] pt-3 text-xs text-[var(--eh-text-muted)]">
          <span>{event.source.filename}</span>
          {event.datePrecision === "unknown" ? <span>Medical date not recorded</span> : null}
          {event.status !== "completed" && event.status !== "ready" ? (
            <span>{event.status}</span>
          ) : null}
        </div>
      </SurfaceCard>
    </article>
  );
}

export default function TimelinePage() {
  const [navigationContext, setNavigationContext] =
    useState<HealthNavigationContext>(EMPTY_NAVIGATION_CONTEXT);
  const [filterType, setFilterType] = useState<TimelineFilterType>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [profileLabel, setProfileLabel] = useState("Loading profile…");
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    setNavigationContext(readHealthNavigationContext(searchParams));
    const parsedQuery = parseTimelineQuery(searchParams);
    if ("value" in parsedQuery) {
      setFilterType(parsedQuery.value.type ?? "all");
      setFrom(parsedQuery.value.from ?? "");
      setTo(parsedQuery.value.to ?? "");
      setPage(parsedQuery.value.page);
    }
    setNavigationReady(true);
  }, []);

  const loadTimeline = useCallback(
    async (requestedPage: number) => {
      const version = requestVersion.current + 1;
      requestVersion.current = version;
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        type: filterType,
        page: String(requestedPage),
        pageSize: String(EMPTY_PAGINATION.pageSize),
      });
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      try {
        const response = await fetch(`/api/timeline?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as TimelineResponse;
        if (!response.ok) throw new Error(data.error ?? "Unable to load your health timeline");
        if (version !== requestVersion.current) return;
        setEvents(data.events ?? []);
        setPagination(data.pagination ?? EMPTY_PAGINATION);
        setProfileLabel(data.profile?.label ?? "Active profile");
      } catch (requestError) {
        if (version !== requestVersion.current) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your health timeline",
        );
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    },
    [filterType, from, to],
  );

  useEffect(() => {
    if (!navigationReady) return;
    void loadTimeline(page);
  }, [loadTimeline, navigationReady, page]);
  const hasActiveFilters = Boolean(filterType !== "all" || from || to);

  const firstResult = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastResult = Math.min(pagination.page * pagination.pageSize, pagination.total);

  function clearFilters() {
    setFilterType("all");
    setFrom("");
    setTo("");
    setPage(1);
  }
  const timelineQuery = new URLSearchParams({
    type: filterType,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  });
  if (from) timelineQuery.set("from", from);
  if (to) timelineQuery.set("to", to);
  const timelineReturnPath = buildHealthNavigationPath(
    `/app/timeline?${timelineQuery.toString()}`,
    { returnTo: navigationContext.returnTo },
  );
  const originPath = navigationContext.returnTo ?? "/app";

  return (
    <div className="pb-8">
      <ContextBreadcrumbs
        items={[
          { href: originPath, label: healthRouteLabel(originPath) },
          { label: "Health Timeline" },
        ]}
      />
      <PageHeader
        title="Health Timeline"
        subtitle="Your medical events in chronological order"
        actions={
          <Button
            asChild
            className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
          >
            <Link href="/app/upload">Add document</Link>
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <SurfaceCard padding="sm" className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
            <FileText className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
              Active profile
            </p>
            <p className="truncate text-sm font-semibold text-[var(--eh-text-primary)]">
              {profileLabel}
            </p>
          </div>
        </SurfaceCard>
        <p className="text-xs leading-5 text-[var(--eh-text-muted)] lg:max-w-xs lg:text-right">
          Dates reflect the medical record. Missing dates are shown explicitly.
        </p>
      </div>

      <SurfaceCard padding="sm" className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-[var(--eh-text-secondary)]" htmlFor="timeline-type">
              Document type
            </label>
            <Select
              value={filterType}
              onValueChange={(value) => {
                setFilterType(value as TimelineFilterType);
                setPage(1);
              }}
            >
              <SelectTrigger id="timeline-type" className="w-full rounded-xl">
                <SelectValue placeholder="All document types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All document types</SelectItem>
                {TIMELINE_EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type as DocumentType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--eh-text-secondary)]" htmlFor="timeline-from">
              From
            </label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--eh-text-muted)]" aria-hidden />
              <input
                id="timeline-from"
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl border border-[var(--eh-border)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--eh-text-primary)] outline-none transition focus:border-[var(--eh-brand)] focus:ring-2 focus:ring-[var(--eh-brand)]/20"
                aria-label="Timeline start date"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--eh-text-secondary)]" htmlFor="timeline-to">
              To
            </label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--eh-text-muted)]" aria-hidden />
              <input
                id="timeline-to"
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl border border-[var(--eh-border)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--eh-text-primary)] outline-none transition focus:border-[var(--eh-brand)] focus:ring-2 focus:ring-[var(--eh-brand)]/20"
                aria-label="Timeline end date"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="h-10 rounded-xl"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Clear filters
          </Button>
        </div>
      </SurfaceCard>

      {error ? (
        <SurfaceCard padding="lg" className="border-red-200 bg-red-50/40 text-center" role="alert">
          <h2 className="font-semibold text-[var(--eh-text-primary)]">Timeline unavailable</h2>
          <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadTimeline(page)}
            className="mt-5 rounded-xl"
          >
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </Button>
        </SurfaceCard>
      ) : loading ? (
        <TimelineSkeleton />
      ) : pagination.total === 0 ? (
        <SurfaceCard padding="lg" className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
            <CalendarDays className="size-6" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[var(--eh-text-primary)]">
            {hasActiveFilters ? "No events match your filters" : "No timeline events yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--eh-text-secondary)]">
            {hasActiveFilters
              ? "Try a different document type or date range."
              : "Upload a medical document to start building your chronological health record."}
          </p>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={clearFilters} className="mt-5 rounded-xl">
              Clear filters
            </Button>
          ) : (
            <Button asChild className="mt-5 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
              <Link href="/app/upload">Upload document</Link>
            </Button>
          )}
        </SurfaceCard>
      ) : (
        <>
          <div className="relative space-y-4 before:absolute before:bottom-6 before:left-[5px] before:top-6 before:w-px before:bg-[var(--eh-border)] sm:before:left-[11px]">
            {events.map((event) => {
              const sourceHref = buildHealthNavigationPath(event.source.href, {
                returnTo: timelineReturnPath,
              });
              return (
                <TimelineEventCard
                  key={event.id}
                  event={event}
                  sourceHref={sourceHref}
                  timelineReturnPath={timelineReturnPath}
                />
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--eh-text-secondary)]">
              Showing {firstResult}–{lastResult} of {pagination.total} events
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loading || pagination.page <= 1}
                className="rounded-xl"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </Button>
              <span className="px-1 text-sm text-[var(--eh-text-muted)]">Page {pagination.page}</span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={loading || !pagination.hasNext}
                className="rounded-xl"
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
