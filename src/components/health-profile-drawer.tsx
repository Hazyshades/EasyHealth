"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  assessmentDisplayStateDescription,
  assessmentDisplayStateLabel,
  type HealthProfileAssessmentDisplayState,
} from "@/lib/health-profile-assessment-state";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { ScoreProvenancePanel } from "@/components/score-provenance-panel";
import { buildHealthNavigationPath } from "@/lib/health-navigation";
import { assessmentStatusLabel, type BodySystemId, type SystemInsight } from "@/lib/health-systems";
import {
  FRESHNESS_STATUS_LABELS,
  type FreshnessStatus,
} from "@/lib/health-profile-freshness";
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
function freshnessLabel(status: FreshnessStatus | undefined): string {
  return status
    ? FRESHNESS_STATUS_LABELS[status]
    : "Freshness not evaluated for this saved version";
}

type HealthProfileDrawerProps = {
  system: SystemInsight | null;
  layoutLabel: string;
  open: boolean;
  navigationReturnTo?: string | null;
  assessmentLifecycleState?: HealthProfileAssessmentDisplayState;
  assessmentError?: string | null;
  onClose: () => void;
};

export function HealthProfileDrawer({
  system,
  layoutLabel,
  open,
  navigationReturnTo,
  assessmentLifecycleState = "current",
  assessmentError,
  onClose,
}: HealthProfileDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    drawerRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !system) return null;

  const status = assessmentStatusLabel(system.state_score, system.data_confidence);
  const lifecycleLabel = assessmentDisplayStateLabel(assessmentLifecycleState);
  const lifecycleDescription = assessmentDisplayStateDescription(assessmentLifecycleState);

  const readinessReasons = system.score_readiness.reasons;
  const missingGroups = readinessReasons.flatMap((reason) =>
    reason.code === "missing" && reason.required_group
      ? [reason.required_group]
      : []
  );
  const invalidKeys = new Set(
    readinessReasons.flatMap((reason) =>
      reason.code === "invalid" ? reason.present_keys : []
    )
  );
  const isUpdating = readinessReasons.some((reason) => reason.code === "outdated" && reason.required_group == null);
  const hasStaleObservation = system.markers.some((marker) => marker.freshness_status === "outdated");
  const hasUnknownDate = readinessReasons.some((reason) => reason.code === "unknown_date")
    || system.markers.some((marker) => marker.freshness_status === "unknown_date");
  const supportingMarkers = system.markers.filter((marker) => marker.score_role !== "core");
  const drawerState =
    isUpdating
      ? "Health Profile assessment is updating"
      : system.id === "general"
        ? "Not scored - supporting / specialty data"
        : system.markers.length === 0
          ? "No data"
          : system.scoreability === "non_scoreable"
            ? "Not scored - individual markers only"
            : hasStaleObservation
              ? "Not scored - outdated data"
              : hasUnknownDate
                ? "Not scored - date unavailable"
                : system.state_score == null
                  ? "Not scored - incomplete core"
                  : null;
  const profilePath = buildHealthNavigationPath("/app/profile", {
    system: system.id,
    returnTo: navigationReturnTo,
  });
  const primarySourceMeasurement =
    system.primary_source
      ? system.markers.find(
          (marker) =>
            marker.document_id === system.primary_source?.id &&
            marker.measurement_definition_key,
        )?.measurement_definition_key ?? null
      : null;
  const primarySourceHref = system.primary_source
    ? buildHealthNavigationPath(`/app/documents/${system.primary_source.id}`, {
        system: system.id,
        measurement: primarySourceMeasurement,
        returnTo: profilePath,
      })
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
        ref={drawerRef}
        id="health-profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="health-profile-drawer-title"
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-white shadow-xl outline-none"
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
          {assessmentLifecycleState !== "current" ? (
            <section
              id="health-profile-drawer-lifecycle"
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              aria-live="polite"
            >
              <h3 className="font-semibold">{lifecycleLabel}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{lifecycleDescription}</p>
              {assessmentError ? (
                <p className="mt-2 text-sm text-muted-foreground">{assessmentError}</p>
              ) : null}
            </section>
          ) : null}
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-slate-50 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Current state assessment</p>
              <p className="text-2xl font-bold">
                {system.state_score == null ? "—" : `${system.state_score}/100`}
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
                  (status === "Limited data" || status === "Assessment unavailable") &&
                    "bg-slate-200 text-slate-700"
                )}
              >
                {status}
              </span>
            </div>
          </div>
          <ScoreProvenancePanel
            systemId={system.id}
            stateScore={system.state_score}
            provenance={system.score_provenance}
            navigationReturnTo={navigationReturnTo}
          />

          {drawerState ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold">{drawerState}</h3>
              {system.id === "general" ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  These supporting or specialty markers do not drive named-system assessments.
                </p>
              ) : null}
              {isUpdating ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  The previous score is not shown as current while updated records are assessed.
                </p>
              ) : null}
              {hasStaleObservation && !isUpdating ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Required observations older than the current assessment policy do not unlock a numeric score.
                </p>
              ) : null}
              {hasUnknownDate ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  A required observation has no available medical date, so its currentness cannot be evaluated.
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
              {invalidKeys.size > 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Present but not usable for this assessment: {[...invalidKeys].join(", ")}.
                </p>
              ) : null}
              {!isUpdating ? (
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/app/upload">Upload a document</Link>
                </Button>
              ) : null}
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
                {primarySourceHref ? (
                  <Link
                    href={primarySourceHref}
                    className="mt-2 inline-block rounded-sm text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    Open source document
                  </Link>
                ) : null}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-semibold">Data</h3>
            <ul className="mt-3 space-y-3">
              {system.markers.map((marker) => {
                const measurementHref = marker.measurement_definition_key
                  ? buildHealthNavigationPath("/app/biomarkers", {
                      system: system.id,
                      measurement: marker.measurement_definition_key,
                      returnTo: profilePath,
                    })
                  : null;
                const sourceHref = marker.source
                  ? buildHealthNavigationPath(`/app/documents/${marker.source.id}`, {
                      system: system.id,
                      measurement: marker.measurement_definition_key,
                      returnTo: profilePath,
                    })
                  : null;

                return (
                  <li key={marker.key} className="rounded-lg border p-3 text-sm">
                    {measurementHref ? (
                      <Link
                        href={measurementHref}
                        className="font-medium text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                      >
                        {marker.name}
                      </Link>
                    ) : (
                      <p className="font-medium">{marker.name}</p>
                    )}
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
                      {freshnessLabel(marker.freshness_status)}
                    </p>
                    {marker.observed_at ? (
                      <p className="text-xs text-muted-foreground">
                        Observed {marker.observed_at}
                      </p>
                    ) : null}
                    {marker.observation_kind === "instrumental" ? (
                      <p className="text-xs font-medium text-teal-700">
                        From imaging/functional study
                      </p>
                    ) : null}
                    {marker.source ? (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Source: {marker.source.original_filename}
                          {marker.source.observed_at
                            ? ` · ${formatSourceDate(marker.source.observed_at)}`
                            : ""}
                        </span>
                        {sourceHref ? (
                          <Link
                            href={sourceHref}
                            className="font-medium text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                          >
                            Open source
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                    {measurementHref ? (
                      <Link
                        href={measurementHref}
                        className="mt-2 inline-block text-xs font-medium text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                      >
                        View measurement history
                      </Link>
                    ) : null}
                  </li>
                );
              })}
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
