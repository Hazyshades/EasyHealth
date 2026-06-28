"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";

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

type StatusInfo = {
  label: string;
  variant: "success" | "warning" | "info" | "neutral";
};

function biomarkerStatus(o: Observation): StatusInfo {
  if (o.ref_low == null || o.ref_high == null) {
    return { label: "No range", variant: "neutral" };
  }
  if (o.value < o.ref_low) return { label: "Low", variant: "info" };
  if (o.value > o.ref_high) return { label: "Attention", variant: "warning" };
  return { label: "Normal", variant: "success" };
}

export function BiomarkerTable({ observations }: { observations: Observation[] }) {
  if (!observations.length) {
    return (
      <SurfaceCard padding="lg" className="border-dashed text-center">
        <p className="text-[var(--eh-text-secondary)] mb-4">No biomarkers match your filters.</p>
        <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/upload">Upload your first lab</Link>
        </Button>
      </SurfaceCard>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Biomarker</DataTableHeaderCell>
              <DataTableHeaderCell>Value</DataTableHeaderCell>
              <DataTableHeaderCell>Reference</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Date</DataTableHeaderCell>
              <DataTableHeaderCell>Source</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {observations.map((o) => {
              const status = biomarkerStatus(o);
              return (
                <DataTableRow key={o.id}>
                  <DataTableCell className="font-medium">{o.name}</DataTableCell>
                  <DataTableCell>
                    {o.value} {o.unit}
                  </DataTableCell>
                  <DataTableCell className="text-[var(--eh-text-secondary)]">
                    {o.ref_low != null && o.ref_high != null
                      ? `${o.ref_low} – ${o.ref_high}`
                      : "—"}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusChip variant={status.variant}>{status.label}</StatusChip>
                  </DataTableCell>
                  <DataTableCell className="text-[var(--eh-text-secondary)]">
                    {o.observed_at}
                  </DataTableCell>
                  <DataTableCell className="text-[var(--eh-text-secondary)]">
                    {o.documents?.original_filename ?? "—"}
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      </div>

      <ul className="space-y-3 md:hidden">
        {observations.map((o) => {
          const status = biomarkerStatus(o);
          return (
            <li key={o.id}>
              <SurfaceCard padding="sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--eh-text-primary)]">{o.name}</p>
                    <p className="mt-1 text-sm text-[var(--eh-text-primary)]">
                      {o.value} {o.unit}
                    </p>
                    <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                      {o.observed_at} · {o.documents?.original_filename ?? "—"}
                    </p>
                  </div>
                  <StatusChip variant={status.variant}>{status.label}</StatusChip>
                </div>
              </SurfaceCard>
            </li>
          );
        })}
      </ul>
    </>
  );
}
