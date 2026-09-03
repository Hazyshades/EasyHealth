import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  formatKnowledgeSpecimen,
  formatKnowledgeUnit,
  getKnowledgeArticlePath,
  type KnowledgeArticle,
  type KnowledgeArticleRecord,
} from "@/lib/knowledge-base/content";
import { getMeasurementDefinition } from "@/lib/biomarkers";
import { buildHealthNavigationPath } from "@/lib/health-navigation";

const sectionClassName =
  "rounded-2xl border border-[var(--eh-border)] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-7";
const markdownClassName =
  "knowledge-article-prose max-w-3xl text-[0.9375rem] leading-7 text-[var(--eh-text-secondary)] [&_h2]:mt-9 [&_h2]:scroll-mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-[var(--eh-text-primary)] [&_h2:first-child]:mt-0 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--eh-text-primary)] [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-[var(--eh-text-primary)] [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6";


export type BiomarkerArticleTemplateProps = {
  article: KnowledgeArticle;
  publishedArticles: readonly KnowledgeArticleRecord[];
};

export function BiomarkerArticleTemplate({
  article,
  publishedArticles,
}: BiomarkerArticleTemplateProps) {
  const aliases = Array.from(
    new Set(
      article.measurementDefinitions.flatMap((definition) =>
        definition.aliases
          .filter((alias) => alias.locale === "en" && alias.lifecycle === "active")
          .map((alias) => alias.value),
      ),
    ),
  );
  const units = Array.from(
    new Set(
      article.measurementDefinitions.flatMap((definition) =>
        definition.unitPolicy.acceptedUnits.map(formatKnowledgeUnit),
      ),
    ),
  );
  const specimens = Array.from(
    new Set(article.measurementDefinitions.map((definition) => formatKnowledgeSpecimen(definition.specimen))),
  );
  const relatedMeasurements = article.relatedMeasurementKeys.map((key) => ({
    key,
    definition: getMeasurementDefinition(key),
    article: publishedArticles.find(
      (candidate) =>
        candidate.slug !== article.slug && candidate.measurementDefinitionKeys.includes(key),
    ),
  }));

  return (
    <div className="min-h-screen bg-[var(--eh-canvas)] text-[var(--eh-text-primary)]">
      <header className="border-b border-[var(--eh-border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-md text-sm font-semibold text-[var(--eh-brand)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
          >
            EasyHealth
          </Link>
          <Link
            href="/app/biomarkers"
            className="rounded-md text-sm font-medium text-[var(--eh-text-secondary)] underline-offset-4 hover:text-[var(--eh-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
          >
            Your biomarkers
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--eh-text-secondary)]">
          <Link
            href="/"
            className="underline-offset-4 hover:text-[var(--eh-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
          >
            Home
          </Link>
          <span aria-hidden="true" className="px-2 text-[var(--eh-text-muted)]">
            /
          </span>
          <span>Knowledge Base</span>
          <span aria-hidden="true" className="px-2 text-[var(--eh-text-muted)]">
            /
          </span>
          <span aria-current="page">Biomarker guide</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="space-y-6">
            <header className={sectionClassName}>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--eh-health)]">
                Educational biomarker guide
              </p>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.02em] text-[var(--eh-text-primary)] sm:text-4xl">
                {article.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--eh-text-secondary)]">
                {article.summary}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[var(--eh-text-secondary)]">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                  Reviewed
                </span>
                <span>Updated {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(article.reviewedAt))}</span>
                <span aria-hidden="true">·</span>
                <span>Content version {article.contentVersion}</span>
              </div>
            </header>

            <section className={sectionClassName} aria-labelledby="registry-metadata-heading">
              <div className="mb-5 flex items-baseline justify-between gap-4">
                <h2 id="registry-metadata-heading" className="text-lg font-semibold text-[var(--eh-text-primary)]">
                  Measurement details
                </h2>
                <span className="text-xs text-[var(--eh-text-muted)]">Registry 2.0</span>
              </div>
              <dl className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                    Registry definitions
                  </dt>
                  <dd className="mt-2 space-y-1">
                    {article.measurementDefinitions.map((definition) => (
                      <code key={definition.key} className="block break-all font-mono text-xs text-[var(--eh-text-primary)]">
                        {definition.key}
                      </code>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                    Aliases
                  </dt>
                  <dd className="mt-2 text-sm text-[var(--eh-text-secondary)]">
                    {aliases.length > 0 ? aliases.join(", ") : "No additional English aliases"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                    Common units
                  </dt>
                  <dd className="mt-2 text-sm text-[var(--eh-text-secondary)]">
                    {units.length > 0 ? units.join(", ") : "Unit not applicable"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                    Specimen
                  </dt>
                  <dd className="mt-2 text-sm text-[var(--eh-text-secondary)]">{specimens.join("; ")}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                    Panel membership
                  </dt>
                  <dd className="mt-2 text-sm text-[var(--eh-text-secondary)]">
                    {article.panels.length > 0
                      ? article.panels.map((panel) => panel.displayName).join(", ")
                      : "No curated panel membership in the current Registry 2.0"}
                  </dd>
                </div>
              </dl>
            </section>

            <article className={`${sectionClassName} ${markdownClassName}`}>
              <ReactMarkdown>{article.body}</ReactMarkdown>
            </article>

            <section className={sectionClassName} aria-labelledby="sources-heading">
              <h2 id="sources-heading" className="text-lg font-semibold text-[var(--eh-text-primary)]">
                Sources
              </h2>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--eh-text-secondary)]">
                {article.sources.map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--eh-brand)] underline underline-offset-2 hover:text-[var(--eh-health)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
                    >
                      {source.title}
                    </a>
                    <span className="ml-2">{source.publisher}</span>
                    <span className="ml-2 text-xs text-[var(--eh-text-muted)]">Accessed {source.accessedAt}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 sm:p-7" aria-labelledby="disclaimer-heading">
              <h2 id="disclaimer-heading" className="text-lg font-semibold text-sky-950">
                Educational disclaimer
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-900">
                This page is for general education, not medical advice, diagnosis, or treatment. Laboratory results need the reporting laboratory&apos;s context and a qualified healthcare professional&apos;s interpretation. Do not use this page to make decisions about your care.
              </p>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-[var(--eh-brand)]/20 bg-[var(--eh-brand-soft)] p-5" aria-labelledby="private-data-heading">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--eh-brand)]">Private workspace</p>
              <h2 id="private-data-heading" className="mt-2 text-lg font-semibold text-[var(--eh-text-primary)]">
                Your EasyHealth data
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
                Open your own accepted observations separately. This public guide never includes personal results.
              </p>
              <div className="mt-4 space-y-2">
                {article.measurementDefinitions.map((definition) => (
                  <Link
                    key={definition.key}
                    href={buildHealthNavigationPath("/app/biomarkers", { measurement: definition.key })}
                    className="block rounded-lg border border-[var(--eh-brand)]/20 bg-white px-3 py-2 text-sm font-medium text-[var(--eh-brand)] underline-offset-4 hover:border-[var(--eh-brand)]/40 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
                  >
                    Open {definition.displayName}
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--eh-border)] bg-white p-5" aria-labelledby="related-heading">
              <h2 id="related-heading" className="text-lg font-semibold text-[var(--eh-text-primary)]">
                Related measurements
              </h2>
              <ul className="mt-4 space-y-3">
                {relatedMeasurements.map(({ key, definition, article: relatedArticle }) => (
                  <li key={key} className="text-sm leading-5">
                    {relatedArticle ? (
                      <Link
                        href={getKnowledgeArticlePath(relatedArticle.slug)}
                        className="font-medium text-[var(--eh-brand)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
                      >
                        {definition?.displayName ?? key}
                      </Link>
                    ) : (
                      <span className="text-[var(--eh-text-secondary)]">{definition?.displayName ?? key}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-[var(--eh-border)] bg-white p-5 text-sm text-[var(--eh-text-secondary)]" aria-labelledby="review-heading">
              <h2 id="review-heading" className="text-lg font-semibold text-[var(--eh-text-primary)]">
                Review metadata
              </h2>
              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">Reviewed by</dt>
                  <dd className="mt-1">{article.reviewedBy}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">Last reviewed</dt>
                  <dd className="mt-1">{new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(article.reviewedAt))}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
