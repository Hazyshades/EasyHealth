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

type StatusInfo = {
  label: string;
  variant: "success" | "warning" | "info" | "neutral";
};

function displayValue(o: Observation): string {
  if (o.value_kind && o.value_kind !== "numeric") {
    return o.value_text?.trim() || "—";
  }
  if (o.value == null) return o.value_text?.trim() || "—";
  return `${o.value}${o.unit ? ` ${o.unit}` : ""}`;
}

function biomarkerStatus(o: Observation): StatusInfo {
  if (o.value_kind && o.value_kind !== "numeric") {
    return { label: "Text result", variant: "neutral" };
  }
  if (o.value == null || o.ref_low == null || o.ref_high == null) {
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
                  <DataTableCell className="font-medium">
                    {o.name}
                    {(o.specimen && o.specimen !== "unspecified") ||
                    (o.modifier && o.modifier !== "none") ? (
                      <span className="mt-0.5 block text-[11px] font-normal text-[var(--eh-text-muted)]">
                        {[o.specimen !== "unspecified" ? o.specimen : null, o.modifier !== "none" ? o.modifier : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>
                    <span>{displayValue(o)}</span>
                    {o.converted && o.original_unit != null && (
                      <span
                        className="mt-0.5 block text-[11px] text-[var(--eh-text-muted)]"
                        title={o.conversion_note ?? undefined}
                      >
                        Lab: {o.original_value} {o.original_unit}
                      </span>
                    )}
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
                    {o.documents?.id ? (
                      <Link
                        href={`/app/documents/${o.documents.id}`}
                        className="text-[var(--eh-brand)] hover:underline"
                      >
                        {o.documents.original_filename}
                      </Link>
                    ) : (
                      o.documents?.original_filename ?? "—"
                    )}
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
                      {displayValue(o)}
                      {o.converted && o.original_unit != null && (
                        <span className="mt-0.5 block text-[11px] text-[var(--eh-text-muted)]">
                          Lab: {o.original_value} {o.original_unit}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                      {o.observed_at}
                      {o.documents?.id ? (
                        <>
                          {" · "}
                          <Link
                            href={`/app/documents/${o.documents.id}`}
                            className="text-[var(--eh-brand)] hover:underline"
                          >
                            {o.documents.original_filename}
                          </Link>
                        </>
                      ) : o.documents?.original_filename ? (
                        ` · ${o.documents.original_filename}`
                      ) : null}
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
