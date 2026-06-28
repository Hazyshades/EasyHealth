"use client";

import { useState } from "react";
import {
  resolveBodyMapLayout,
  stateScoreColor,
  type BodySystemId,
  type SystemInsight,
} from "@/lib/health-systems";
import {
  BodySilhouette,
  BodyMapConnector,
  BodyMapMarker,
  HealthSystemBadge,
  BODY_MAP_VIEWBOX,
} from "@/components/body-silhouette";
import { HealthProfileDrawer } from "@/components/health-profile-drawer";

const MAP_CENTER = { x: 231, y: 182 };
const MAP_SCALE = 0.88;

type BodyMapProps = {
  systems: SystemInsight[];
  overallStateScore: number;
  overallDataConfidence: number;
};

export function BodyMap({ systems, overallStateScore, overallDataConfidence }: BodyMapProps) {
  const [selectedId, setSelectedId] = useState<BodySystemId | null>(null);
  const selected = systems.find((system) => system.id === selectedId) ?? null;
  const layouts = resolveBodyMapLayout(systems.map((system) => system.id));
  const selectedLayout = selected ? layouts.get(selected.id) : null;

  const mapItems = systems.flatMap((system) => {
    const layout = layouts.get(system.id);
    if (!layout) return [];
    return [{ system, layout }];
  });

  return (
    <>
      <div className="relative mx-auto flex w-full max-w-md justify-center">
        <svg
          viewBox={BODY_MAP_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Health profile body map"
          className="block h-auto w-full max-h-[520px]"
        >
          <g
            transform={`translate(${MAP_CENTER.x} ${MAP_CENTER.y}) scale(${MAP_SCALE}) translate(${-MAP_CENTER.x} ${-MAP_CENTER.y})`}
          >
            <BodySilhouette />

            <g aria-hidden="true">
              {mapItems.map(({ system, layout }) => (
                <BodyMapConnector
                  key={`${system.id}-connector`}
                  from={[layout.x, layout.y]}
                  to={[layout.anchorX, layout.anchorY]}
                />
              ))}
            </g>

            <g>
              {mapItems.map(({ system, layout }) => (
                <BodyMapMarker
                  key={`${system.id}-marker`}
                  x={layout.anchorX}
                  y={layout.anchorY}
                  active={selectedId === system.id}
                  className={stateScoreColor(system.state_score)}
                />
              ))}
            </g>

            <g>
              {mapItems.map(({ system, layout }) => (
                <HealthSystemBadge
                  key={system.id}
                  x={layout.x}
                  y={layout.y}
                  score={system.state_score}
                  label={layout.label}
                  active={selectedId === system.id}
                  scoreClassName={stateScoreColor(system.state_score)}
                  onSelect={() => setSelectedId(system.id)}
                />
              ))}
            </g>
          </g>
        </svg>

        <div className="absolute right-0 top-0 rounded-lg border bg-white p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Overall current state assessment</p>
          <p className="text-3xl font-bold text-slate-900">{overallStateScore}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Data confidence {overallDataConfidence}%
          </p>
        </div>
      </div>

      {systems.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {systems.map((system) => {
            const layout = layouts.get(system.id);
            return (
              <li key={system.id}>
                <button
                  type="button"
                  className="text-left text-teal-700 hover:underline"
                  onClick={() => setSelectedId(system.id)}
                >
                  {layout?.label ?? system.name}: {system.state_score}/100 current state assessment
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Select a point on the map to view factual marker details and source documents.
      </p>

      <HealthProfileDrawer
        system={selected}
        layoutLabel={selectedLayout?.label ?? selected?.name ?? ""}
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}

export function BodyMapLegend() {
  return (
    <p className="text-xs text-muted-foreground">
      Scores show a current state assessment from your uploaded lab records. Data confidence
      reflects how complete the evidence is. This is not a diagnosis or disease-risk score.
    </p>
  );
}
