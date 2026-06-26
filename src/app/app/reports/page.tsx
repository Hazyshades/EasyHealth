"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DETAIL_LEVEL_LABELS,
  REPORT_TYPE_LABELS,
  type DetailLevel,
  type ReportType,
} from "@/lib/report-prompts";

type ReportSummary = {
  id: string;
  title: string;
  report_type: ReportType;
  detail_level: DetailLevel;
  summary_preview: string;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadReports = useCallback(() => {
    setLoading(true);
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reports…</p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <h2 className="font-semibold">No reports yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first health report from uploaded lab results.
          </p>
          <Button asChild className="mt-4">
            <Link href="/app/reports/create">Create report</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{report.title}</h2>
                  <p className="mt-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
                    {report.summary_preview}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">
                      {REPORT_TYPE_LABELS[report.report_type]}
                    </Badge>
                    <Badge variant="outline">
                      {DETAIL_LEVEL_LABELS[report.detail_level]}
                    </Badge>
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
          ))}
        </ul>
      )}
    </div>
  );
}
