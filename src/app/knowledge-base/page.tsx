import type { Metadata } from "next";
import Link from "next/link";
import {
  KNOWLEDGE_BASE_ROUTE,
  listPublicKnowledgeBaseArticles,
} from "@/lib/knowledge-base";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Knowledge Base | EasyHealth",
  description:
    "Reviewed educational information about laboratory measurements and panels.",
};

export default function KnowledgeBaseIndexPage() {
  const articles = listPublicKnowledgeBaseArticles();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--eh-border)] px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-sm font-semibold text-[var(--eh-brand)]"
          >
            ← EasyHealth
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--eh-brand)]">
            Education
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--eh-text-primary)] sm:text-4xl">
            Knowledge Base
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--eh-text-secondary)]">
            Clear, reviewed information to help you understand what your
            laboratory documents say.
          </p>
        </header>

        {articles.length === 0 ? (
          <section
            className="mt-10 rounded-2xl border border-[var(--eh-border)] bg-[var(--eh-brand-soft)] p-6"
            aria-live="polite"
          >
            <h2 className="text-lg font-semibold text-[var(--eh-text-primary)]">
              Reviewed articles are being prepared
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--eh-text-secondary)]">
              No educational articles are available yet. Articles appear here
              only after review, source, and freshness checks pass.
            </p>
          </section>
        ) : (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {articles.map((article) => {
              const locale = article.locale.toLowerCase().startsWith("en")
                ? "en-US"
                : article.locale;
              const reviewedDate = new Intl.DateTimeFormat(locale, {
                dateStyle: "long",
                timeZone: "UTC",
              }).format(new Date(article.reviewedAt));
              return (
                <li
                  key={article.slug}
                  className="rounded-2xl border border-[var(--eh-border)] p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--eh-brand)]">
                    {article.type}
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-[var(--eh-text-primary)]">
                    <Link
                      href={`${KNOWLEDGE_BASE_ROUTE}/${article.slug}`}
                      className="hover:underline"
                    >
                      {article.title}
                    </Link>
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--eh-text-secondary)]">
                    {article.summary}
                  </p>
                  <p className="mt-5 text-xs text-[var(--eh-text-muted)]">
                    Last reviewed {reviewedDate} · {article.sources.length}{" "}
                    source{article.sources.length === 1 ? "" : "s"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
