"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import {
  assessmentStatusLabel,
  type BodySystemId,
  type SystemInsight,
} from "@/lib/health-systems";
import { cn } from "@/lib/utils";

function statusLabel(status: string): string {
  if (status === "out_of_range") return "Outside lab reference range";
  if (status === "in_range") return "Within lab reference range";
  return "No reference range on document";
}

function formatSourceDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type HealthProfileDrawerProps = {
  system: SystemInsight | null;
  layoutLabel: string;
  open: boolean;
  onClose: () => void;
};

export function HealthProfileDrawer({
  system,
  layoutLabel,
  open,
  onClose,
}: HealthProfileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !system) return null;

  const status = assessmentStatusLabel(system.state_score, system.data_confidence);
  const missingGroups = system.score_readiness.missing_groups;
  const unavailableKeys = new Set(system.score_readiness.present_without_reference);
  const supportingMarkers = system.markers.filter((marker) => marker.score_role !== "core");
  const drawerState =
    system.id === "general"
      ? "Not scored - supporting / specialty data"
      : system.markers.length === 0
        ? "No data"
        : system.scoreability === "non_scoreable"
          ? "Not scored - individual markers only"
          : system.state_score == null
            ? "Not scored - incomplete core"
            : null;

  return (
    <>
      <button
        type="button"
        aria-label="Close profile details"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="health-profile-drawer-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-teal-700 hover:underline"
          >
            Back
          </button>
          <h2 id="health-profile-drawer-title" className="text-lg font-semibold">
            {layoutLabel}
          </h2>
          <span className="w-12" aria-hidden />
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-slate-50 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Current state assessment</p>
              <p className="text-2xl font-bold">
                {system.state_score == null ? "-" : `${system.state_score}/100`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data confidence</p>
              <p className="text-2xl font-bold">{system.data_confidence}%</p>
            </div>
            <div className="col-span-2">
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                  status === "Stable" && "bg-emerald-100 text-emerald-800",
                  status === "Needs attention" && "bg-amber-100 text-amber-800",
                  status === "Limited data" && "bg-slate-200 text-slate-700"
                )}
              >
                {status}
              </span>
            </div>
          </div>

          {drawerState ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold">{drawerState}</h3>
              {system.id === "general" ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  These supporting or specialty markers do not drive named-system assessments.
                </p>
              ) : null}
              {missingGroups.length > 0 ? (
                <div className="mt-3 text-sm text-muted-foreground">
                  <p className="font-medium text-slate-800">Needed for this assessment</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {missingGroups.map((group) => (
                      <li key={group.join("-")}>{group.join(" or ")}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {unavailableKeys.size > 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Present without a usable lab reference range: {[...unavailableKeys].join(", ")}.
                </p>
              ) : null}
              <Button asChild variant="outline" className="mt-4">
                <Link href="/app/upload">Upload a document</Link>
              </Button>
            </section>
          ) : null}

          <section>
            <h3 className="font-semibold">Why highlighted</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {system.why_highlighted.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {supportingMarkers.length > 0 ? (
            <section>
              <h3 className="font-semibold">Supporting markers</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {supportingMarkers.map((marker) => marker.name).join(", ")}
              </p>
            </section>
          ) : null}

          {system.primary_source && (
            <section>
              <h3 className="font-semibold">Primary source</h3>
              <div className="mt-2 rounded-lg border p-3 text-sm">
                <p className="font-medium">{system.primary_source.original_filename}</p>
                {system.primary_source.lab_name && (
                  <p className="text-muted-foreground">{system.primary_source.lab_name}</p>
                )}
                {system.primary_source.observed_at && (
                  <p className="text-muted-foreground">
                    {formatSourceDate(system.primary_source.observed_at)}
                  </p>
                )}
                <Link
                  href="/app/documents"
                  className="mt-2 inline-block text-teal-700 hover:underline"
                >
                  View documents
                </Link>
              </div>
            </section>
          )}

          <section>
            <h3 className="font-semibold">Data</h3>
            <ul className="mt-3 space-y-3">
              {system.markers.map((marker) => (
                <li key={marker.key} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{marker.name}</p>
                  <p>
                    {marker.value_kind && marker.value_kind !== "numeric"
                      ? marker.value_text ?? "—"
                      : marker.value != null
                        ? `${marker.value} ${marker.unit}`
                        : marker.value_text ?? "—"}
                  </p>
                  {marker.specimen && marker.specimen !== "unspecified" && (
                    <p className="text-xs text-muted-foreground">Specimen: {marker.specimen}</p>
                  )}
                  {marker.converted && marker.original_unit != null && (
                    <p className="text-xs text-muted-foreground" title={marker.conversion_note ?? undefined}>
                      Converted for display · Original: {marker.original_value} {marker.original_unit}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{statusLabel(marker.status)}</p>
                  <p className="text-xs text-muted-foreground">
                    Observed {marker.observed_at}
                  </p>
                  {marker.observation_kind === "instrumental" ? (
                    <p className="text-xs font-medium text-teal-700">
                      From imaging/functional study
                    </p>
                  ) : null}
                  {marker.source && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Source: {marker.source.original_filename}
                      {marker.source.observed_at
                        ? ` · ${formatSourceDate(marker.source.observed_at)}`
                        : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <h3 className="font-semibold text-teal-900">AI insights</h3>
            <p className="mt-2 text-sm text-teal-800">
              Factual marker data is shown here for free. Generate a paid report for narrative
              insights, questions for your clinician, and lifestyle discussion points.
            </p>
            <Button asChild className="mt-3 w-full">
              <Link href="/app/reports/create">Generate report to see insights</Link>
            </Button>
          </section>

          <p className="text-xs text-muted-foreground">{MEDICAL_DISCLAIMER}</p>
        </div>

        <div className="border-t px-4 py-3">
          <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </aside>
    </>
  );
}

export type { BodySystemId };
