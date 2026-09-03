import Link from "next/link";
import { ArrowRight, BookOpen, Filter, Search } from "lucide-react";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  getKnowledgeCategoryLabel,
  getKnowledgePanel,
  listKnowledgePanels,
  searchKnowledgeEntries,
} from "@/lib/knowledge-base";
import { getKnowledgeArticleHref } from "@/lib/knowledge-base/links";
import type {
  KnowledgeCategory,
  KnowledgeSearchResult,
} from "@/lib/knowledge-base/types";

const CATEGORY_ORDER: readonly KnowledgeCategory[] = [
  "blood",
  "metabolic",
  "thyroid",
  "liver",
  "kidney",
  "cardiovascular",
  "nutrients",
  "inflammation",
];

const CATEGORY_OPTIONS: readonly { value: KnowledgeCategory; label: string }[] =
  CATEGORY_ORDER.map((value) => ({
    value,
    label: getKnowledgeCategoryLabel(value),
  }));

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type KnowledgeIndexPageProps = {
  searchParams: SearchParams;
};

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function resultHref(result: KnowledgeSearchResult): string {
  if (result.kind === "panel")
    return `/knowledge/panels/${encodeURIComponent(result.panel.key)}`;
  return getKnowledgeArticleHref(result.article.definition.key) ?? "/knowledge";
}

function ArticleResult({
  result,
}: {
  result: Extract<KnowledgeSearchResult, { kind: "measurement" }>;
}) {
  const article = result.article;
  return (
    <Link
      href={resultHref(result)}
      className="group block rounded-xl border border-[var(--eh-border)] bg-white p-4 transition-colors hover:border-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[var(--eh-text-primary)] group-hover:text-[var(--eh-brand)]">
            {article.definition.displayName}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--eh-text-secondary)]">
            {article.record.summary}
          </p>
          <p className="mt-2 text-xs text-[var(--eh-text-muted)]">
            {result.matchKind === "alias"
              ? `Matched alias: ${result.matchedTerm}`
              : "Canonical measurement"}
          </p>
        </div>
        <ArrowRight
          className="mt-1 size-4 shrink-0 text-[var(--eh-brand)]"
          aria-hidden
        />
      </div>
    </Link>
  );
}

function PanelCard({
  panelKey,
  selected = false,
}: {
  panelKey: string;
  selected?: boolean;
}) {
  const panel = getKnowledgePanel(panelKey);
  if (!panel) return null;
  return (
    <Link
      href={`/knowledge/panels/${encodeURIComponent(panel.key)}`}
      className="group block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
    >
      <SurfaceCard
        padding="md"
        className={
          selected
            ? "h-full border-[var(--eh-brand)] bg-[var(--eh-brand-soft)]"
            : "h-full transition-colors hover:border-[var(--eh-brand)]"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--eh-text-primary)] group-hover:text-[var(--eh-brand)]">
              {panel.displayName}
            </h3>
            <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
              {panel.members.length} listed measurement
              {panel.members.length === 1 ? "" : "s"}
            </p>
          </div>
          <BookOpen
            className="size-5 shrink-0 text-[var(--eh-health)]"
            aria-hidden
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--eh-text-secondary)]">
          {panel.alternateNames.slice(0, 2).join(" · ")}
        </p>
      </SurfaceCard>
    </Link>
  );
}

