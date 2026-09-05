"use client";

import Link from "next/link";
import { FileText, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildMeasurementBiomarkersHref,
  buildMeasurementObservationSourceHref,
  formatMeasurementObservationValue,
  parseMeasurementResultsResponse,
  selectMeasurementObservations,
  type MeasurementObservation,
} from "@/lib/knowledge-base/measurement-results";

function ResultRow({
  observation,
  returnTo,
}: {
  observation: MeasurementObservation;
  returnTo: string;
}) {
  const sourceHref = buildMeasurementObservationSourceHref(
    observation,
    returnTo,
  );
  const sourceLabel =
    observation.documents?.original_filename ?? "source document";

  return (
    <li className="border-t border-[var(--eh-border-soft)] pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[var(--eh-text-primary)]">
            {formatMeasurementObservationValue(observation)}
          </p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
            Observed {observation.observed_at}
          </p>
        </div>
        {sourceHref ? (
          <Link
            href={sourceHref}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-[var(--eh-brand)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
          >
            <FileText className="size-4" aria-hidden />
            <span>View {sourceLabel}</span>
          </Link>
        ) : (
          <span className="text-xs text-[var(--eh-text-muted)]">
            Source document unavailable
          </span>
        )}
      </div>
    </li>
  );
}

export function SignedInMeasurementResultsStrip({
  measurementDefinitionKey,
  returnTo,
}: {
  measurementDefinitionKey: string;
  returnTo: string;
}) {
  const [observations, setObservations] = useState<
    readonly MeasurementObservation[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/biomarkers", { cache: "no-store" });
      if (!response.ok)
        throw new Error("We could not load your uploaded results.");
      const payload: unknown = await response.json();
      const allObservations = parseMeasurementResultsResponse(payload);
      setObservations(
        selectMeasurementObservations(
          allObservations,
          measurementDefinitionKey,
        ),
      );
    } catch (caught) {
      setObservations([]);
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not load your uploaded results.",
      );
    } finally {
      setLoading(false);
    }
  }, [measurementDefinitionKey]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  return (
    <section
      id="your-results"
      aria-labelledby="your-results-heading"
      className="rounded-[14px] border border-[var(--eh-border)] bg-white p-5"
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="your-results-heading"
            className="text-balance text-lg font-semibold text-[var(--eh-text-primary)]"
          >
            Your results
          </h2>
          <p className="mt-1 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
            Values below come from your uploaded lab documents. Units follow
            your Biomarkers display preference; this page is educational and not
            a diagnosis.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-lg"
          onClick={() => void loadResults()}
          disabled={loading}
          aria-label="Refresh your results"
        >
          <RefreshCw
            className={loading ? "size-4 motion-safe:animate-spin" : "size-4"}
            aria-hidden
          />
        </Button>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <span className="sr-only">Loading your results</span>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : error ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-[var(--eh-text-secondary)]">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => void loadResults()}
            >
              Try again
            </Button>
          </div>
        ) : observations.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--eh-text-secondary)]">
              No uploaded result for this measurement is available yet.
            </p>
            <Button asChild variant="outline" className="rounded-lg">
              <Link
                href={buildMeasurementBiomarkersHref(measurementDefinitionKey)}
              >
                Open Biomarkers
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-4">
            {observations.map((observation) => (
              <ResultRow
                key={observation.id}
                observation={observation}
                returnTo={returnTo}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
