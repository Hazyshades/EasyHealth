"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Point = { observed_at: string; value: number };

export function BiomarkerChart({
  data,
  biomarkerName,
}: {
  data: Point[];
  biomarkerName: string;
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
    </div>
  );
}
