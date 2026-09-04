import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

export function KnowledgeHeader() {
  return (
    <header className="border-b border-[var(--eh-border)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--eh-text-primary)]">
              EasyHealth
            </span>
            <span className="block truncate text-xs text-[var(--eh-text-secondary)]">
              Knowledge Base
            </span>
          </span>
        </Link>

        <nav
          aria-label="Knowledge Base navigation"
          className="flex items-center gap-1 sm:gap-2"
        >
          <Link
            href="/knowledge"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--eh-text-secondary)] transition-colors hover:bg-[var(--eh-canvas-bg)] hover:text-[var(--eh-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
          >
            Browse
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--eh-brand)] transition-colors hover:bg-[var(--eh-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
          >
            <span className="hidden sm:inline">Your records</span>
            <span className="sm:hidden">Records</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </nav>
      </div>
    </header>
  );
}
