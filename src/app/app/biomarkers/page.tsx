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
  biomarker_key: string;
  value: number;
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
  if (o.ref_low == null || o.ref_high == null) return "normal";
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
          if (prev && obs.some((o: Observation) => o.biomarker_key === prev)) return prev;
          const hba1c = obs.find((o: Observation) => o.biomarker_key === "hba1c");
          return hba1c?.biomarker_key ?? obs[0]?.biomarker_key ?? "";
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
        o.biomarker_key.toLowerCase().includes(q) ||
        (o.documents?.original_filename ?? "").toLowerCase().includes(q)
      );
    });
  }, [observations, search, statusFilter]);

  const keys = useMemo(
    () => [...new Set(observations.map((o) => o.biomarker_key))],
    [observations]
  );

  const selectedName =
    observations.find((o) => o.biomarker_key === selectedKey)?.name ?? selectedKey;

  const chartData = observations
    .filter((o) => o.biomarker_key === selectedKey)
    .map((o) => ({ observed_at: o.observed_at, value: Number(o.value) }));

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
                const name = observations.find((o) => o.biomarker_key === key)?.name ?? key;
                return (
                  <SelectItem key={key} value={key}>
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <BiomarkerChart data={chartData} biomarkerName={selectedName} />
      </SurfaceCard>

      <p className="mt-6 text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
