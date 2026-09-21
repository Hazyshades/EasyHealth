"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import type { AssessmentExclusionReason } from "@/lib/health-profile-assessment-eligibility";
import type {
  BiomarkerDynamicsReport,
  BiomarkerDynamicsSeries,
} from "@/lib/biomarker-dynamics";

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

const DIRECTION_LABELS: Record<
  BiomarkerDynamicsSeries["direction"]["value"],
  string
> = {
  increasing: "Increasing (numeric)",
  decreasing: "Decreasing (numeric)",
  stable: "Stable (numeric)",
  not_available: "Not available",
};

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

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(value);
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
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [comparisonFrom, setComparisonFrom] = useState("");
  const [comparisonTo, setComparisonTo] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [labUnitSystem, setLabUnitSystem] = useState<LabUnitSystem>("si");
  const [savingUnits, setSavingUnits] = useState(false);
  const [dynamics, setDynamics] = useState<BiomarkerDynamicsReport | null>(
    null,
  );
  const [dynamicsError, setDynamicsError] = useState<string | null>(null);
  const [dynamicsLoading, setDynamicsLoading] = useState(false);
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null);

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

  // Fetch server-authorized dynamics DTO — never compute statistics in the browser.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    // Inclusive period requires both canonical dates; otherwise request all dated points.
    if (comparisonFrom && comparisonTo) {
      params.set("start", comparisonFrom);
      params.set("end", comparisonTo);
    }
    const query = params.toString();

    setDynamicsLoading(true);
    setDynamicsError(null);
    void fetch(`/api/biomarkers/dynamics${query ? `?${query}` : ""}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : "Failed to load dynamics",
          );
        }
        return body as BiomarkerDynamicsReport;
      })
      .then((report) => {
        if (cancelled) return;
        setDynamics(report);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDynamics(null);
        setDynamicsError(
          error instanceof Error ? error.message : "Failed to load dynamics",
        );
      })
      .finally(() => {
        if (!cancelled) setDynamicsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [comparisonFrom, comparisonTo, labUnitSystem, observations]);

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

  const dynamicsSeries = dynamics?.series ?? [];

  useEffect(() => {
    setSelectedSeriesId((current) => {
      const requested = navigationContext.measurement;
      const requestedSeries = requested
        ? dynamicsSeries.find(
            (series) => series.measurementDefinitionKey === requested,
          )
        : undefined;
      if (requestedSeries) return requestedSeries.id;
      if (dynamicsSeries.some((series) => series.id === current)) {
        return current;
      }
      const currentDefinitionKey = current.split("::", 1)[0];
      return (
        dynamicsSeries.find(
          (series) => series.measurementDefinitionKey === currentDefinitionKey,
        )?.id ??
        dynamicsSeries[0]?.id ??
        ""
      );
    });
  }, [dynamicsSeries, navigationContext.measurement]);

  const selectedSeries = dynamicsSeries.find(
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
    value: point.displayValue ?? 0,
  }));
  const chartPoints: BiomarkerChartPoint[] = selectedPoints.map((point) => {
    const sourceHref = point.source?.documentId
      ? buildHealthNavigationPath(`/app/documents/${point.source.documentId}`, {
          system: navigationContext.system,
          measurement:
            selectedSeries?.measurementDefinitionKey ?? selectedKey,
          observation: point.id,
          returnTo: biomarkerContextPath,
        })
      : (point.source?.href ?? null);
    return {
      id: point.id,
      observed_at: point.observedAt,
      value: point.displayValue ?? 0,
      unit: point.displayUnit,
      native_value: point.nativeValue ?? point.displayValue ?? 0,
      native_unit: point.nativeUnit,
      native_ref_low: point.nativeReferenceLow,
      native_ref_high: point.nativeReferenceHigh,
      laboratory: point.source?.laboratory ?? null,
      sourceHref,
      sourceLabel: point.source?.filename ?? null,
      source: point.source
        ? { ...point.source, href: sourceHref ?? point.source.href }
        : null,
    };
  });
  const hasActiveComparisonRange = Boolean(comparisonFrom || comparisonTo);

  function clearComparisonRange() {
    setComparisonFrom("");
    setComparisonTo("");
  }
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
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-[var(--eh-text-primary)]">
            Biomarker dynamics report
          </span>
          {dynamicsSeries.length > 0 ? (
            <Select
              value={selectedSeriesId}
              onValueChange={setSelectedSeriesId}
            >
              <SelectTrigger className="min-w-56 rounded-xl border-[var(--eh-border)]">
                <SelectValue placeholder="Select measurement series" />
              </SelectTrigger>
              <SelectContent>
                {dynamicsSeries.map((series) => (
                  <SelectItem key={series.id} value={series.id}>
                    {series.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
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
                aria-label="Dynamics period start date"
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
                aria-label="Dynamics period end date"
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

        {dynamics?.period ? (
          <p className="mb-3 text-xs text-[var(--eh-text-secondary)]">
            Selected period: {dynamics.period.start} → {dynamics.period.end}{" "}
            (inclusive UTC calendar dates)
          </p>
        ) : null}

        {dynamicsError ? (
          <p className="mb-4 text-sm text-red-700" role="alert">
            {dynamicsError}
          </p>
        ) : null}

        {dynamicsLoading && !dynamics ? (
          <p className="text-sm text-[var(--eh-text-secondary)]">
            Loading dynamics…
          </p>
        ) : null}

        {(dynamics?.incompatibilities.length ?? 0) > 0 ? (
          <div
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-medium">Incompatible series kept separate</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
              {dynamics!.incompatibilities.map((item, index) => (
                <li key={`${item.groupingReason}-${index}`}>
                  {item.groupingReason}. Affected:{" "}
                  {item.affectedSeriesLabels.join("; ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!dynamics || dynamicsSeries.length === 0 ? (
          <p className="text-sm text-[var(--eh-text-secondary)]">
            No resolved numeric measurement definitions are available for
            dynamics yet.
          </p>
        ) : !selectedSeries ? (
          <SurfaceCard padding="lg" className="border-dashed text-center">
            <p className="text-sm text-[var(--eh-text-secondary)]">
              No measurements match the selected date range.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={clearComparisonRange}
              className="mt-4 rounded-xl"
            >
              Clear range
            </Button>
          </SurfaceCard>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-[var(--eh-border)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--eh-text-muted)]">
                  Points
                </p>
                <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  {selectedSeries.statistics.pointCount}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--eh-border)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--eh-text-muted)]">
                  Min
                </p>
                <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  {formatNumber(selectedSeries.statistics.min)}
                  {selectedSeries.statistics.displayUnit
                    ? ` ${selectedSeries.statistics.displayUnit}`
                    : ""}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--eh-border)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--eh-text-muted)]">
                  Max
                </p>
                <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  {formatNumber(selectedSeries.statistics.max)}
                  {selectedSeries.statistics.displayUnit
                    ? ` ${selectedSeries.statistics.displayUnit}`
                    : ""}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--eh-border)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--eh-text-muted)]">
                  Latest
                </p>
                <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  {formatNumber(selectedSeries.statistics.latest?.displayValue)}
                  {selectedSeries.statistics.displayUnit
                    ? ` ${selectedSeries.statistics.displayUnit}`
                    : ""}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--eh-border)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--eh-text-muted)]">
                  Direction
                </p>
                <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  {DIRECTION_LABELS[selectedSeries.direction.value]}
                </p>
                {selectedSeries.direction.limitation ? (
                  <p className="mt-1 text-[11px] leading-4 text-[var(--eh-text-muted)]">
                    {selectedSeries.direction.limitation.message}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="mb-4 text-xs leading-5 text-[var(--eh-text-muted)]">
              {selectedSeries.points.some(
                (point) => point.conversionMetadata?.converted,
              )
                ? `Values are shown in ${selectedSeries.unit ?? "the reviewed display unit"}. Each point retains its laboratory-native value and range.`
                : `Values are shown in ${selectedSeries.unit ?? "their native units"}. Unit variants without a reviewed conversion remain separate series.`}
            </p>

            <BiomarkerChart
              data={chartData}
              points={chartPoints}
              biomarkerName={selectedSeries.label}
              selectedObservationId={selectedObservationId}
            />

            <div className="mt-6">
              <p className="mb-2 text-xs font-medium text-[var(--eh-text-secondary)]">
                Source ledger
              </p>
              <ul className="space-y-2">
                {selectedPoints.map((point) => {
                  const open = expandedPointId === point.id;
                  return (
                    <li
                      key={point.id}
                      className="rounded-xl border border-[var(--eh-border)] px-3 py-2 text-sm"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() =>
                          setExpandedPointId(open ? null : point.id)
                        }
                        aria-expanded={open}
                      >
                        <span>
                          {point.observedAt.slice(0, 10)} ·{" "}
                          {formatNumber(point.displayValue)}
                          {point.displayUnit ? ` ${point.displayUnit}` : ""}
                        </span>
                        <span className="text-xs text-[var(--eh-text-muted)]">
                          {open ? "Hide" : "Source"}
                        </span>
                      </button>
                      {open ? (
                        <div className="mt-2 space-y-1 text-xs leading-5 text-[var(--eh-text-secondary)]">
                          <p>
                            Native: {formatNumber(point.nativeValue)}
                            {point.nativeUnit ? ` ${point.nativeUnit}` : ""}
                            {point.nativeReferenceLow != null ||
                            point.nativeReferenceHigh != null
                              ? ` · range ${formatNumber(point.nativeReferenceLow)}–${formatNumber(point.nativeReferenceHigh)}`
                              : ""}
                          </p>
                          {point.conversionMetadata?.converted ? (
                            <p>
                              Converted from{" "}
                              {formatNumber(
                                point.conversionMetadata.originalValue,
                              )}
                              {point.conversionMetadata.originalUnit
                                ? ` ${point.conversionMetadata.originalUnit}`
                                : ""}
                            </p>
                          ) : null}
                          {point.source ? (
                            <p>
                              Source:{" "}
                              <a
                                href={point.source.href}
                                className="text-[var(--eh-brand)] underline-offset-2 hover:underline"
                              >
                                {point.source.filename}
                              </a>
                              {point.source.laboratory
                                ? ` · ${point.source.laboratory}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </SurfaceCard>

      <p className="mt-6 text-xs text-[var(--eh-text-muted)]">
        {dynamics?.disclaimer ?? MEDICAL_DISCLAIMER}
      </p>
      <p className="mt-2 text-xs text-[var(--eh-text-muted)]">
        {MEDICAL_DISCLAIMER}
      </p>
    </div>
  );
}
