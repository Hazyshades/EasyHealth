"use client";

import { StatusChip } from "@/components/ui/status-chip";
import type { ObservationChangeEntry } from "@/lib/documents/observation-change-history";

/**
 * EH-121: a row's change history, collapsed by default.
 *
 * The review list is a bounded scroll container, so history must not push the
 * rows apart until a reviewer asks for it. Each entry states what moved, from
 * which value to which value, who moved it, when, and the recorded reason.
 */
export function ObservationChangeHistoryPanel({
  entries,
  loading = false,
}: {
  entries: readonly ObservationChangeEntry[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <p className="mt-2 text-xs text-[var(--eh-text-muted)]">
        Loading change history…
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="mt-2 text-xs text-[var(--eh-text-muted)]">
        No changes recorded for this result yet.
      </p>
    );
  }

  return (
    <details className="mt-2 border-t border-slate-100 pt-2">
      <summary className="cursor-pointer text-xs font-medium text-[var(--eh-text-secondary)]">
        Change history ({entries.length})
      </summary>
      <ol className="mt-2 space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="text-xs text-[var(--eh-text-secondary)]">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusChip variant={entry.variant}>{entry.headline}</StatusChip>
              <span className="text-[var(--eh-text-muted)]">
                {entry.actorLabel} · {formatChangeTime(entry.occurredAt)}
              </span>
              {entry.reconstructed ? (
                <span
                  className="text-[var(--eh-text-muted)]"
                  title="Reconstructed from existing records when change history was introduced."
                >
                  · reconstructed
                </span>
              ) : null}
            </div>
            {entry.fields.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {entry.fields.map((field) => (
                  <li key={field.field} className="leading-relaxed">
                    {field.label}:{" "}
                    <span className="text-[var(--eh-text-muted)]">
                      {field.from ?? "not set"}
                    </span>{" "}
                    → <span className="font-medium">{field.to ?? "not set"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {entry.reason ? (
              <p className="mt-1 leading-relaxed">Reason: {entry.reason}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * Audit timestamps are read alongside a document, so the calendar date matters
 * more than the elapsed time. `en-US` matches every other date in the app; the
 * product is EN-first and history must not flip language per browser.
 */
function formatChangeTime(occurredAt: string): string {
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) return occurredAt;
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
