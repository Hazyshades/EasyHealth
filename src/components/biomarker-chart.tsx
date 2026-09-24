"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BiomarkerChartPoint = {
  id: string;
  observed_at: string;
  value: number;
  unit: string | null;
  native_value: number;
  native_unit: string | null;
  native_ref_low: number | null;
  native_ref_high: number | null;
  laboratory: string | null;
  source: {
    href: string;
    filename: string;
  } | null;
  sourceHref?: string | null;
  sourceLabel?: string | null;
};

export function BiomarkerChart({
  data,
  biomarkerName,
  points = [],
  selectedObservationId,
}: {
  data: Array<{ observed_at: string; value: number }>;
  biomarkerName: string;
  points?: BiomarkerChartPoint[];
  selectedObservationId?: string | null;
}) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Select a biomarker with data to see trends
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => a.observed_at.localeCompare(b.observed_at));

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-4 font-medium">{biomarkerName} over time</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sorted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="observed_at" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {sorted.length === 1 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Upload more labs with this biomarker to see a trend line.
        </p>
      )}
      {points.length > 0 ? (
        <div className="mt-5 border-t pt-4">
          <h4 className="text-sm font-semibold text-[var(--eh-text-primary)]">Source records</h4>
          <p className="mt-1 text-xs text-[var(--eh-text-muted)]">Point evidence for the selected measurement</p>
          <ol className="mt-3 space-y-3" aria-label={`${biomarkerName} point evidence`}>
            {points.map((point) => {
              const nativeRange =
                point.native_ref_low != null && point.native_ref_high != null
                  ? `${point.native_ref_low}–${point.native_ref_high}${point.native_unit ? ` ${point.native_unit}` : ""}`
                  : "Range not available";
              const sourceHref = point.sourceHref ?? point.source?.href ?? null;
              const sourceFilename =
                point.sourceLabel ?? point.source?.filename ?? "Source document";
              const isSelected = point.id === selectedObservationId;
              return (
                <li
                  key={point.id}
                  className={
                    isSelected
                      ? "flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-lg bg-[var(--eh-brand-soft)] px-3 py-2 text-sm ring-1 ring-[var(--eh-brand)]"
                      : "flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-lg bg-[var(--eh-canvas-bg)] px-3 py-2 text-sm"
                  }
                >
                  <div>
                    <p className="font-medium text-[var(--eh-text-primary)]">
                      {point.observed_at} · {point.value}
                      {point.unit ? ` ${point.unit}` : ""}
                    </p>
                    <p className="text-xs text-[var(--eh-text-secondary)]">
                      Lab value: {point.native_value}
                      {point.native_unit ? ` ${point.native_unit}` : ""} · Native range: {nativeRange}
                    </p>
                    {point.laboratory ? (
                      <p className="text-xs text-[var(--eh-text-muted)]">{point.laboratory}</p>
                    ) : null}
                  </div>
                  {point.source ? (
                    <Link
                      href={point.source.href}
                      className="shrink-0 rounded-md px-1 py-0.5 text-xs font-medium text-[var(--eh-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                      aria-current={isSelected ? "true" : undefined}
                      aria-label={`Open source document ${sourceFilename}`}
                    >
                      Open source
                    </Link>
                  ) : sourceHref ? (
                    <Link
                      href={sourceHref}
                      className="shrink-0 rounded-md px-1 py-0.5 text-xs font-medium text-[var(--eh-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                      aria-current={isSelected ? "true" : undefined}
                      aria-label={`Open source document ${sourceFilename}`}
                    >
                      Open source
                    </Link>
                  ) : (
                    <span className="shrink-0 text-xs text-[var(--eh-text-muted)]">Source unavailable</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
