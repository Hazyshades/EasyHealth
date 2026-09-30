"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  REPORT_EXPORT_FORMATS,
  type ReportExportFormat,
} from "@/lib/report-export/types";

export type ReportExportActionsProps = Readonly<{
  formats: readonly ReportExportFormat[];
  onExport: (format: ReportExportFormat) => Promise<void> | void;
  disabled?: boolean;
}>;

const FORMAT_LABELS: Record<ReportExportFormat, string> = {
  pdf: "PDF",
  csv: "CSV",
  json: "JSON",
};

export function ReportExportActions({
  formats,
  onExport,
  disabled = false,
}: ReportExportActionsProps) {
  const [pendingFormat, setPendingFormat] = useState<ReportExportFormat | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const availableFormats = REPORT_EXPORT_FORMATS.filter((format) =>
    formats.includes(format),
  );

  if (availableFormats.length === 0) return null;

  async function handleExport(format: ReportExportFormat): Promise<void> {
    setPendingFormat(format);
    setError(null);
    try {
      await onExport(format);
    } catch {
      setError("This report could not be exported. Try again.");
    } finally {
      setPendingFormat(null);
    }
  }

  return (
    <div className="space-y-2" aria-busy={pendingFormat !== null}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">
          Export report
        </span>
        {availableFormats.map((format) => {
          const pending = pendingFormat === format;
          return (
            <Button
              key={format}
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={disabled || pendingFormat !== null}
              aria-label={`Export report as ${FORMAT_LABELS[format]}`}
              onClick={() => void handleExport(format)}
            >
              {pending
                ? `Preparing ${FORMAT_LABELS[format]}…`
                : `Export ${FORMAT_LABELS[format]}`}
            </Button>
          );
        })}
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
