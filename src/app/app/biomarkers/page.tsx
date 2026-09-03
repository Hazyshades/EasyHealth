"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BiomarkerTable } from "@/components/biomarker-table";
import { BiomarkerChart, type BiomarkerChartPoint } from "@/components/biomarker-chart";
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
  type HealthNavigationContext,
} from "@/lib/health-navigation";
import {
  buildMeasurementComparisonSeries,
  filterMeasurementComparisonSeries,
} from "@/lib/biomarker-comparison";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import type { AssessmentExclusionReason } from "@/lib/health-profile-assessment-eligibility";

type LabUnitSystem = "us" | "si";

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
  documents?: { id: string; original_filename: string; lab_name?: string | null } | null;
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

const EMPTY_NAVIGATION_CONTEXT: HealthNavigationContext = {
  system: null,
  measurement: null,
  observation: null,
  returnTo: null,
};

function observationStatus(o: Observation): StatusFilter {
  if (!o.registry_binding_ready) return "mapping";
  if (o.value_kind && o.value_kind !== "numeric") return "normal";
  if (o.value == null || o.ref_low == null || o.ref_high == null) return "normal";
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

export default function BiomarkersPage() {
  const [navigationContext, setNavigationContext] =
    useState<HealthNavigationContext>(EMPTY_NAVIGATION_CONTEXT);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedObservationId, setSelectedObservationId] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [comparisonFrom, setComparisonFrom] = useState("");
  const [comparisonTo, setComparisonTo] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [labUnitSystem, setLabUnitSystem] = useState<LabUnitSystem>("si");
  const [savingUnits, setSavingUnits] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNavigationContext(
      readHealthNavigationContext(new URLSearchParams(window.location.search)),
    );
    setNavigationReady(true);
  }, []);

  useEffect(() => {
    if (navigationContext.measurement) {
      setSelectedKey(navigationContext.measurement);
    }
    if (navigationContext.observation) {
      setSelectedObservationId(navigationContext.observation);
    }
  }, [navigationContext.measurement, navigationContext.observation]);

  const loadObservations = useCallback(() => {
    return fetch("/api/biomarkers")
      .then((r) => r.json())
      .then((data) => {
        const obs = data.observations ?? [];
        setObservations(obs);
        if (data.lab_unit_system === "us" || data.lab_unit_system === "si") {
          setLabUnitSystem(data.lab_unit_system);
        }
        setSelectedKey((prev) => {
          const requested = navigationContext.measurement;
          if (
            requested &&
            obs.some(
              (o: Observation) =>
                o.measurement_definition_key === requested,
            )
          ) {
            return requested;
          }
          if (
            prev &&
            obs.some(
              (o: Observation) =>
                o.measurement_definition_key === prev,
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
  }, [navigationContext.measurement]);

  useEffect(() => {
    if (!navigationReady) return;
    void loadObservations();
  }, [loadObservations, navigationReady]);

  useEffect(() => {
    if (!selectedObservationId || !observations.length) return;
    const selectedBelongsToMeasurement = observations.some(
      (observation) =>
        observation.id === selectedObservationId &&
        observation.measurement_definition_key === selectedKey,
    );
    if (!selectedBelongsToMeasurement) setSelectedObservationId("");
  }, [observations, selectedKey, selectedObservationId]);

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
      await loadObservations();
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

  const comparisonSeries = useMemo(
    () => buildMeasurementComparisonSeries(observations),
    [observations],
  );

  useEffect(() => {
    setSelectedSeriesId((current) => {
      const requested = navigationContext.measurement;
      const requestedSeries = requested
        ? comparisonSeries.find(
            (series) => series.measurementDefinitionKey === requested,
          )
        : undefined;
      if (requestedSeries) return requestedSeries.id;
      if (comparisonSeries.some((series) => series.id === current)) {
        return current;
      }
      const currentDefinitionKey = current.split("::", 1)[0];
      return (
        comparisonSeries.find(
          (series) => series.measurementDefinitionKey === currentDefinitionKey,
        )?.id ??
        comparisonSeries[0]?.id ??
        ""
      );
    });
  }, [comparisonSeries, navigationContext.measurement]);

  const selectedSeries = comparisonSeries.find((series) => series.id === selectedSeriesId);
  const filteredComparisonSeries = useMemo(
    () =>
      filterMeasurementComparisonSeries(comparisonSeries, {
        from: comparisonFrom || null,
        to: comparisonTo || null,
      }),
    [comparisonFrom, comparisonTo, comparisonSeries],
  );
  const selectedFilteredSeries = filteredComparisonSeries.find(
    (series) => series.id === selectedSeriesId,
  );
  const biomarkerContextPath = buildHealthNavigationPath("/app/biomarkers", {
    system: navigationContext.system,
    measurement: selectedKey || null,
    observation: selectedObservationId || null,
    returnTo: navigationContext.returnTo,
  });
  const selectedPoints = selectedFilteredSeries?.points ?? [];
  const chartData = selectedPoints.map((point) => ({
    observed_at: point.observedAt,
    value: point.displayValue,
  }));
  const chartPoints: BiomarkerChartPoint[] = selectedPoints.map((point) => {
    const observation = observations.find((item) => item.id === point.id);
    const sourceHref = observation?.documents?.id
      ? buildHealthNavigationPath(`/app/documents/${observation.documents.id}`, {
          system: navigationContext.system,
          measurement: selectedSeries?.measurementDefinitionKey ?? selectedKey,
          observation: point.id,
          returnTo: biomarkerContextPath,
        })
      : point.source?.href ?? null;
    return {
      id: point.id,
      observed_at: point.observedAt,
      value: point.displayValue,
      unit: point.displayUnit,
      native_value: point.nativeValue,
      native_unit: point.nativeUnit,
      native_ref_low: point.nativeReferenceLow,
      native_ref_high: point.nativeReferenceHigh,
      laboratory: point.source?.laboratory ?? null,
      sourceHref,
      sourceLabel:
        observation?.documents?.original_filename ?? point.source?.filename ?? null,
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
      <PageHeader title="Biomarkers" subtitle="Values extracted from your uploaded lab documents" />
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

      <SurfaceCard padding="lg" className="mt-8">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-[var(--eh-text-primary)]">
            Repeated measurement comparison
          </span>
          {comparisonSeries.length > 0 ? (
            <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
              <SelectTrigger className="min-w-56 rounded-xl border-[var(--eh-border)]">
                <SelectValue placeholder="Select measurement series" />
              </SelectTrigger>
              <SelectContent>
                {comparisonSeries.map((series) => (
                  <SelectItem key={series.id} value={series.id}>
                    {series.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {comparisonSeries.length === 0 ? (
          <p className="text-sm text-[var(--eh-text-secondary)]">
            No resolved numeric measurement definitions are available for comparison yet.
          </p>
        ) : (
          <>
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
                    aria-label="Comparison start date"
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
                    aria-label="Comparison end date"
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

            <p className="mb-4 text-xs leading-5 text-[var(--eh-text-muted)]">
              {selectedSeries?.normalized
                ? `Values are normalized to ${selectedSeries.unit ?? "the reviewed display unit"} by the server's reviewed conversion binding. Each point retains its laboratory value and range.`
                : `Values are shown in ${selectedSeries?.unit ?? "their native units"}. Unit variants without a reviewed conversion remain separate series.`}
            </p>

            {!selectedFilteredSeries ? (
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
              <BiomarkerChart
                data={chartData}
                points={chartPoints}
                biomarkerName={selectedSeries?.label ?? "Measurement"}
                selectedObservationId={selectedObservationId}
              />
            )}
          </>
        )}
      </SurfaceCard>

      <p className="mt-6 text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
