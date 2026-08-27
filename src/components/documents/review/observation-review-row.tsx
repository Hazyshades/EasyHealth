"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { ReviewRow } from "@/lib/documents/observation-review-workspace";
import { ReviewStateChips } from "./review-status-chips";

const SNIPPET_PREVIEW_LENGTH = 90;
const PREVIEW_ENTER_DELAY_MS = 100;

const LIFECYCLE_REASON_LABELS: Readonly<Record<string, string>> = {
  incorrect_extraction: "The result was extracted incorrectly",
  duplicate_source: "The result is a duplicate source",
  wrong_document: "The result belongs to another document",
  privacy_request: "Removed at the owner's request",
  other: "Other allowed reason",
  document_reprocessed: "Document reprocessed",
  catalog_reprocessed: "Registry reprocessed",
  verification_reversed: "Verification reversed by the owner",
  protected_human_decision: "Protected human decision",
  retryable_failure: "Retryable processing issue",
  automatic_quality_gate: "Automatic verification quality gate",
};

function lifecycleReasonLabel(reasonCode: string | null): string | null {
  if (!reasonCode) return null;
  return LIFECYCLE_REASON_LABELS[reasonCode] ?? "Lifecycle reason recorded";
}

function lifecycleDate(value: string | null): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/**
 * One reviewable result. Raw document evidence is rendered first and is never
 * replaced by a candidate display name, converted value or inferred axis.
 * Hover/focus only sends ephemeral preview intent; explicit activation pins it.
 */
