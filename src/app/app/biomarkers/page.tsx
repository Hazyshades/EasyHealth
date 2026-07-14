"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BiomarkerTable } from "@/components/biomarker-table";
import { BiomarkerChart } from "@/components/biomarker-chart";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { FilterChip } from "@/components/ui/filter-chip";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

type LabUnitSystem = "us" | "si";

type Observation = {
  id: string;
  name: string;
  measurement_definition_key: string | null;
  analyte_key: string | null;
  resolution_status: string | null;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  document_id: string | null;
  documents?: { id: string; original_filename: string } | null;
  converted?: boolean;
  conversion_note?: string | null;
  original_value?: number;
  original_unit?: string;
  value_kind?: string;
  value_text?: string | null;
  specimen?: string;
  modifier?: string;
};

type StatusFilter = "all" | "normal" | "attention" | "low" | "high";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "normal", label: "Normal" },
  { id: "attention", label: "Attention" },
  { id: "low", label: "Low" },
  { id: "high", label: "High" },
];

function observationStatus(o: Observation): StatusFilter {
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
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [labUnitSystem, setLabUnitSystem] = useState<LabUnitSystem>("si");
  const [savingUnits, setSavingUnits] = useState(false);

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
          if (prev && obs.some((o: Observation) => o.measurement_definition_key === prev)) return prev;
          const resolved = obs.find(
            (o: Observation) => o.measurement_definition_key && o.resolution_status === "resolved"
          );
          return resolved?.measurement_definition_key ?? obs.find((o: Observation) => o.measurement_definition_key)?.measurement_definition_key ?? "";
        });
      });
  }, []);

  useEffect(() => {
    void loadObservations();
  }, [loadObservations]);

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
        (o.documents?.original_filename ?? "").toLowerCase().includes(q)
      );
    });
  }, [observations, search, statusFilter]);

  const keys = useMemo(
    () =>
      [
        ...new Set(
          observations
            .filter((o) => o.measurement_definition_key && o.resolution_status === "resolved")
            .map((o) => o.measurement_definition_key as string)
        ),
      ],
    [observations]
  );

  const selectedName =
    observations.find((o) => o.measurement_definition_key === selectedKey)?.name ?? selectedKey;

  const selectedSeries = observations.filter((o) => o.measurement_definition_key === selectedKey);
  const chartData = selectedSeries
    .filter((o) => o.value != null && (!o.value_kind || o.value_kind === "numeric"))
    .map((o) => ({ observed_at: o.observed_at, value: Number(o.value) }));
  const chartIsQualitativeOnly =
    selectedSeries.length > 0 && chartData.length === 0;
  const hasResolvedTrendSeries = keys.length > 0;

  return (
    <div>
      <PageHeader subtitle="Values extracted from your uploaded lab documents" />

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

      <BiomarkerTable observations={filtered} />

      <SurfaceCard padding="lg" className="mt-8">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-[var(--eh-text-primary)]">Trend chart</span>
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger className="w-52 rounded-xl border-[var(--eh-border)]">
              <SelectValue placeholder="Select biomarker" />
            </SelectTrigger>
            <SelectContent>
              {keys.map((key) => {
                const name = observations.find((o) => o.measurement_definition_key === key)?.name ?? key;
                return (
                  <SelectItem key={key} value={key}>
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        {!hasResolvedTrendSeries ? (
          <p className="text-sm text-[var(--eh-text-secondary)]">
            No resolved measurement definitions are available for trends yet.
          </p>
        ) : chartIsQualitativeOnly ? (
          <p className="text-sm text-[var(--eh-text-secondary)]">
            This biomarker has text or qualitative results only — numeric trend chart is not
            available.
          </p>
        ) : (
          <BiomarkerChart data={chartData} biomarkerName={selectedName} />
        )}
      </SurfaceCard>

      <p className="mt-6 text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
