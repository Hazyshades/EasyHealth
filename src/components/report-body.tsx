import Link from "next/link";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import type { PersistedBiomarkerDynamicsBinding } from "@/lib/reports";
import {
  formatBiomarkerDynamicsSeriesLabel,
  formatBiomarkerDynamicsValue,
} from "@/lib/biomarker-dynamics-format";

/** Renders simple `**bold**` segments from model output as <strong>. */
function renderReportText(text: string) {
  if (!text.includes("**")) return text;

  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
function formatDynamicsDirection(direction: string): string {
  const formatted = direction.replaceAll("_", " ");
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export type ReportContent = {
  overview: string;
  key_findings: string[];
  changes: string[];
  questions_for_clinician: string[];
  when_to_seek_care: string;
  disclaimer: string;
  biomarker_dynamics?: PersistedBiomarkerDynamicsBinding;
};

export function ReportBody({ content }: { content: ReportContent }) {
  return (
    <article className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <section>
        <h2 className="font-semibold">Overview</h2>
        <p className="mt-2 text-sm">{renderReportText(content.overview)}</p>
      </section>
      <ReportSection title="Key findings" items={content.key_findings} />
      <ReportSection title="Changes over time" items={content.changes} />
      {content.biomarker_dynamics ? (
        <ReportDynamicsSection binding={content.biomarker_dynamics} />
      ) : null}
      <ReportSection
        title="Questions for your clinician"
        items={content.questions_for_clinician}
      />
      <section>
        <h2 className="font-semibold">When to seek care</h2>
        <p className="mt-2 text-sm">
          {renderReportText(content.when_to_seek_care)}
        </p>
      </section>
      <p className="border-t pt-4 text-xs font-medium text-amber-800">
        {content.disclaimer ?? MEDICAL_DISCLAIMER}
      </p>
    </article>
  );
}

function ReportDynamicsSection({
  binding,
}: {
  binding: PersistedBiomarkerDynamicsBinding;
}) {
  const { dto } = binding;

  return (
    <section className="space-y-4 border-t pt-4">
      <div>
        <h2 className="font-semibold">Biomarker dynamics</h2>
        <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
          Numeric direction for{" "}
          {dto.period
            ? `${dto.period.start} to ${dto.period.end}`
            : "all available dates"}
          . This section does not diagnose conditions or describe treatment
          response.
        </p>
      </div>
      {dto.incompatibilities.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h3 className="text-sm font-semibold text-amber-900">
            Separate evidence
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {dto.incompatibilities.map((item) => {
              const affectedSeries = item.seriesIds.flatMap((seriesId) => {
                const series = dto.series.find(
                  (candidate) => candidate.id === seriesId,
                );
                return series
                  ? [formatBiomarkerDynamicsSeriesLabel(series)]
                  : [];
              });
              return (
                <li key={item.id}>
                  {item.detail} Affected series:{" "}
                  {affectedSeries.join("; ") || item.seriesIds.join(", ")}.
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {dto.series.length === 0 ? (
        <p className="text-sm text-[var(--eh-text-secondary)]">
          No comparable numeric series were available for this report scope.
        </p>
      ) : (
        dto.series.map((series) => (
          <div key={series.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">
                {formatBiomarkerDynamicsSeriesLabel(series)}
              </h3>
              <span className="text-sm font-medium">
                {formatDynamicsDirection(series.direction)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--eh-text-secondary)]">
              {series.statistics.pointCount} points
              {series.displayUnit ? ` · ${series.displayUnit}` : ""}
              {series.directionTolerance
                ? ` · tolerance ${series.directionTolerance.absolute}`
                : ""}
            </p>
            <p className="mt-2 text-sm">
              Minimum:{" "}
              {formatBiomarkerDynamicsValue(
                series.statistics.minimum,
                series.displayUnit,
              )}
              {" · "}Maximum:{" "}
              {formatBiomarkerDynamicsValue(
                series.statistics.maximum,
                series.displayUnit,
              )}
              {" · "}Latest:{" "}
              {formatBiomarkerDynamicsValue(
                series.statistics.latest?.displayValue ?? null,
                series.displayUnit,
              )}
            </p>
            {series.limitations.filter(
              (limitation) =>
                limitation.code === "comparison_unavailable" ||
                limitation.code === "direction_policy_unavailable",
            ).length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--eh-text-secondary)]">
                {series.limitations
                  .filter(
                    (limitation) =>
                      limitation.code === "comparison_unavailable" ||
                      limitation.code === "direction_policy_unavailable",
                  )
                  .map((limitation) => (
                    <li key={`${series.id}-${limitation.code}`}>
                      {limitation.message}
                    </li>
                  ))}
              </ul>
            ) : null}
            <ul className="mt-3 space-y-2 text-sm">
              {series.points.map((point) => {
                const referenceRange =
                  point.nativeReferenceLow != null ||
                  point.nativeReferenceHigh != null
                    ? `${point.nativeReferenceLow ?? "not recorded"} to ${point.nativeReferenceHigh ?? "not recorded"} ${point.nativeUnit ?? ""}`.trim()
                    : "No native reference range";

                return (
                  <li
                    key={point.observationId}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t pt-2 first:border-t-0 first:pt-0"
                  >
                    <span>
                      {point.observedAt} ·{" "}
                      {formatBiomarkerDynamicsValue(
                        point.displayValue,
                        point.displayUnit,
                      )}
                    </span>
                    <span className="text-xs text-[var(--eh-text-secondary)]">
                      Lab value: {point.nativeValue} {point.nativeUnit ?? ""}
                    </span>
                    <span className="text-xs text-[var(--eh-text-secondary)]">
                      Range: {referenceRange}
                    </span>
                    <Link
                      className="text-xs font-medium text-[var(--eh-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                      href={point.source.href}
                    >
                      {point.source.filename}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
      {dto.limitations.length > 0 ? (
        <p className="text-xs text-[var(--eh-text-secondary)]">
          Limitations:{" "}
          {dto.limitations.map((limitation) => limitation.message).join(" ")}
        </p>
      ) : null}
    </section>
  );
}

function ReportSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--eh-text-muted)]">
          No entries were generated for this section.
        </p>
      ) : (
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{renderReportText(item)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
