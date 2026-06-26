"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BiomarkerTable } from "@/components/biomarker-table";
import { BiomarkerChart } from "@/components/biomarker-chart";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

type Observation = {
  id: string;
  name: string;
  biomarker_key: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  documents?: { original_filename: string } | null;
};

export default function HealthCardPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");

  useEffect(() => {
    fetch("/api/biomarkers")
      .then((r) => r.json())
      .then((data) => {
        const obs = data.observations ?? [];
        setObservations(obs);
        const hba1c = obs.find((o: Observation) => o.biomarker_key === "hba1c");
        setSelectedKey(hba1c?.biomarker_key ?? obs[0]?.biomarker_key ?? "");
      });
  }, []);

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Your health card</h1>
        <p className="text-muted-foreground">Biomarkers extracted from your uploaded labs</p>
      </div>

      <BiomarkerTable observations={observations} />

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Trend chart</span>
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger className="w-48">
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
      </div>

      <p className="text-xs text-muted-foreground">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