export function ObservationReviewRow({
  row,
  selected,
  selection,
  onActivate,
  onPreviewStart,
  onPreviewEnd,
  technicalDetails,
  history,
  correction,
  rejection,
  batchVerification,
}: {
  row: ReviewRow;
  selected: boolean;
  selection?: { checked: boolean; onChange: (next: boolean) => void };
  batchVerification?: {
    eligible: boolean;
    checked?: boolean;
    reason?: string;
    onChange?: (next: boolean) => void;
  };
  onActivate: (row: ReviewRow) => void;
  onPreviewStart?: (row: ReviewRow) => void;
  onPreviewEnd?: (row: ReviewRow) => void;
  technicalDetails?: ReactNode;
  history?: ReactNode;
  correction?: ReactNode;
  rejection?: ReactNode;
}) {
  const { rawEvidence, source, mapping } = row;
  const previewTimerRef = useRef<number>(0);
  const isHistorical = mapping.recordStatus !== "active" || !row.sourceIsCurrent;
  const snippet = source.snippet
    ? `${source.snippet.slice(0, SNIPPET_PREVIEW_LENGTH)}${source.snippet.length > SNIPPET_PREVIEW_LENGTH ? "…" : ""}`
    : null;
  const reasonLabel = lifecycleReasonLabel(row.lifecycleReasonCode);
  const supersededDate = lifecycleDate(row.supersededAt);
  const sourceDescriptionId = `review-row-source-${row.id}`;

  function clearPreviewTimer() {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = 0;
    }

  function beginPreview() {
    clearPreviewTimer();
    if (!onPreviewStart) return;
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = 0;
      onPreviewStart(row);
    }, PREVIEW_ENTER_DELAY_MS);
  }

  function endPreview() {
    clearPreviewTimer();
    onPreviewEnd?.(row);
  }

  useEffect(
    () => () => {
      window.clearTimeout(previewTimerRef.current);
    },
    [row.id],
  );

  return (
    <li
      data-review-row-id={row.id}
      data-review-row-read-only={isHistorical ? "true" : undefined}
      aria-current={selected ? "true" : undefined}
      className={`rounded-xl border p-3 transition-colors ${
        selected
          ? "border-[var(--eh-brand)] bg-[var(--eh-brand-soft)]"
          : isHistorical
            ? "border-slate-200 bg-slate-50/70"
            : "border-slate-200 bg-white"
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
          onMouseEnter={beginPreview}
          onMouseLeave={endPreview}
          onFocus={beginPreview}
          onBlur={endPreview}
          aria-label={`${isHistorical ? "View historical evidence for" : "Review"} ${rawEvidence.displayName}`}
          aria-describedby={sourceDescriptionId}
          className="min-w-0 flex-1 rounded-lg text-left transition hover:text-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
        >
          <p className="font-medium text-[var(--eh-text-primary)]">
            {rawEvidence.displayName}
          </p>
          {rawEvidence.canonicalEnglishName &&
          rawEvidence.canonicalEnglishName !== rawEvidence.displayName ? (
            <p className="text-xs text-[var(--eh-text-muted)]">
              Canonical: {rawEvidence.canonicalEnglishName}
            </p>
          ) : null}
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
          {rawEvidence.correctedMeasurement ? (
            <p className="mt-1 text-xs text-[var(--eh-text-secondary)]">
              Corrected to{" "}
              <span className="font-medium">
                {rawEvidence.correctedMeasurement.value ??
                  rawEvidence.correctedMeasurement.unit ??
                  "—"}
              </span>
              {rawEvidence.correctedMeasurement.referenceText
                ? ` · ref ${rawEvidence.correctedMeasurement.referenceText}`
                : ""}
              {rawEvidence.correctedMeasurement.observedAt
                ? ` · date ${rawEvidence.correctedMeasurement.observedAt}`
                : ""}
              {" · raw extraction unchanged"}
            </p>
          ) : null}
          <p
            id={sourceDescriptionId}
            className="mt-1 text-xs text-[var(--eh-text-muted)]"
          >
            <span>{source.label}</span>
            {source.precision === "page" ? " · page only" : ""}
            {rawEvidence.specimen ? ` · ${rawEvidence.specimen}` : ""}
            {rawEvidence.modifier ? ` · ${rawEvidence.modifier}` : ""}
            {rawEvidence.method ? ` · ${rawEvidence.method}` : ""}
            {rawEvidence.collectedAt ? ` · collected ${rawEvidence.collectedAt}` : ""}
            {rawEvidence.extractionConfidence != null
              ? ` · ${Math.round(rawEvidence.extractionConfidence * 100)}% extraction confidence`
              : ""}
            {row.userCorrected ? " · corrected by you" : ""}
            {row.accepted ? " · stored" : ""}
          </p>
          {row.mapping.recordStatus === "superseded" ? (
            <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
              Historical evidence · replaced during reprocessing
              {supersededDate ? ` · replacement recorded ${supersededDate}` : ""}
              {row.supersededByProcessingAttemptId
                ? " · replacement processing attempt recorded"
                : ""}
              {reasonLabel ? ` · ${reasonLabel}` : ""}
            </p>
          ) : row.mapping.recordStatus === "rejected" ? (
            <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
              Rejected source · retained for audit history
              {reasonLabel ? ` · ${reasonLabel}` : ""}
            </p>
          ) : null}
          {snippet ? (
            <p className="mt-1 text-xs italic text-[var(--eh-text-muted)]">
              “{snippet}”
            </p>
          ) : null}
        </button>
      </div>
      {correction}
      {rejection}

      <ReviewStateChips mapping={mapping} />
      {batchVerification ? (
        <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-[var(--eh-text-secondary)]">
          {batchVerification.eligible && batchVerification.onChange ? (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(batchVerification.checked)}
                onChange={(event) => batchVerification.onChange?.(event.target.checked)}
                aria-label={`Select ${rawEvidence.displayName} for batch verification`}
              />
              Verify with eligible exact matches
            </label>
          ) : (
            <>Individual review required: {batchVerification.reason}</>
          )}
        </div>
      ) : null}

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
          {history}
        </div>
      ) : (
        <>
          {technicalDetails}
          {history}
        </>
      )}
    </li>
  );
}
