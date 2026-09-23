"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BiomarkerTable } from "@/components/biomarker-table";
import {
  BiomarkerChart,
  type BiomarkerChartPoint,
} from "@/components/biomarker-chart";
import {
  RelatedMeasurementGraph,
  type RelatedMeasurementGraphStatus,
} from "@/components/knowledge/related-measurement-graph";
import type { MeasurementRelationshipGraph } from "@/lib/knowledge/measurement-relationship-graph";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { FilterChip } from "@/components/ui/filter-chip";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import {
  buildHealthNavigationPath,
  healthRouteLabel,
  readHealthNavigationContext,
} from "@/lib/health-navigation";
import type { BiomarkerDynamicsReport } from "@/lib/biomarker-dynamics";
import {
  formatBiomarkerDynamicsSeriesLabel,
  formatBiomarkerDynamicsValue,
} from "@/lib/biomarker-dynamics-format";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import type { AssessmentExclusionReason } from "@/lib/health-profile-assessment-eligibility";

type LabUnitSystem = "us" | "si";

type BiomarkersPageProps = Readonly<{
  reviewedMeasurementKeys: readonly string[];
}>;

type Observation = {
  id: string;
  name: string;
  measurement_definition_key: string | null;
  analyte_key: string | null;
  resolution_status: string | null;
  verification_status?: string | null;
  registry_binding_ready?: boolean;
  trend_eligible?: boolean;
  conversion_eligible?: boolean;
  assessment_eligible?: boolean;
  assessment_exclusion_reason?: AssessmentExclusionReason | null;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  document_id: string | null;
  documents?: {
    id: string;
    original_filename: string;
    lab_name?: string | null;
  } | null;
  converted?: boolean;
  conversion_note?: string | null;
  original_value?: number | null;
  original_unit?: string | null;
  original_ref_low?: number | null;
  original_ref_high?: number | null;
  value_kind?: string | null;
  value_text?: string | null;
  specimen?: string | null;
  modifier?: string | null;
};

type StatusFilter = "all" | "normal" | "attention" | "low" | "high" | "mapping";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "normal", label: "Normal" },
  { id: "attention", label: "Attention" },
  { id: "mapping", label: "Needs mapping" },
  { id: "low", label: "Low" },
  { id: "high", label: "High" },
];

function observationStatus(o: Observation): StatusFilter {
  if (!o.registry_binding_ready) return "mapping";
  if (o.value_kind && o.value_kind !== "numeric") return "normal";
  if (o.value == null || o.ref_low == null || o.ref_high == null)
    return "normal";
  if (o.value < o.ref_low) return "low";
  if (o.value > o.ref_high) return "high";
  return "normal";
}

function matchesStatusFilter(o: Observation, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  const status = observationStatus(o);
  if (filter === "attention") return status === "low" || status === "high";
  return status === filter;
}

function getReviewedMeasurementKey(
  value: string | null,
  reviewedMeasurementKeys: readonly string[],
): string | null {
  const key = value?.trim() ?? "";
  return reviewedMeasurementKeys.includes(key) ? key : null;
}