export default async function KnowledgeIndexPage({
  searchParams,
}: KnowledgeIndexPageProps) {
  const params = await searchParams;
  const query = firstParam(params.q) || firstParam(params.search);
  const categoryValue = firstParam(params.category);
  const panelValue = firstParam(params.panel);
  const category = CATEGORY_ORDER.includes(categoryValue as KnowledgeCategory)
    ? (categoryValue as KnowledgeCategory)
    : "";
  const panel = getKnowledgePanel(panelValue);
  const results = searchKnowledgeEntries({
    query,
    category,
    panel: panel?.key ?? "",
  });
  const articleResults = results.filter(
    (
      result,
    ): result is Extract<KnowledgeSearchResult, { kind: "measurement" }> =>
      result.kind === "measurement",
  );
  const panelResults = results.filter(
    (result): result is Extract<KnowledgeSearchResult, { kind: "panel" }> =>
      result.kind === "panel",
  );
  const hasFilters = Boolean(query || category || panel);
  const groupedArticles = Object.fromEntries(
    CATEGORY_ORDER.map((value) => [
      value,
      articleResults.filter(
        (result) => result.article.record.category === value,
      ),
    ]),
  ) as Record<KnowledgeCategory, typeof articleResults>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ContextBreadcrumbs items={[{ label: "Knowledge Base" }]} />
      <PageHeader
        title="Knowledge Base"
        subtitle="Clear, general information about measurements and panels in EasyHealth. Your private results stay in your records."
      />

      <SurfaceCard padding="lg" className="mb-8 bg-white">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--eh-page-bg)] text-[var(--eh-health)]">
            <Search className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[var(--eh-text-primary)]">
              Find a measurement or panel
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--eh-text-secondary)]">
              Search uses reviewed names and aliases from the measurement
              catalog. Results here are general education, not a reading of any
              individual result.
            </p>
          </div>
        </div>
        <form
          action="/knowledge"
          method="get"
          className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto] md:items-end"
        >
          <div>
            <label
              htmlFor="knowledge-search"
              className="mb-1.5 block text-sm font-medium text-[var(--eh-text-primary)]"
            >
              Search
            </label>
            <SearchInput
              id="knowledge-search"
              name="q"
              defaultValue={query}
              placeholder="Try hemoglobin or HGB"
              aria-label="Search measurements and panels"
              containerClassName="max-w-none"
            />
          </div>
          <div>
            <label
              htmlFor="knowledge-category"
              className="mb-1.5 block text-sm font-medium text-[var(--eh-text-primary)]"
            >
              Category
            </label>
            <select
              id="knowledge-category"
              name="category"
              defaultValue={category}
              className="h-10 w-full rounded-md border border-[var(--eh-border)] bg-white px-3 text-sm text-[var(--eh-text-primary)] outline-none focus-visible:border-[var(--eh-brand)] focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/20"
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="knowledge-panel"
              className="mb-1.5 block text-sm font-medium text-[var(--eh-text-primary)]"
            >
              Panel
            </label>
            <select
              id="knowledge-panel"
              name="panel"
              defaultValue={panel?.key ?? ""}
              className="h-10 w-full rounded-md border border-[var(--eh-border)] bg-white px-3 text-sm text-[var(--eh-text-primary)] outline-none focus-visible:border-[var(--eh-brand)] focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]/20"
            >
              <option value="">All panels</option>
              {listKnowledgePanels().map((option) => (
                <option key={option.key} value={option.key}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--eh-brand)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#4338ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
          >
            <Filter className="size-4" aria-hidden />
            Apply
          </button>
        </form>
      </SurfaceCard>

      <section aria-labelledby="knowledge-panels-heading" className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="knowledge-panels-heading"
              className="text-lg font-semibold text-[var(--eh-text-primary)]"
            >
              Browse panels
            </h2>
            <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
              Panel pages describe the group, while each laboratory report
              determines which members are actually present.
            </p>
          </div>
          {panel ? (
            <Link
              href="/knowledge"
              className="rounded-md px-2 py-1 text-sm font-medium text-[var(--eh-brand)] hover:bg-[var(--eh-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
            >
              Clear panel filter
            </Link>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listKnowledgePanels().map((item) => (
            <PanelCard
              key={item.key}
              panelKey={item.key}
              selected={item.key === panel?.key}
            />
          ))}
        </div>
      </section>

      {query && panelResults.length > 0 ? (
        <section
          aria-labelledby="knowledge-panel-results-heading"
          className="mb-10"
        >
          <h2
            id="knowledge-panel-results-heading"
            className="mb-4 text-lg font-semibold text-[var(--eh-text-primary)]"
          >
            Panel matches
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {panelResults.map((result) => (
              <PanelCard key={result.panel.key} panelKey={result.panel.key} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="knowledge-measurements-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="knowledge-measurements-heading"
              className="text-lg font-semibold text-[var(--eh-text-primary)]"
            >
              {hasFilters ? "Matching measurements" : "Browse measurements"}
            </h2>
            <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
              {articleResults.length} published measurement
              {articleResults.length === 1 ? "" : "s"}
              {query ? ` matching “${query}”` : ""}.
            </p>
          </div>
          {hasFilters ? (
            <Link
              href="/knowledge"
              className="rounded-md px-2 py-1 text-sm font-medium text-[var(--eh-brand)] hover:bg-[var(--eh-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
            >
              Clear filters
            </Link>
          ) : null}
        </div>

        {articleResults.length === 0 ? (
          <SurfaceCard padding="lg" className="border-dashed text-center">
            <p className="text-base font-medium text-[var(--eh-text-primary)]">
              No published measurements found
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--eh-text-secondary)]">
              Try a canonical name, a reviewed alias, or a different panel.
              Private result labels are not searched on this page.
            </p>
            <Link
              href="/knowledge"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-[var(--eh-brand)] hover:bg-[var(--eh-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
            >
              Browse all measurements
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </SurfaceCard>
        ) : (
          <div className="space-y-8">
            {CATEGORY_ORDER.map((categoryKey) => {
              const categoryResults = groupedArticles[categoryKey];
              if (!categoryResults.length) return null;
              return (
                <div key={categoryKey}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-[var(--eh-text-primary)]">
                      {getKnowledgeCategoryLabel(categoryKey)}
                    </h3>
                    {!category && !query ? (
                      <Link
                        href={`/knowledge?category=${encodeURIComponent(categoryKey)}`}
                        className="rounded-md px-2 py-1 text-xs font-medium text-[var(--eh-brand)] hover:bg-[var(--eh-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                      >
                        View category
                      </Link>
                    ) : null}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {categoryResults.map((result) => (
                      <ArticleResult
                        key={result.article.record.slug}
                        result={result}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function generateMetadata() {
  return {
    title: "Knowledge Base | EasyHealth",
    description:
      "General information about EasyHealth measurements and panels.",
  };
}
