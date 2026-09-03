import Link from "next/link";
import { Network } from "lucide-react";
import { buildHealthNavigationPath } from "@/lib/health-navigation";
import type {
  MeasurementRelationshipEdge,
  MeasurementRelationshipGraph,
  RelationshipNode,
} from "@/lib/knowledge/measurement-relationship-graph";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StatusChip } from "@/components/ui/status-chip";

export type RelatedMeasurementGraphStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

type RelatedMeasurementGraphProps = Readonly<{
  graph: MeasurementRelationshipGraph | null;
  status: RelatedMeasurementGraphStatus;
  returnTo?: string | null;
}>;

function neighborForEdge(
  graph: MeasurementRelationshipGraph,
  edge: MeasurementRelationshipEdge,
): RelationshipNode | null {
  const root = graph.root;
  const neighborRef =
    edge.source.kind === root.kind && edge.source.key === root.key
      ? edge.target
      : edge.source;
  return (
    graph.nodes.find(
      (node) => node.kind === neighborRef.kind && node.key === neighborRef.key,
    ) ?? null
  );
}

function RelationshipDetails({ edge }: { edge: MeasurementRelationshipEdge }) {
  if (edge.relationshipType === "panel_member") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--eh-text-muted)]">
        <span>
          {edge.role === "required"
            ? "Required panel member"
            : "Optional panel member"}
        </span>
        <span aria-hidden>·</span>
        <span>Catalog order {edge.displayOrder}</span>
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--eh-text-muted)]">
      <span>{edge.axisLabel}</span>
    </div>
  );
}

function GraphStateCard({
  status,
  graph,
  returnTo,
}: {
  status: RelatedMeasurementGraphStatus;
  graph: MeasurementRelationshipGraph | null;
  returnTo?: string | null;
}) {
  if (status === "loading") {
    return (
      <SurfaceCard
        padding="md"
        className="mt-8"
        aria-busy="true"
        data-testid="related-measurement-graph-loading"
      >
        <div className="space-y-3">
          <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-72 max-w-full animate-pulse rounded bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-50" />
        </div>
      </SurfaceCard>
    );
  }

  if (status === "error") {
    return (
      <SurfaceCard
        padding="md"
        className="mt-8 border-slate-200"
        role="status"
        data-testid="related-measurement-graph-error"
      >
        <h2 className="text-sm font-semibold text-[var(--eh-text-primary)]">
          Related measurements
        </h2>
        <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
          Educational relationships are temporarily unavailable. Your biomarker
          results are unchanged.
        </p>
      </SurfaceCard>
    );
  }

  if (status !== "ready" || !graph) return null;

  return (
    <SurfaceCard
      padding="md"
      className="mt-8"
      data-testid="related-measurement-graph"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Network className="size-4 text-[var(--eh-brand)]" aria-hidden />
            <h2 className="text-base font-semibold text-[var(--eh-text-primary)]">
              Related measurements
            </h2>
          </div>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            Catalog relationships for{" "}
            <span className="font-medium">{graph.root.displayName}</span>
          </p>
        </div>
        <StatusChip variant="neutral">Catalog {graph.version}</StatusChip>
      </div>

      <p className="mt-4 max-w-3xl text-xs leading-5 text-[var(--eh-text-muted)]">
        These links are educational catalog metadata. They do not change
        assessment scores or provide medical advice.
      </p>

      {graph.edges.length === 0 ? (
        <p
          className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-sm text-[var(--eh-text-secondary)]"
          data-testid="related-measurement-graph-empty"
        >
          No curated relationships are available for this measurement yet.
        </p>
      ) : (
        <ul
          className="mt-4 divide-y divide-slate-100"
          aria-label="Measurement relationships"
        >
          {graph.edges.map((edge) => {
            const neighbor = neighborForEdge(graph, edge);
            if (!neighbor) return null;
            const neighborHref =
              neighbor.kind === "measurement"
                ? buildHealthNavigationPath("/app/biomarkers", {
                    measurement: neighbor.key,
                    returnTo: returnTo ?? "/app/biomarkers",
                  })
                : null;
            return (
              <li key={edge.key} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {neighborHref ? (
                      <Link
                        href={neighborHref}
                        className="font-medium text-[var(--eh-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                      >
                        {neighbor.displayName}
                      </Link>
                    ) : (
                      <span className="font-medium text-[var(--eh-text-primary)]">
                        {neighbor.displayName}
                      </span>
                    )}
                    <p className="mt-1 max-w-3xl text-sm leading-5 text-[var(--eh-text-secondary)]">
                      {edge.description}
                    </p>
                    <RelationshipDetails edge={edge} />
                  </div>
                  <StatusChip variant="neutral">{edge.label}</StatusChip>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SurfaceCard>
  );
}

export function RelatedMeasurementGraph(props: RelatedMeasurementGraphProps) {
  return <GraphStateCard {...props} />;
}
