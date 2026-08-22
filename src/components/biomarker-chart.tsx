"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type BiomarkerChartPoint = {
  id: string;
  observed_at: string;
  value: number;
  sourceHref?: string | null;
  sourceLabel?: string | null;
};

export function BiomarkerChart({
  data,
  biomarkerName,
  selectedObservationId,
}: {
  data: BiomarkerChartPoint[];
  biomarkerName: string;
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
  const sourcePoints = sorted.filter((point) => point.sourceHref);

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
      {sourcePoints.length > 0 ? (
        <section className="mt-4 border-t pt-3" aria-label={`${biomarkerName} source records`}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Source records
          </h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {sourcePoints.map((point) => (
              <li key={point.id}>
                <Link
                  href={point.sourceHref!}
                  aria-current={point.id === selectedObservationId ? "true" : undefined}
                  className={
                    point.id === selectedObservationId
                      ? "font-semibold text-teal-800 underline underline-offset-2"
                      : "text-teal-700 hover:underline"
                  }
                >
                  {point.observed_at} · {point.sourceLabel ?? "Open source document"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
