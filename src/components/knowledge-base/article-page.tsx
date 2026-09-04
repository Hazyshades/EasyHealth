import React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import {
  KNOWLEDGE_BASE_ROUTE,
  type PublicKnowledgeBaseArticle,
} from "@/lib/knowledge-base";

type KnowledgeBaseArticlePageProps = {
  article: PublicKnowledgeBaseArticle;
};

export function KnowledgeBaseArticlePage({
  article,
}: KnowledgeBaseArticlePageProps) {
  const locale = article.locale.toLowerCase().startsWith("en")
    ? "en-US"
    : article.locale;
  const reviewedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(article.reviewedAt));

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--eh-border)] px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link
            href={KNOWLEDGE_BASE_ROUTE}
            className="text-sm font-semibold text-[var(--eh-brand)]"
          >
            ← Knowledge Base
          </Link>
          <span className="text-xs text-[var(--eh-text-muted)]">
            Version {article.contentVersion}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <article>
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--eh-brand)]">
              {article.type}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--eh-text-primary)] sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--eh-text-secondary)]">
              {article.summary}
            </p>
            <p className="mt-5 text-sm text-[var(--eh-text-muted)]">
              Last reviewed by {article.reviewedBy} on{" "}
              <time dateTime={article.reviewedAt}>{reviewedDate}</time>
            </p>
          </header>

          <div className="mt-10 space-y-5 text-[var(--eh-text-secondary)] [&_a]:text-[var(--eh-brand)] [&_a]:underline [&_h2]:mt-9 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[var(--eh-text-primary)] [&_h3]:mt-7 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[var(--eh-text-primary)] [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-7 [&_strong]:font-semibold [&_strong]:text-[var(--eh-text-primary)] [&_ul]:space-y-2">
            <ReactMarkdown>{article.body}</ReactMarkdown>
          </div>

          <section
            className="mt-10 border-t border-[var(--eh-border)] pt-6"
            aria-labelledby="knowledge-base-sources"
          >
            <h2
              id="knowledge-base-sources"
              className="text-lg font-semibold text-[var(--eh-text-primary)]"
            >
              Sources
            </h2>
            <ol className="mt-3 space-y-3 text-sm text-[var(--eh-text-secondary)]">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium"
                  >
                    {source.title}
                  </a>
                  {source.publisher ? <span> · {source.publisher}</span> : null}
                </li>
              ))}
            </ol>
          </section>

          <p className="mt-8 border-t border-[var(--eh-border)] pt-5 text-xs leading-5 text-[var(--eh-text-muted)]">
            {MEDICAL_DISCLAIMER} For educational purposes only.
          </p>
        </article>
      </main>
    </div>
  );
}
