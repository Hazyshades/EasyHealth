import Link from "next/link";
import { ArrowRight, ExternalLink, LockKeyhole } from "lucide-react";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  formatKnowledgeUnit,
  getKnowledgeArticleByMeasurementKey,
  getKnowledgeCategoryLabel,
  getKnowledgePanel,
} from "@/lib/knowledge-base";
import type { KnowledgeArticle } from "@/lib/knowledge-base/types";

const SPECIMEN_LABELS: Record<
  KnowledgeArticle["definition"]["specimen"],
  string
> = {
  serum: "Serum",
  plasma: "Plasma",
  whole_blood: "Whole blood",
  urine: "Urine",
  unspecified: "As reported",
};

export function MeasurementArticle({ article }: { article: KnowledgeArticle }) {
  const { definition, record } = article;
  const relatedArticles = record.relatedMeasurementDefinitionKeys.flatMap(
    (key) => {
      const relatedArticle = getKnowledgeArticleByMeasurementKey(key);
      return relatedArticle ? [relatedArticle] : [];
    },
  );
  const relatedPanels = record.relatedPanelKeys.flatMap((key) => {
    const panel = getKnowledgePanel(key);
    return panel ? [panel] : [];
  });
  const categoryHref = `/knowledge?category=${encodeURIComponent(record.category)}`;
  const privateResultHref = `/app/biomarkers?measurement=${encodeURIComponent(definition.key)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ContextBreadcrumbs
        items={[
          { label: "Knowledge Base", href: "/knowledge" },
          {
            label: getKnowledgeCategoryLabel(record.category),
            href: categoryHref,
          },
          { label: definition.displayName },
        ]}
      />

      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="mb-2 text-sm font-medium text-[var(--eh-health)]">
            Measurement guide
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--eh-text-primary)] [text-wrap:balance]">
            {definition.displayName}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--eh-text-secondary)] [text-wrap:pretty]">
            {record.summary}
          </p>
        </div>
        <Link
          href={privateResultHref}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--eh-brand)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
        >
          View your result
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="min-w-0 space-y-6">
          <SurfaceCard padding="lg">
            <h2 className="text-xl font-semibold text-[var(--eh-text-primary)]">
              What it measures
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--eh-text-secondary)]">
              {record.whatItMeasures}
            </p>
          </SurfaceCard>

          <SurfaceCard padding="lg">
            <h2 className="text-xl font-semibold text-[var(--eh-text-primary)]">
              Factors that can affect interpretation
            </h2>
            <ul className="mt-4 space-y-3 text-base leading-7 text-[var(--eh-text-secondary)]">
              {record.interpretationFactors.map((factor) => (
                <li key={factor} className="flex gap-3">
                  <span
                    className="mt-3 size-1.5 shrink-0 rounded-full bg-[var(--eh-health)]"
                    aria-hidden
                  />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </SurfaceCard>

          {relatedArticles.length > 0 || relatedPanels.length > 0 ? (
            <SurfaceCard padding="lg">
              <h2 className="text-xl font-semibold text-[var(--eh-text-primary)]">
                Related reading
              </h2>
              <div className="mt-4 space-y-4">
                {relatedArticles.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--eh-text-primary)]">
                      Measurements
                    </h3>
                    <ul className="mt-2 divide-y divide-[var(--eh-border-soft)]">
                      {relatedArticles.map((relatedArticle) => (
                        <li key={relatedArticle.record.slug}>
                          <Link
                            href={`/knowledge/biomarkers/${encodeURIComponent(relatedArticle.record.slug)}`}
                            className="group flex items-center justify-between gap-3 py-3 text-sm font-medium text-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                          >
                            <span>{relatedArticle.definition.displayName}</span>
                            <ArrowRight
                              className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {relatedPanels.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--eh-text-primary)]">
                      Panels
                    </h3>
                    <ul className="mt-2 divide-y divide-[var(--eh-border-soft)]">
                      {relatedPanels.map((panel) => (
                        <li key={panel.key}>
                          <Link
                            href={`/knowledge/panels/${encodeURIComponent(panel.key)}`}
                            className="group flex items-center justify-between gap-3 py-3 text-sm font-medium text-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                          >
                            <span>{panel.displayName}</span>
                            <ArrowRight
                              className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </SurfaceCard>
          ) : null}
        </article>

        <aside className="space-y-4">
          <SurfaceCard padding="md">
            <h2 className="text-base font-semibold text-[var(--eh-text-primary)]">
              Registry details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[var(--eh-text-muted)]">Specimen</dt>
                <dd className="mt-0.5 font-medium text-[var(--eh-text-primary)]">
                  {SPECIMEN_LABELS[definition.specimen]}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--eh-text-muted)]">Common units</dt>
                <dd className="mt-0.5 font-medium text-[var(--eh-text-primary)]">
                  {definition.unitPolicy.acceptedUnits
                    .map(formatKnowledgeUnit)
                    .join(" · ") || "As reported"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--eh-text-muted)]">Definition key</dt>
                <dd className="mt-0.5 break-words font-mono text-xs text-[var(--eh-text-secondary)]">
                  {definition.key}
                </dd>
              </div>
            </dl>
          </SurfaceCard>

          <SurfaceCard padding="md">
            <h2 className="text-base font-semibold text-[var(--eh-text-primary)]">
              Also called
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {article.aliases.map((alias) => (
                <span
                  key={alias}
                  className="rounded-full border border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] px-2.5 py-1 text-xs text-[var(--eh-text-secondary)]"
                >
                  {alias}
                </span>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard padding="md" className="bg-[var(--eh-page-bg)]">
            <div className="flex items-start gap-2.5">
              <LockKeyhole
                className="mt-0.5 size-4 shrink-0 text-[var(--eh-health)]"
                aria-hidden
              />
              <div>
                <h2 className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  Your records stay private
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--eh-text-secondary)]">
                  The Knowledge Base is general education. Your result opens in
                  the authenticated Biomarkers area and is not included in this
                  page.
                </p>
              </div>
            </div>
          </SurfaceCard>
        </aside>
      </div>

      <section className="mt-8 grid gap-6 border-t border-[var(--eh-border)] pt-6 sm:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <h2 className="text-base font-semibold text-[var(--eh-text-primary)]">
            Sources
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {record.sources.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[var(--eh-brand)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                >
                  {source.title}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <span className="ml-2 text-[var(--eh-text-muted)]">
                  {source.publisher}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--eh-text-muted)]">
            Content version {record.contentVersion} · Reviewed{" "}
            {record.review.reviewedAt}
          </p>
        </div>
        <p className="text-sm leading-6 text-[var(--eh-text-secondary)]">
          {MEDICAL_DISCLAIMER}
        </p>
      </section>
    </div>
  );
}
