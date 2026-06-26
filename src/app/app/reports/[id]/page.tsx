"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReportBody, type ReportContent } from "@/components/report-body";
import {
  DETAIL_LEVEL_LABELS,
  REPORT_TYPE_LABELS,
  type DetailLevel,
  type ReportType,
} from "@/lib/report-prompts";

type ReportDetail = {
  id: string;
  title: string;
  report_type: ReportType;
  detail_level: DetailLevel;
  content: ReportContent;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Report not found");
        return r.json();
      })
      .then((data) => setReport(data.report))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading report…</p>;
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{error ?? "Report not found"}</p>
        <Button asChild variant="secondary">
          <Link href="/app/reports">Back to reports</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/app/reports">← Back to reports</Link>
          </Button>
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{REPORT_TYPE_LABELS[report.report_type]}</Badge>
            <Badge variant="outline">{DETAIL_LEVEL_LABELS[report.detail_level]}</Badge>
            <span className="text-sm text-muted-foreground">{formatDate(report.created_at)}</span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/reports/create">Create another report</Link>
        </Button>
      </div>

      <ReportBody content={report.content} />
    </div>
  );
}