export default function BiomarkersPage({
  reviewedMeasurementKeys,
}: BiomarkersPageProps) {
  const searchParams = useSearchParams();
  const navigationContext = readHealthNavigationContext(searchParams);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedObservationId, setSelectedObservationId] = useState("");
  const [relatedGraph, setRelatedGraph] =
    useState<MeasurementRelationshipGraph | null>(null);
  const [relatedGraphStatus, setRelatedGraphStatus] =
    useState<RelatedMeasurementGraphStatus>("idle");
  const [dynamics, setDynamics] = useState<BiomarkerDynamicsReport | null>(
    null,
  );
  const [dynamicsStatus, setDynamicsStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [dynamicsError, setDynamicsError] = useState<string | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [comparisonFrom, setComparisonFrom] = useState("");
  const [comparisonTo, setComparisonTo] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [labUnitSystem, setLabUnitSystem] = useState<LabUnitSystem>("si");
  const [savingUnits, setSavingUnits] = useState(false);
  const dynamicsRequestId = useRef(0);

  useEffect(() => {
    const requested = navigationContext.measurement;
    if (requested) {
      setSelectedKey(
        getReviewedMeasurementKey(requested, reviewedMeasurementKeys) ?? "",
      );
    }
    if (navigationContext.observation) {
      setSelectedObservationId(navigationContext.observation);
    }
  }, [
    navigationContext.measurement,
    navigationContext.observation,
    reviewedMeasurementKeys,
  ]);

  const loadObservations = useCallback(
    (requestedMeasurement: string | null) => {
      return fetch("/api/biomarkers")
        .then((r) => r.json())
        .then((data) => {
          const obs = data.observations ?? [];
          setObservations(obs);
          if (data.lab_unit_system === "us" || data.lab_unit_system === "si") {
            setLabUnitSystem(data.lab_unit_system);
          }
          setSelectedKey((prev) => {
            const requested = getReviewedMeasurementKey(
              requestedMeasurement,
              reviewedMeasurementKeys,
            );
            // Related catalog links may target a reviewed definition with no
            // saved observation; keep that context for the educational graph.
            if (requested) return requested;
            if (requestedMeasurement) return "";
            if (
              prev &&
              obs.some(
                (o: Observation) =>
                  o.measurement_definition_key === prev &&
                  o.trend_eligible === true,
              )
            ) {
              return prev;
            }
            const resolved = obs.find(
              (o: Observation) =>
                o.measurement_definition_key && o.trend_eligible === true,
            );
            return resolved?.measurement_definition_key ?? "";
          });
        });
    },
    [reviewedMeasurementKeys],
  );

  useEffect(() => {
    const currentContext = readHealthNavigationContext(
      new URLSearchParams(window.location.search),
    );
    void loadObservations(currentContext.measurement);
  }, [loadObservations]);

  useEffect(() => {
    if (!selectedObservationId || !observations.length) return;
    const selectedBelongsToSeries = observations.some(
      (observation) =>
        observation.id === selectedObservationId &&
        observation.measurement_definition_key === selectedKey &&
        observation.trend_eligible === true,
    );
    if (!selectedBelongsToSeries) setSelectedObservationId("");
  }, [observations, selectedKey, selectedObservationId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedKey) {
      setRelatedGraph(null);
      setRelatedGraphStatus("idle");
      return () => {
        cancelled = true;
      };
    }

    setRelatedGraph(null);
    setRelatedGraphStatus("loading");
    void fetch(
      `/api/knowledge/measurements/${encodeURIComponent(selectedKey)}/relationships`,
      { headers: { Accept: "application/json" } },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Relationship graph unavailable");
        const body: unknown = await response.json();
        if (
          typeof body !== "object" ||
          body === null ||
          !("root" in body) ||
          !("edges" in body) ||
          !Array.isArray(body.edges)
        ) {
          throw new Error("Invalid relationship graph response");
        }
        return body as MeasurementRelationshipGraph;
      })
      .then((graph) => {
        if (cancelled) return;
        setRelatedGraph(graph);
        setRelatedGraphStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setRelatedGraph(null);
        setRelatedGraphStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  useEffect(() => {
    if (!observations.length || typeof window === "undefined") return;
    const href = buildHealthNavigationPath("/app/biomarkers", {
      system: navigationContext.system,
      measurement: selectedKey || null,
      observation: selectedObservationId || null,
      returnTo: navigationContext.returnTo,
    });
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href !== current) window.history.replaceState(null, "", href);
  }, [
    navigationContext.returnTo,
    navigationContext.system,
    observations.length,
    selectedKey,
    selectedObservationId,
  ]);

  async function setUnitSystem(next: LabUnitSystem) {
    if (next === labUnitSystem) return;
    setSavingUnits(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lab_unit_system: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update units");
      }
      setLabUnitSystem(next);
      await loadObservations(navigationContext.measurement);
    } catch {
      /* keep previous */
    } finally {
      setSavingUnits(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return observations.filter((o) => {
      if (!matchesStatusFilter(o, statusFilter)) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.measurement_definition_key?.toLowerCase().includes(q) ||
        o.analyte_key?.toLowerCase().includes(q) ||
        (o.documents?.original_filename ?? "").toLowerCase().includes(q) ||
        (o.documents?.lab_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [observations, search, statusFilter]);

  const loadDynamics = useCallback(async () => {
    const requestId = dynamicsRequestId.current + 1;
    dynamicsRequestId.current = requestId;
    if (
      (comparisonFrom && !comparisonTo) ||
      (!comparisonFrom && comparisonTo)
    ) {
      setDynamics(null);
      setDynamicsStatus("error");
      setDynamicsError("Choose both dates to filter the dynamics report.");
      return;
    }

    setDynamicsStatus("loading");
    setDynamicsError(null);
    const params = new URLSearchParams();
    if (comparisonFrom && comparisonTo) {
      params.set("start", comparisonFrom);
      params.set("end", comparisonTo);
    }

    try {
      const response = await fetch(
        `/api/biomarkers/dynamics${params.size ? `?${params}` : ""}`,
        { headers: { Accept: "application/json" } },
      );
      if (requestId !== dynamicsRequestId.current) return;
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        series?: unknown;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Biomarker dynamics are unavailable");
      }
      if (!Array.isArray(body.series)) {
        throw new Error("The dynamics response is invalid");
      }
      if (requestId !== dynamicsRequestId.current) return;
      setDynamics(body as BiomarkerDynamicsReport);
      setDynamicsStatus("ready");
    } catch (error) {
      if (requestId !== dynamicsRequestId.current) return;
      setDynamics(null);
      setDynamicsStatus("error");
      setDynamicsError(
        error instanceof Error
          ? error.message
          : "Biomarker dynamics are unavailable",
      );
    }
  }, [comparisonFrom, comparisonTo, labUnitSystem]);

  useEffect(() => {
    void loadDynamics();
  }, [loadDynamics]);

  useEffect(() => {
    const availableSeries = dynamics?.series ?? [];
    setSelectedSeriesId((current) => {
      const requested = navigationContext.measurement;
      const requestedSeries = requested
        ? availableSeries.find(
            (series) => series.measurementDefinitionKey === requested,
          )
        : undefined;
      if (requestedSeries) return requestedSeries.id;
      if (availableSeries.some((series) => series.id === current))
        return current;
      return availableSeries[0]?.id ?? "";
    });
  }, [dynamics, navigationContext.measurement]);

  const selectedSeries = dynamics?.series.find(
    (series) => series.id === selectedSeriesId,
  );
  const biomarkerContextPath = buildHealthNavigationPath("/app/biomarkers", {
    system: navigationContext.system,
    measurement: selectedKey || null,
    observation: selectedObservationId || null,
    returnTo: navigationContext.returnTo,
  });
  const selectedPoints = selectedSeries?.points ?? [];
  const chartData = selectedPoints.map((point) => ({
    observed_at: point.observedAt,
    value: point.displayValue,
  }));
  const chartPoints: BiomarkerChartPoint[] = selectedPoints.map((point) => {
    const sourceHref = buildHealthNavigationPath(
      `/app/documents/${point.documentId}`,
      {
        system: navigationContext.system,
        measurement: selectedSeries?.measurementDefinitionKey ?? selectedKey,
        observation: point.observationId,
        returnTo: biomarkerContextPath,
      },
    );
    return {
      id: point.observationId,
      observed_at: point.observedAt,
      value: point.displayValue,
      unit: point.displayUnit,
      native_value: point.nativeValue,
      native_unit: point.nativeUnit,
      native_ref_low: point.nativeReferenceLow,
      native_ref_high: point.nativeReferenceHigh,
      laboratory: point.source.laboratory,
      conversion_note: point.conversion.applied ? point.conversion.note : null,
      sourceHref,
      sourceLabel: point.source.filename,
      source: { href: sourceHref, filename: point.source.filename },
    };
  });
  const hasActiveComparisonRange = Boolean(comparisonFrom || comparisonTo);

  function clearComparisonRange() {
    setComparisonFrom("");
    setComparisonTo("");
  }
  const selectedStatistics = selectedSeries?.statistics;
  const selectedIncompatibilities =
    dynamics?.incompatibilities.filter((item) =>
      item.seriesIds.includes(selectedSeriesId),
    ) ?? [];
  const selectedLimitations = [
    ...(dynamics?.limitations ?? []).filter((item) => item.seriesId === null),
    ...(selectedSeries?.limitations ?? []),
  ];
  const originPath = navigationContext.returnTo ?? "/app";

  return (
    <div>
      <ContextBreadcrumbs
        items={[
          { href: originPath, label: healthRouteLabel(originPath) },
          { label: "Biomarkers" },
        ]}
      />
      <PageHeader
        title="Biomarkers"
        subtitle="Values extracted from your uploaded lab documents"
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search biomarker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search biomarkers"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--eh-text-secondary)]">Units</span>
          <Button
            type="button"
            size="sm"
            disabled={savingUnits}
            variant={labUnitSystem === "si" ? "default" : "outline"}
            className="rounded-lg"
            onClick={() => void setUnitSystem("si")}
          >
            SI
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={savingUnits}
            variant={labUnitSystem === "us" ? "default" : "outline"}
            className="rounded-lg"
            onClick={() => void setUnitSystem("us")}
          >
            US
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <FilterChip
            key={filter.id}
            active={statusFilter === filter.id}
            onClick={() => setStatusFilter(filter.id)}
          >
            {filter.label}
          </FilterChip>
        ))}
      </div>

      <BiomarkerTable
        observations={filtered}
        selectedObservationId={selectedObservationId}
        sourceReturnTo={biomarkerContextPath}
      />

      <RelatedMeasurementGraph
        graph={relatedGraph}
        status={relatedGraphStatus}
        returnTo={biomarkerContextPath}
      />

      <SurfaceCard padding="lg" className="mt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--eh-text-primary)]">
              Biomarker dynamics
            </h2>
            <p className="mt-1 text-xs text-[var(--eh-text-secondary)]">
              Numeric movement only. The server keeps each point tied to its
              source.
            </p>
          </div>
          {dynamics && dynamics.series.length > 0 ? (
            <Select
              value={selectedSeriesId}
              onValueChange={setSelectedSeriesId}
            >
              <SelectTrigger className="min-w-56 rounded-xl border-[var(--eh-border)]">
                <SelectValue placeholder="Select measurement series" />
              </SelectTrigger>
              <SelectContent>
                {dynamics.series.map((series) => (
                  <SelectItem key={series.id} value={series.id}>
                    {formatBiomarkerDynamicsSeriesLabel(series)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-[var(--eh-text-secondary)]"
              htmlFor="comparison-from"
            >
              From
            </label>
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--eh-text-muted)]"
                aria-hidden
              />
              <input
                id="comparison-from"
                type="date"
                value={comparisonFrom}
                onChange={(event) => setComparisonFrom(event.target.value)}
                className="h-10 rounded-xl border border-[var(--eh-border)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--eh-text-primary)] outline-none transition focus:border-[var(--eh-brand)] focus:ring-2 focus:ring-[var(--eh-brand)]/20"
                aria-label="Dynamics start date"
              />
            </div>
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-[var(--eh-text-secondary)]"
              htmlFor="comparison-to"
            >
              To
            </label>
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--eh-text-muted)]"
                aria-hidden
              />
              <input
                id="comparison-to"
                type="date"
                value={comparisonTo}
                onChange={(event) => setComparisonTo(event.target.value)}
                className="h-10 rounded-xl border border-[var(--eh-border)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--eh-text-primary)] outline-none transition focus:border-[var(--eh-brand)] focus:ring-2 focus:ring-[var(--eh-brand)]/20"
                aria-label="Dynamics end date"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={clearComparisonRange}
            disabled={!hasActiveComparisonRange}
            className="h-10 rounded-xl"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Clear range
          </Button>
        </div>

        {dynamicsStatus === "loading" || dynamicsStatus === "idle" ? (
          <p className="text-sm text-[var(--eh-text-secondary)]">
            Loading biomarker dynamics…
          </p>
        ) : dynamicsStatus === "error" ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">
              {dynamicsError ?? "Biomarker dynamics are unavailable."}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadDynamics()}
              className="mt-3 rounded-lg"
            >
              Retry dynamics
            </Button>
          </div>
        ) : dynamics?.series.length === 0 ? (
          <SurfaceCard padding="lg" className="border-dashed">
            <p className="text-sm text-[var(--eh-text-secondary)]">
              No compatible numeric history is available for this period.
            </p>
            <p className="mt-2 text-xs text-[var(--eh-text-secondary)]">
              Upload and review another lab document, then return here.
            </p>
            {(dynamics?.limitations.length ?? 0) > 0 ? (
              <div className="mt-4 border-t pt-4 text-left">
                <h3 className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  Data limitations
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--eh-text-secondary)]">
                  {dynamics?.limitations.map((item, index) => (
                    <li key={`${item.code}-${index}`}>{item.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </SurfaceCard>
        ) : selectedSeries ? (
          <>
            <p className="mb-4 text-xs leading-5 text-[var(--eh-text-secondary)]">
              {selectedSeries.normalized
                ? `Values are normalized to ${selectedSeries.displayUnit ?? "the reviewed display unit"} by the server's reviewed conversion binding. Native values and ranges remain in each source record.`
                : `Values are shown in ${selectedSeries.displayUnit ?? "their native units"}. Unit variants without a reviewed conversion remain separate series.`}
            </p>

            <div className="mb-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] p-3">
                <p className="text-xs text-[var(--eh-text-secondary)]">
                  Minimum
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--eh-text-primary)]">
                  {formatBiomarkerDynamicsValue(
                    selectedStatistics?.minimum ?? null,
                    selectedSeries.displayUnit,
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] p-3">
                <p className="text-xs text-[var(--eh-text-secondary)]">
                  Maximum
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--eh-text-primary)]">
                  {formatBiomarkerDynamicsValue(
                    selectedStatistics?.maximum ?? null,
                    selectedSeries.displayUnit,
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] p-3">
                <p className="text-xs text-[var(--eh-text-secondary)]">
                  Latest
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--eh-text-primary)]">
                  {formatBiomarkerDynamicsValue(
                    selectedStatistics?.latest?.displayValue ?? null,
                    selectedSeries.displayUnit,
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] p-3">
                <p className="text-xs text-[var(--eh-text-secondary)]">
                  Numeric direction
                </p>
                <p className="mt-1 text-lg font-semibold capitalize text-[var(--eh-text-primary)]">
                  {selectedSeries.direction.replace("_", " ")}
                </p>
                <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                  {selectedStatistics?.pointCount ?? 0} point
                  {(selectedStatistics?.pointCount ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {selectedIncompatibilities.length > 0 ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-900">
                  Separate evidence
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {selectedIncompatibilities.map((item) => {
                    const affectedSeries = item.seriesIds.flatMap(
                      (seriesId) => {
                        const series = dynamics?.series.find(
                          (candidate) => candidate.id === seriesId,
                        );
                        return series
                          ? [formatBiomarkerDynamicsSeriesLabel(series)]
                          : [];
                      },
                    );
                    return (
                      <li key={item.id}>
                        {item.detail} Affected series:{" "}
                        {affectedSeries.join("; ") || item.seriesIds.join(", ")}
                        .
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {selectedLimitations.length > 0 ? (
              <div className="mb-4 rounded-lg border border-[var(--eh-border)] bg-white p-4">
                <h3 className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  Data limitations
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--eh-text-secondary)]">
                  {selectedLimitations.map((item, index) => (
                    <li
                      key={`${item.code}-${item.seriesId ?? "report"}-${index}`}
                    >
                      {item.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <BiomarkerChart
              data={chartData}
              points={chartPoints}
              biomarkerName={selectedSeries.label}
              selectedObservationId={selectedObservationId}
            />
          </>
        ) : (
          <p className="text-sm text-[var(--eh-text-secondary)]">
            Select a measurement series to view its dynamics.
          </p>
        )}
      </SurfaceCard>

      <p className="mt-6 text-xs text-[var(--eh-text-muted)]">
        {MEDICAL_DISCLAIMER}
      </p>
    </div>
  );
}
