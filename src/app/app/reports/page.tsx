"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { ChevronDown, RefreshCw } from "lucide-react";

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
      <li key={report.id} className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{report.title}</h2>
            <p className="mt-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
              {report.summary_preview}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{REPORT_TYPE_LABELS[report.report_type]}</Badge>
              <Badge variant="outline">{DETAIL_LEVEL_LABELS[report.detail_level]}</Badge>
              {report.abnormal_only && (
                <Badge variant="outline" className="border-amber-300 text-amber-800">
                  Out-of-range only
                </Badge>
              )}
              <span>{formatDate(report.created_at)}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/app/reports/${report.id}`}>View</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              disabled={deletingId === report.id}
              onClick={() => handleDelete(report.id, report.title)}
            >
              {deletingId === report.id ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Health reports</h1>
          <p className="text-muted-foreground">
            Customizable educational reports for clinicians and specialists
          </p>
        </div>
        <Button asChild>
          <Link href="/app/reports/create">+ Create report</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={range} onValueChange={(v) => setRange(v as ReportRange)}>
          <SelectTrigger className="w-[160px]">
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
          <SelectTrigger className="w-[200px]">
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
          onClick={loadReports}
          disabled={loading}
          aria-label="Refresh reports"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reports…</p>
      ) : reports.length === 0 && !hasActiveFilters ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <h2 className="font-semibold">No reports yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first health report from uploaded lab results.
          </p>
          <Button asChild className="mt-4">
            <Link href="/app/reports/create">Create report</Link>
          </Button>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <h2 className="font-semibold">No matching reports</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search or filters.
          </p>
          <Button variant="secondary" className="mt-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map(([month, items]) => {
            const collapsed = collapsedMonths.has(month);
            return (
              <section key={month}>
                <button
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className="mb-3 flex w-full items-center gap-2 text-left text-sm font-semibold text-slate-800"
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform", collapsed && "-rotate-90")}
                  />
                  <span>
                    {month} ({items.length})
                  </span>
                </button>
                {!collapsed && (
                  <ul className="space-y-3">{items.map(renderReportCard)}</ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
