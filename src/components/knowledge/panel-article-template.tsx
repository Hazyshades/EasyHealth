import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  getMeasurementDefinition,
  type PanelDefinition,
} from "@/lib/biomarkers";
import type {
  PanelArticle,
  PanelArticleMember,
  PanelArticleMemberRole,
  PanelArticleObservation,
} from "@/lib/knowledge-base";
import { formatMeasurementObservationValue } from "@/lib/knowledge-base/measurement-results";

const ROLE_LABELS: Record<PanelArticleMemberRole, string> = {
  core: "Core panel member",
  optional: "Often included",
  related: "Related marker",
};

function memberDisplayName(member: PanelArticleMember): string {
  return (
    getMeasurementDefinition(member.measurementDefinitionKey)?.displayName ??
    member.measurementDefinitionKey
  );
}

function displayResultName(result: PanelArticleObservation): string {
  if (result.measurement_definition_key) {
    const definition = getMeasurementDefinition(
      result.measurement_definition_key,
    );
    if (definition) return definition.displayName;
  }
  return result.name || "CBC measurement";
}

function displayObservedDate(value: string | null): string {
  return value?.trim() || "Date not recorded";
}

function MemberCard({ member }: { member: PanelArticleMember }) {
  return (
    <li className="rounded-xl border border-[var(--eh-border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="min-w-0 text-sm font-semibold text-[var(--eh-text-primary)]">
          {memberDisplayName(member)}
        </h4>
        <StatusChip variant="neutral">{ROLE_LABELS[member.role]}</StatusChip>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
        {member.explanation}
      </p>
    </li>
  );
}

