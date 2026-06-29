"use client";

import { useState } from "react";
import {
  resolveBodyMapLayout,
  stateScoreColor,
  stateScoreStroke,
  type BodySystemId,
  type SystemInsight,
} from "@/lib/health-systems";
import {
  BodySilhouette,
  BodyMapConnector,
  BodyMapMarker,
  BodyMapDefs,
  HealthSystemBadge,
  BODY_MAP_VIEWBOX,
} from "@/components/body-silhouette";
import { HealthProfileDrawer } from "@/components/health-profile-drawer";
import { cn } from "@/lib/utils";

const MAP_CENTER = { x: 231, y: 182 };
const DEFAULT_MAP_SCALE = 0.88;
const EMBEDDED_MAP_SCALE = 0.898;

type BodyMapProps = {
  systems: SystemInsight[];
  overallStateScore: number;
  overallDataConfidence: number;
  /** Hide floating summary — shown in page sidebar instead */
  embedded?: boolean;
  /** Scale silhouette + badges inside the SVG (profile uses a larger value) */
  mapScale?: number;
  externalSelectedId?: BodySystemId | null;
  onExternalSelect?: (id: BodySystemId | null) => void;
};

export function BodyMap({
  systems,
  overallStateScore,
  overallDataConfidence,
  embedded = false,
  mapScale,
  externalSelectedId,
  onExternalSelect,
}: BodyMapProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<BodySystemId | null>(null);

  const isControlled = externalSelectedId !== undefined;
  const selectedId = isControlled ? (externalSelectedId ?? null) : internalSelectedId;

  function selectSystem(id: BodySystemId) {
    if (onExternalSelect) {
      onExternalSelect(selectedId === id ? null : id);
      return;
    }
    setInternalSelectedId((prev) => (prev === id ? null : id));
  }

  const selected = systems.find((system) => system.id === selectedId) ?? null;
  const layouts = resolveBodyMapLayout(systems.map((system) => system.id));
  const selectedLayout = selected ? layouts.get(selected.id) : null;
  const hasSelection = selectedId != null;

  const mapItems = systems.flatMap((system) => {
    const layout = layouts.get(system.id);
    if (!layout) return [];
    return [{ system, layout }];
  });

  const resolvedMapScale =
    mapScale ?? (embedded ? EMBEDDED_MAP_SCALE : DEFAULT_MAP_SCALE);

  return (
    <>
      <div
        className={cn(
          "flex h-full w-full min-h-0 items-center justify-center",
          !embedded && "relative mx-auto max-w-md"
        )}
      >
        <svg
          viewBox={BODY_MAP_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Health profile body map"
          className={cn(
            embedded
              ? "h-full w-full max-h-full"
              : "block h-auto w-full max-h-[520px]"
          )}
        >
          <BodyMapDefs />
          <g className="body-group">
            <g
              transform={`translate(${MAP_CENTER.x} ${MAP_CENTER.y}) scale(${resolvedMapScale}) translate(${-MAP_CENTER.x} ${-MAP_CENTER.y})`}
            >
              <BodySilhouette />

              <g aria-hidden="true">
                {mapItems.map(({ system, layout }) => {
                  const active = selectedId === system.id;
                  const dimmed = hasSelection && !active;
                  return (
                    <BodyMapConnector
                      key={`${system.id}-connector`}
                      from={[layout.x, layout.y]}
                      to={[layout.anchorX, layout.anchorY]}
                      active={active}
                      dimmed={dimmed}
                      strokeColor={stateScoreStroke(system.state_score)}
                    />
                  );
                })}
              </g>

              <g aria-hidden="true">
                {mapItems.map(({ system, layout }) => {
                  const active = selectedId === system.id;
                  const dimmed = hasSelection && !active;
                  return (
                    <BodyMapMarker
                      key={`${system.id}-marker`}
                      x={layout.anchorX}
                      y={layout.anchorY}
                      active={active}
                      dimmed={dimmed}
                      className={stateScoreColor(system.state_score)}
                    />
                  );
                })}
              </g>

              <g>
              {mapItems.map(({ system, layout }, index) => {
                const active = selectedId === system.id;
                const dimmed = hasSelection && !active;
                return (
                  <HealthSystemBadge
                    key={system.id}
                    x={layout.x}
                    y={layout.y}
                    score={system.state_score}
                    label={layout.label}
                    active={active}
                    dimmed={dimmed}
                    index={index}
                    scoreClassName={stateScoreColor(system.state_score)}
                    onSelect={() => selectSystem(system.id)}
                  />
                );
              })}
              </g>
            </g>
          </g>
        </svg>

        {!embedded && (
          <div className="body-map-summary absolute right-0 top-0 rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
            <p className="text-xs text-muted-foreground">Overall current state assessment</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">
              {overallStateScore}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Data confidence {overallDataConfidence}%
            </p>
          </div>
        )}
      </div>

      {systems.length > 0 && !embedded && (
        <ul className="mt-4 space-y-1 text-sm">
          {systems.map((system) => {
            const layout = layouts.get(system.id);
            const isSelected = selectedId === system.id;
            return (
              <li key={system.id}>
                <button
                  type="button"
                  className={cn(
                    "body-map-list-item inline-block rounded-md px-1 py-0.5 text-left text-[var(--eh-health)]",
                    isSelected && "is-selected"
                  )}
                  onClick={() => selectSystem(system.id)}
                  aria-current={isSelected ? "true" : undefined}
                >
                  {layout?.label ?? system.name}: {system.state_score}/100 current state assessment
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!embedded && (
        <p className="mt-4 text-sm text-[var(--eh-text-secondary)]">
          Select a point on the map to view factual marker details and source documents.
        </p>
      )}

      <HealthProfileDrawer
        system={selected}
        layoutLabel={selectedLayout?.label ?? selected?.name ?? ""}
        open={selectedId != null}
        onClose={() => {
          if (onExternalSelect) onExternalSelect(null);
          else setInternalSelectedId(null);
        }}
      />
    </>
  );
}

export function BodyMapLegend() {
  return (
    <p className="text-xs text-[var(--eh-text-muted)]">
      Scores show a current state assessment from your uploaded lab records. Data confidence
      reflects how complete the evidence is. This is not a diagnosis or disease-risk score.
    </p>
  );
}
