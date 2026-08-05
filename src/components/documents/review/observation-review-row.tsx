"use client";

import type { ReactNode } from "react";
import type { ReviewRow } from "@/lib/documents/observation-review-workspace";
import { ReviewStateChips } from "./review-status-chips";

const SNIPPET_PREVIEW_LENGTH = 90;

/**
 * One reviewable result. Raw document evidence is rendered first and is never
 * replaced by a candidate display name, converted value or inferred axis
 * (EH-112). Mapping explanation follows, and everything technical stays behind
 * the progressive-disclosure slot.
 */
export function ObservationReviewRow({
  row,
  selected,
  selection,
  onActivate,
  technicalDetails,
}: {
  row: ReviewRow;
  selected: boolean;
  selection?: { checked: boolean; onChange: (next: boolean) => void };
  onActivate: (row: ReviewRow) => void;
  technicalDetails?: ReactNode;
}) {
  const { rawEvidence, source, mapping } = row;
  const snippet = source.snippet
    ? `${source.snippet.slice(0, SNIPPET_PREVIEW_LENGTH)}${source.snippet.length > SNIPPET_PREVIEW_LENGTH ? "…" : ""}`
    : null;

  return (
    <li
      data-review-row-id={row.id}
      aria-current={selected ? "true" : undefined}
      className={`rounded-xl border bg-white p-3 transition-colors ${
        selected
          ? "border-[var(--eh-brand)] bg-[var(--eh-brand-soft)]"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-2">
        {selection ? (
          <input
            type="checkbox"
            checked={selection.checked}
            onChange={(event) => selection.onChange(event.target.checked)}
            className="mt-1 shrink-0"
            aria-label={`Select ${rawEvidence.displayName} for acceptance`}
          />
        ) : null}
        <button
          type="button"
          onClick={() => onActivate(row)}
          className="min-w-0 flex-1 rounded-lg text-left transition hover:text-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
        >
          <p className="font-medium text-[var(--eh-text-primary)]">
            {rawEvidence.displayName}
          </p>
          <p className="text-sm text-[var(--eh-text-secondary)]">
            {rawEvidence.value ?? rawEvidence.rawValueText ?? "—"}
            {rawEvidence.referenceText
              ? ` · ref ${rawEvidence.referenceText}`
              : ""}
          </p>
          {rawEvidence.rawValueText && rawEvidence.value ? (
            <p className="mt-0.5 text-xs text-[var(--eh-text-muted)]">
              Reported as “{rawEvidence.rawValueText}”
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
            <span>{source.label}</span>
            {rawEvidence.specimen ? ` · ${rawEvidence.specimen}` : ""}
            {rawEvidence.modifier ? ` · ${rawEvidence.modifier}` : ""}
            {rawEvidence.method ? ` · ${rawEvidence.method}` : ""}
            {rawEvidence.extractionConfidence != null
              ? ` · ${Math.round(rawEvidence.extractionConfidence * 100)}% extraction confidence`
              : ""}
            {row.accepted ? " · stored" : ""}
          </p>
          {snippet ? (
            <p className="mt-1 text-xs italic text-[var(--eh-text-muted)]">
              “{snippet}”
            </p>
          ) : null}
        </button>
      </div>

      <ReviewStateChips mapping={mapping} />

      {mapping.guidance ? (
        <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-[var(--eh-text-secondary)]">
          <p className="leading-relaxed">{mapping.guidance}</p>
          {mapping.acceptableAsRaw ? (
            <p className="mt-1 leading-relaxed text-[var(--eh-text-muted)]">
              You can accept this result as reported. Mapping is optional and is
              never required to keep the value.
            </p>
          ) : null}
          {technicalDetails}
        </div>
      ) : (
        technicalDetails
      )}
    </li>
  );
}