function ArticleSources({ article }: { article: PanelArticle }) {
  return (
    <section
      aria-labelledby="panel-article-sources"
      className="border-t border-[var(--eh-border)] pt-6"
    >
      <h2
        id="panel-article-sources"
        className="text-base font-semibold text-[var(--eh-text-primary)]"
      >
        Sources
      </h2>
      <ul className="mt-3 space-y-2">
        {article.sources.map((source) => (
          <li
            key={source.url}
            className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm"
          >
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-[var(--eh-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
            >
              {source.title}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <span className="text-[var(--eh-text-muted)]">
              {source.publisher} · accessed {source.accessedAt}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type PanelArticleResultState =
  | Readonly<{ status: "loading" }>
  | Readonly<{
      status: "error";
      message: string;
      onRetry?: () => void;
    }>
  | Readonly<{
      status: "ready";
      results: readonly PanelArticleObservation[];
      resultHref: (result: PanelArticleObservation) => string | null;
    }>;

type PanelArticleResultsProps = Readonly<{
  state: PanelArticleResultState;
  resultLabel: string;
}>;

function PanelArticleResults({ state, resultLabel }: PanelArticleResultsProps) {
  return (
    <section
      aria-labelledby="panel-article-your-results"
      className="rounded-2xl border border-[var(--eh-brand)]/20 bg-[var(--eh-brand-soft)]/45 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="panel-article-your-results"
            className="text-balance text-base font-semibold text-[var(--eh-text-primary)]"
          >
            Your {resultLabel} results
          </h2>
          <p className="mt-1 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
            These are the {resultLabel} measurements already saved from your
            documents. They are shown as recorded, without an interpretation on
            this page.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[var(--eh-brand)]/30 bg-white"
        >
          <Link href="/app/biomarkers">Open Biomarkers</Link>
        </Button>
      </div>

      {state.status === "loading" ? (
        <ul
          className="mt-4 space-y-2"
          aria-label={`Loading your ${resultLabel} results`}
          role="status"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <li
              key={index}
              className="rounded-xl border border-white/80 bg-white p-4"
            >
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-4 w-3/5" />
            </li>
          ))}
        </ul>
      ) : state.status === "error" ? (
        <div
          className="mt-4 rounded-xl border border-red-200 bg-white p-4"
          role="alert"
        >
          <p className="text-sm font-medium text-[var(--eh-text-primary)]">
            Your saved results are unavailable
          </p>
          <p className="mt-1 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
            {state.message}
          </p>
          {state.onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={state.onRetry}
              className="mt-3"
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : state.results.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--eh-border)] bg-white p-4">
          <p className="text-sm font-medium text-[var(--eh-text-primary)]">
            No {resultLabel} results are linked yet.
          </p>
          <p className="mt-1 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
            Upload a laboratory document or open Biomarkers to review the
            results already in your record.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              className="bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
            >
              <Link href="/app/upload">Upload document</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="bg-white">
              <Link href="/app/biomarkers">Go to Biomarkers</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul
          className="mt-4 grid gap-2 md:grid-cols-2"
          aria-label={`Your ${resultLabel} results`}
        >
          {state.results.map((result) => {
            const href = state.resultHref(result);
            const sourceName =
              result.documents?.original_filename ??
              "Source document unavailable";
            const content = (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
                      {displayResultName(result)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
                      {formatMeasurementObservationValue(result)}
                    </p>
                  </div>
                  {href ? (
                    <ExternalLink
                      className="size-4 shrink-0 text-[var(--eh-brand)]"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-[var(--eh-text-muted)]">
                  {displayObservedDate(result.observed_at)} · {sourceName}
                </p>
              </>
            );
            return (
              <li key={result.id}>
                {href ? (
                  <Link
                    href={href}
                    className="block rounded-xl border border-white/80 bg-white p-4 transition-colors hover:border-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="rounded-xl border border-white/80 bg-white p-4">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type PanelArticleTemplateProps = Readonly<{
  article: PanelArticle;
  panel: PanelDefinition;
  resultLabel: string;
  resultState: PanelArticleResultState;
}>;

export function PanelArticleTemplate({
  article,
  panel,
  resultLabel,
  resultState,
}: PanelArticleTemplateProps) {
  const reviewLabel =
    article.reviewStatus === "published"
      ? "Clinically reviewed"
      : "Clinical review pending";
  const publicationLabel =
    article.reviewStatus === "published"
      ? "Panel guide"
      : "Educational preview";

  return (
    <article className="space-y-6" aria-label={article.title}>
      <PageHeader
        title={article.title}
        subtitle={article.summary}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip variant="neutral">{publicationLabel}</StatusChip>
            <StatusChip variant="info">{reviewLabel}</StatusChip>
          </div>
        }
      />

      <SurfaceCard padding="lg" className="space-y-6">
        <section aria-labelledby="panel-article-purpose">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-[var(--eh-health)]" aria-hidden />
            <h2
              id="panel-article-purpose"
              className="text-balance text-base font-semibold text-[var(--eh-text-primary)]"
            >
              What this panel is
            </h2>
          </div>
          <p className="mt-3 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
            {article.purpose}
          </p>
          <p className="mt-2 text-sm text-[var(--eh-text-muted)]">
            Also called: {panel.alternateNames.join(", ")}
          </p>
        </section>

        <aside
          role="note"
          className="rounded-xl border border-[var(--eh-health)]/25 bg-[var(--eh-page-bg)] p-4"
        >
          <p className="text-sm font-semibold text-[var(--eh-text-primary)]">
            Panel composition varies
          </p>
          <p className="mt-1 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
            {article.compositionNote}
          </p>
        </aside>

        <section aria-labelledby="panel-article-measurements">
          <div>
            <h2
              id="panel-article-measurements"
              className="text-balance text-base font-semibold text-[var(--eh-text-primary)]"
            >
              Measurements in {panel.displayName}
            </h2>
            <p className="mt-1 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
              The groups below organize the measurements in the reviewed panel
              registry. “Often included” means the measurement is an optional
              panel member, not that it appears on every report.
            </p>
          </div>
          <div className="mt-5 space-y-5">
            {article.subgroups.map((subgroup) => (
              <section
                key={subgroup.key}
                aria-labelledby={`panel-article-subgroup-${subgroup.key}`}
              >
                <h3
                  id={`panel-article-subgroup-${subgroup.key}`}
                  className="text-balance text-sm font-semibold text-[var(--eh-text-primary)]"
                >
                  {subgroup.title}
                </h3>
                <p className="mt-1 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
                  {subgroup.summary}
                </p>
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {subgroup.members.map((member) => (
                    <MemberCard
                      key={member.measurementDefinitionKey}
                      member={member}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        {article.relatedMarkers.length > 0 ? (
          <section aria-labelledby="panel-article-related">
            <h2
              id="panel-article-related"
              className="text-balance text-base font-semibold text-[var(--eh-text-primary)]"
            >
              Related measurements
            </h2>
            <p className="mt-1 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
              These measurements belong to related panels or workflows. They are
              not guaranteed members of {panel.displayName}.
            </p>
            <ul className="mt-3 grid gap-3 md:grid-cols-3">
              {article.relatedMarkers.map((member) => (
                <MemberCard
                  key={member.measurementDefinitionKey}
                  member={member}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </SurfaceCard>

      <PanelArticleResults state={resultState} resultLabel={resultLabel} />

      <SurfaceCard padding="lg" className="space-y-6">
        <ArticleSources article={article} />
        <p className="border-t border-[var(--eh-border)] pt-5 text-xs leading-5 text-[var(--eh-text-muted)]">
          {article.disclaimer}
        </p>
      </SurfaceCard>
    </article>
  );
}
