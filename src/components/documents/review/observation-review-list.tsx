"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type {
  ReviewPageGroup,
  ReviewRow,
} from "@/lib/documents/observation-review-workspace";

/**
 * Page-grouped observation list. Groups mirror the document pane so the
 * reviewer can see which results belong to the page in view, and the selected
 * row is scrolled into view whenever selection changes from the document side.
 */
export function ObservationReviewList({
  groups,
  currentPage,
  selectedRowId,
  onSelectPage,
  renderRow,
}: {
  groups: readonly ReviewPageGroup[];
  currentPage: number;
  selectedRowId: string | null;
  onSelectPage: (page: number) => void;
  renderRow: (row: ReviewRow) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedRowId) return;
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector(
      `[data-review-row-id="${CSS.escape(selectedRowId)}"]`,
    );
    target?.scrollIntoView({ block: "nearest" });
  }, [selectedRowId]);

  return (
    <div
      ref={containerRef}
      className="max-h-[min(60vh,560px)] space-y-4 overflow-y-auto pr-1"
    >
      {groups.map((group) => {
        const isCurrent = group.page !== null && group.page === currentPage;
        return (
          <section key={group.page ?? "unlocated"} aria-label={group.label}>
            <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center justify-between gap-2 bg-white/95 px-1 py-1 backdrop-blur">
              <h3
                className={`text-xs font-semibold uppercase tracking-[0.06em] ${
                  isCurrent
                    ? "text-[var(--eh-brand)]"
                    : "text-[var(--eh-text-muted)]"
                }`}
              >
                {group.label}
                <span className="ml-2 font-normal normal-case tracking-normal text-[var(--eh-text-muted)]">
                  {group.rows.length}{" "}
                  {group.rows.length === 1 ? "result" : "results"}
                </span>
              </h3>
              {group.page !== null && !isCurrent ? (
                <button
                  type="button"
                  onClick={() => onSelectPage(group.page!)}
                  className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs text-[var(--eh-brand)] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                >
                  Show page
                </button>
              ) : null}
            </div>
            <ul className="space-y-2">{group.rows.map(renderRow)}</ul>
          </section>
        );
      })}
    </div>
  );
}
