"use client";

import { useState } from "react";
import {
  BODY_MAP_LAYOUT,
  type BodySystemId,
  type SystemInsight,
} from "@/lib/health-systems";
import { BodySilhouette, BODY_MAP_VIEWBOX } from "@/components/body-silhouette";
import { cn } from "@/lib/utils";

const MAP_CENTER = { x: 231, y: 178 };
const MAP_SCALE = 0.9;

function coverageColor(coverage: number): string {
  if (coverage >= 70) return "fill-emerald-500 stroke-emerald-600";
  if (coverage >= 40) return "fill-amber-500 stroke-amber-600";
  return "fill-slate-400 stroke-slate-500";
}

function statusLabel(status: string): string {
  if (status === "out_of_range") return "Outside lab reference range";
  if (status === "in_range") return "Within lab reference range";
  return "No reference range on document";
}

type BodyMapProps = {
  systems: SystemInsight[];
  overallCoverage: number;
};

export function BodyMap({ systems, overallCoverage }: BodyMapProps) {
  const [selectedId, setSelectedId] = useState<BodySystemId | null>(null);
  const selected = systems.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="relative mx-auto flex w-full max-w-md justify-center">
        <svg
          viewBox={BODY_MAP_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto w-full max-h-[520px]"
          aria-label="Body map"
        >
          <g
            transform={`translate(${MAP_CENTER.x} ${MAP_CENTER.y}) scale(${MAP_SCALE}) translate(${-MAP_CENTER.x} ${-MAP_CENTER.y})`}
          >
            <BodySilhouette />

            {systems.map((system) => {
            const layout = BODY_MAP_LAYOUT[system.id];
            if (!layout) return null;
            const active = selectedId === system.id;
            return (
              <g key={system.id}>
                <line
                  x1={layout.x}
                  y1={layout.y}
                  x2={layout.anchorX}
                  y2={layout.anchorY}
                  className="stroke-slate-300"
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={layout.anchorX}
                  cy={layout.anchorY}
                  r={active ? 3.5 : 2.8}
                  className={cn(coverageColor(system.coverage), active && "stroke-[1.5]")}
                />
                <g
                  className="cursor-pointer"
                  onClick={() => setSelectedId(system.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(system.id);
                    }
                  }}
                >
                  <circle
                    cx={layout.x}
                    cy={layout.y}
                    r={active ? 13 : 11}
                    className={cn(
                      coverageColor(system.coverage),
                      "transition-all",
                      active && "stroke-[2]"
                    )}
                  />
                  <text
                    x={layout.x}
                    y={layout.y + 1}
                    textAnchor="middle"
                    className="pointer-events-none fill-white text-[9px] font-semibold"
                  >
                    {system.coverage}
                  </text>
                  <text
                    x={layout.x}
                    y={layout.y + 20}
                    textAnchor="middle"
                    className="pointer-events-none fill-slate-600 text-[7px] font-medium"
                  >
                    {layout.label}
                  </text>
                </g>
              </g>
            );
          })}
          </g>
        </svg>

        <div className="absolute right-0 top-0 rounded-lg border bg-white p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Overall data coverage</p>
          <p className="text-3xl font-bold text-slate-900">{overallCoverage}%</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        {selected ? (
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">{selected.name}</h3>
              <p className="text-sm text-muted-foreground">
                Data coverage: {selected.coverage}%
              </p>
            </div>
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {selected.markers.map((marker) => (
                <li key={marker.key} className="rounded-md border p-2">
                  <p className="font-medium">{marker.name}</p>
                  <p>
                    {marker.value} {marker.unit}
                  </p>
                  <p className="text-xs text-muted-foreground">{statusLabel(marker.status)}</p>
                  <p className="text-xs text-muted-foreground">Observed {marker.observed_at}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a point on the map to view marker details with source dates.
          </p>
        )}

        {!selected && systems.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {systems.map((system) => {
              const layout = BODY_MAP_LAYOUT[system.id];
              return (
                <li key={system.id}>
                  <button
                    type="button"
                    className="text-left text-teal-700 hover:underline"
                    onClick={() => setSelectedId(system.id)}
                  >
                    {layout?.label ?? system.name}: {system.coverage}% coverage
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function BodyMapLegend() {
  return (
    <p className="text-xs text-muted-foreground">
      Percentages show data coverage from your uploaded records, not a clinical health score.
    </p>
  );
}
