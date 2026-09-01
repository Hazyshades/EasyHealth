"use client";

import Link from "next/link";
import { ExternalLink, FileText, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import {
  buildMeasurementBiomarkersHref,
  buildMeasurementObservationSourceHref,
  formatMeasurementObservationValue,
  parseMeasurementResultsResponse,
  selectMeasurementObservations,
  type MeasurementObservation,
} from "@/lib/knowledge-base/measurement-results";
import type {
  MeasurementArticlePanel,
  MeasurementArticleViewModel,
  RelatedMeasurementArticle,
} from "@/lib/knowledge-base";

function reviewedDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function EmptyMetadata({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--eh-text-secondary)]">{children}</p>;
}

function PanelMembershipList({
  panels,
}: {
  panels: readonly MeasurementArticlePanel[];
}) {
  if (panels.length === 0) {
    return (
      <EmptyMetadata>
        This measurement is not currently listed in a supported panel.
      </EmptyMetadata>
    );
  }

  return (
    <ul className="space-y-2 text-sm text-[var(--eh-text-secondary)]">
      {panels.map((panel) => (
        <li
          key={`${panel.key}-${panel.role}`}
          className="flex flex-wrap items-baseline justify-between gap-2"
        >
          <span className="font-medium text-[var(--eh-text-primary)]">
            {panel.displayName}
          </span>
          <span>
            {panel.role === "required" ? "Required member" : "Optional member"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RelatedMeasurementList({
  measurements,
}: {
  measurements: readonly RelatedMeasurementArticle[];
}) {
  if (measurements.length === 0) {
    return (
      <EmptyMetadata>
        No related measurement pages are published yet.
      </EmptyMetadata>
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {measurements.map((measurement) => (
        <li
          key={measurement.key}
          className="flex flex-wrap items-baseline justify-between gap-2"
        >
          {measurement.slug ? (
            <Link
              href={`/app/knowledge/measurements/${measurement.slug}`}
              className="font-medium text-[var(--eh-brand)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
            >
              {measurement.displayName}
            </Link>
          ) : (
            <span className="font-medium text-[var(--eh-text-primary)]">
              {measurement.displayName}
            </span>
          )}
          {!measurement.slug ? (
            <span className="text-xs text-[var(--eh-text-muted)]">
              Article not published
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EducationSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="border-b border-[var(--eh-border-soft)] pb-6 last:border-b-0"
    >
      <h2
        id={`${id}-heading`}
        className="text-balance text-lg font-semibold text-[var(--eh-text-primary)]"
      >
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

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

function PersonalResults({
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

export function MeasurementArticle({
  model,
}: {
  model: MeasurementArticleViewModel;
}) {
  const { article, definition } = model;
  const biomarkersHref = buildMeasurementBiomarkersHref(definition.key);

  return (
    <div className="mx-auto max-w-6xl">
      <ContextBreadcrumbs
        items={[
          { href: biomarkersHref, label: "Biomarkers" },
          { label: article.title },
        ]}
      />
      <PageHeader
        title={article.title}
        subtitle={article.summary}
        actions={
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={biomarkersHref}>View your results</Link>
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <article
          className="min-w-0 space-y-6"
          aria-labelledby="measurement-education-heading"
        >
          <h2 id="measurement-education-heading" className="sr-only">
            Measurement education
          </h2>

          <EducationSection id="what-it-measures" title="What it measures">
            <div className="max-w-[75ch] space-y-3 text-pretty text-[0.9375rem] leading-7 text-[var(--eh-text-secondary)]">
              {article.whatItMeasures.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </EducationSection>

          <EducationSection id="aliases" title="Aliases">
            {model.aliases.length > 0 ? (
              <ul className="flex flex-wrap gap-2 text-sm text-[var(--eh-text-secondary)]">
                {model.aliases.map((alias) => (
                  <li
                    key={alias}
                    className="rounded-full border border-[var(--eh-border)] bg-white px-3 py-1.5"
                  >
                    {alias}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyMetadata>
                No Registry aliases are recorded for this definition.
              </EmptyMetadata>
            )}
          </EducationSection>

          <EducationSection id="common-units" title="Common units">
            {model.commonUnits.length > 0 ? (
              <ul className="flex flex-wrap gap-2 text-sm text-[var(--eh-text-secondary)]">
                {model.commonUnits.map((unit) => (
                  <li
                    key={unit}
                    className="rounded-md bg-[var(--eh-canvas-bg)] px-3 py-1.5"
                  >
                    {unit}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyMetadata>
                This definition does not specify a common unit.
              </EmptyMetadata>
            )}
          </EducationSection>

          <EducationSection id="specimen" title="Specimen">
            <p className="text-sm text-[var(--eh-text-secondary)]">
              {model.specimenLabel}
            </p>
          </EducationSection>

          <EducationSection id="panel-membership" title="Panel membership">
            <PanelMembershipList panels={model.panelMembership} />
          </EducationSection>

          <EducationSection
            id="related-measurements"
            title="Related measurements"
          >
            <RelatedMeasurementList measurements={model.relatedMeasurements} />
          </EducationSection>

          <EducationSection
            id="interpretation-factors"
            title="Interpretation factors"
          >
            <ul className="max-w-[75ch] list-disc space-y-2 pl-5 text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
              {article.interpretationFactors.map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
          </EducationSection>

          <EducationSection id="sources" title="Sources">
            <ul className="space-y-3">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--eh-brand)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                  >
                    <span>{source.title}</span>
                    <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                  <p className="mt-1 text-xs text-[var(--eh-text-secondary)]">
                    {source.publisher}
                  </p>
                </li>
              ))}
            </ul>
          </EducationSection>
        </article>

        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <PersonalResults
            measurementDefinitionKey={definition.key}
            returnTo={`/app/knowledge/measurements/${article.slug}`}
          />
          <div className="mt-4 rounded-[14px] border border-[var(--eh-border-soft)] bg-[var(--eh-canvas-bg)] p-4">
            {article.reviewedBy && article.reviewedAt ? (
              <p className="text-xs leading-5 text-[var(--eh-text-secondary)]">
                Reviewed by {article.reviewedBy} on{" "}
                {reviewedDateLabel(article.reviewedAt)}. Education content is
                version {article.contentVersion}.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <p className="mt-8 max-w-3xl border-t border-[var(--eh-border-soft)] pt-5 text-xs leading-5 text-[var(--eh-text-muted)]">
        {MEDICAL_DISCLAIMER}
      </p>
    </div>
  );
}
