"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ClipboardList, RefreshCw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StatusChip } from "@/components/ui/status-chip";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DETAIL_LEVEL_LABELS,
  REPORT_RANGE_LABELS,
  REPORT_RANGE_OPTIONS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  type DetailLevel,
  type ReportRange,
  type ReportType,
} from "@/lib/report-prompts";
import { cn } from "@/lib/utils";

type ReportSummary = {
  id: string;
  title: string;
  report_type: ReportType;
  detail_level: DetailLevel;
  summary_preview: string;
  abnormal_only: boolean;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthGroupKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function groupByMonth(reports: ReportSummary[]) {
  const groups = new Map<string, ReportSummary[]>();
  for (const report of reports) {
    const key = monthGroupKey(report.created_at);
    const list = groups.get(key) ?? [];
    list.push(report);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function buildReportsUrl(search: string, range: ReportRange, typeFilter: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("q", search.trim());
  if (range !== "all") params.set("range", range);
  if (typeFilter !== "all") params.set("type", typeFilter);
  const qs = params.toString();
  return qs ? `/api/reports?${qs}` : "/api/reports";
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [range, setRange] = useState<ReportRange>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 || range !== "all" || typeFilter !== "all";

  const loadReports = useCallback(() => {
    setLoading(true);
    fetch(buildReportsUrl(debouncedSearch, range, typeFilter))
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, [debouncedSearch, range, typeFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const monthGroups = useMemo(() => groupByMonth(reports), [reports]);

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setRange("all");
    setTypeFilter("all");
  }

  function toggleMonth(month: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Delete failed");
      }
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  function renderReportCard(report: ReportSummary) {
    return (
      <SurfaceCard key={report.id} padding="md" hoverable>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-[var(--eh-text-primary)]">{report.title}</h2>
            <p className="mt-2 rounded-xl bg-[var(--eh-chip-green-bg)] px-3 py-2 text-sm text-[var(--eh-chip-green-text)]">
              {report.summary_preview}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <StatusChip variant="neutral">{REPORT_TYPE_LABELS[report.report_type]}</StatusChip>
              <StatusChip variant="info">{DETAIL_LEVEL_LABELS[report.detail_level]}</StatusChip>
              {report.abnormal_only && (
                <StatusChip variant="warning">Out-of-range only</StatusChip>
              )}
              <span className="text-[var(--eh-text-muted)]">{formatDate(report.created_at)}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href={`/app/reports/${report.id}`}>View</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-red-600 hover:text-red-700"
              disabled={deletingId === report.id}
              onClick={() => handleDelete(report.id, report.title)}
            >
              {deletingId === report.id ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div>
      <PageHeader
        title="Health reports"
        subtitle="Customizable educational reports for clinicians and specialists"
        actions={
          <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
            <Link href="/app/reports/create">
              <Sparkles className="size-4" aria-hidden />
              Create report
            </Link>
          </Button>
        }
      />

      <SurfaceCard padding="lg" className="mb-8">
        <div className="flex flex-wrap items-start gap-6">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
            <ClipboardList className="size-7" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--eh-text-primary)]">
                Generate a health report
              </h2>
              <StatusChip variant="info">$0.05 USDC</StatusChip>
            </div>
            <p className="mt-2 max-w-xl text-sm text-[var(--eh-text-secondary)]">
              Create an educational summary from your uploaded lab records. Paid via x402 on Arc
              Network — wallet balance shown in the top bar.
            </p>
            <Button asChild className="mt-4 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
              <Link href="/app/reports/create">Generate report</Link>
            </Button>
          </div>
        </div>
      </SurfaceCard>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          placeholder="Search reports…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search reports"
        />
        <Select value={range} onValueChange={(v) => setRange(v as ReportRange)}>
          <SelectTrigger className="w-full rounded-xl sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {REPORT_RANGE_LABELS[opt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full rounded-xl sm:w-[200px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {REPORT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {REPORT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-xl"
          onClick={loadReports}
          disabled={loading}
          aria-label="Refresh reports"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--eh-text-secondary)]">Loading reports…</p>
      ) : reports.length === 0 && !hasActiveFilters ? (
        <SurfaceCard padding="lg" className="text-center">
          <h2 className="font-semibold text-[var(--eh-text-primary)]">No reports yet</h2>
          <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
            Create your first health report from uploaded lab results.
          </p>
          <Button asChild className="mt-4 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
            <Link href="/app/reports/create">Create report</Link>
          </Button>
        </SurfaceCard>
      ) : reports.length === 0 ? (
        <SurfaceCard padding="lg" className="text-center">
          <h2 className="font-semibold text-[var(--eh-text-primary)]">No matching reports</h2>
          <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
            Try adjusting your search or filters.
          </p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={clearFilters}>
            Clear filters
          </Button>
        </SurfaceCard>
      ) : (
        <div className="space-y-6">
          {monthGroups.map(([month, items]) => {
            const collapsed = collapsedMonths.has(month);
            return (
              <section key={month}>
                <button
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className="mb-3 flex w-full items-center gap-2 text-left text-sm font-semibold text-[var(--eh-text-primary)]"
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform duration-200", collapsed && "-rotate-90")}
                  />
                  <span>
                    {month} ({items.length})
                  </span>
                </button>
                {!collapsed && <ul className="space-y-3">{items.map(renderReportCard)}</ul>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
