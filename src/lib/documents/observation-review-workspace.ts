import type {
  MappingConfidenceBand,
  ResolverResult,
  VerificationStatus,
} from "@/lib/biomarkers";
import {
  measurementMappingGuidance,
  measurementMappingLabel,
} from "./biomarker-review-state";
import type { LaboratoryResolutionDetails } from "./incomplete-laboratory-outcomes";

/**
 * EH-117 split-view review workspace state model.
 *
 * Pure projection helpers shared by the document review UI and its regression
 * suite. The model deliberately keeps two independent axes visible for every
 * row — the resolver outcome (how far Registry 2.0 got) and the verification
 * state (who signed the mapping off) — and never promotes a candidate
 * measurement key into user-visible identity.
 */

export type ReviewRowSourceKind = "extracted" | "observation";

/**
 * Source-locator precision. EH-118 will add `"region"` once bounding boxes are
 * reliable; until then the workspace degrades to page-level provenance and,
 * when even the page is unknown, to document-level provenance.
 */
export type SourcePrecision = "region" | "page" | "document";

export type ReviewChipVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

export type ReviewRowRawEvidence = Readonly<{
  /** Name as reported by the document, never a candidate display name. */
  displayName: string;
  /** Formatted reported value with its reported unit, when available. */
  value: string | null;
  /** Verbatim value text from the document when it differs from `value`. */
  rawValueText: string | null;
  /** Reported reference range, verbatim. */
  referenceText: string | null;
  /** Explicitly stated specimen; null when the report did not state one. */
  specimen: string | null;
  /** Explicitly stated modifier; null when the report did not state one. */
  modifier: string | null;
  /** Explicitly stated laboratory method (EH-113); null when unavailable. */
  method: string | null;
  /** Extraction confidence in [0,1]; distinct from mapping confidence. */
  extractionConfidence: number | null;
}>;

export type ReviewRowSourceLocation = Readonly<{
  precision: SourcePrecision;
  page: number | null;
  snippet: string | null;
  /** Tester- and user-facing label, e.g. `Page 2` or `Source page not recorded`. */
  label: string;
}>;

export type ReviewRowMappingState = Readonly<{
  outcome: ResolverResult | null;
  /** EH-112 wording; null when the row carries no resolver outcome at all. */
  label: string | null;
  guidance: string | null;
  verificationStatus: VerificationStatus | null;
  verificationLabel: string;
  confidenceBand: MappingConfidenceBand | null;
  registryBindingReady: boolean;
  /**
   * True when the row can be preserved as raw evidence without choosing a
   * measurement. Drives the "accept without mapping" affordance.
   */
  acceptableAsRaw: boolean;
}>;

export type ReviewRow = Readonly<{
  id: string;
  sourceKind: ReviewRowSourceKind;
  /** Row is awaiting a review decision and may be selected for acceptance. */
  reviewable: boolean;
  /** Row has already been persisted as an observation. */
  accepted: boolean;
  rawEvidence: ReviewRowRawEvidence;
  source: ReviewRowSourceLocation;
  mapping: ReviewRowMappingState;
  resolutionDetails: LaboratoryResolutionDetails | null;
}>;

export type ReviewPageGroup = Readonly<{
  page: number | null;
  label: string;
  rows: readonly ReviewRow[];
}>;

export type ReviewRowsSummary = Readonly<{
  total: number;
  reviewable: number;
  resolved: number;
  incomplete: number;
  unverified: number;
  pagesWithRows: readonly number[];
}>;

const RESOLVER_RESULTS: Readonly<Record<ResolverResult, true>> = {
  resolved: true,
  ambiguous: true,
  partial: true,
  unmapped: true,
};

const CONFIDENCE_BANDS: Readonly<Record<MappingConfidenceBand, true>> = {
  high: true,
  medium: true,
  low: true,
};

const VERIFICATION_LABELS: Readonly<Record<VerificationStatus, string>> = {
  pending: "Not verified yet",
  auto_verified: "Verified automatically",
  user_verified: "Verified by you",
  manually_corrected: "Corrected by you",
};

const VERIFICATION_VARIANTS: Readonly<
  Record<VerificationStatus, ReviewChipVariant>
> = {
  pending: "neutral",
  auto_verified: "info",
  user_verified: "success",
  manually_corrected: "success",
};

const OUTCOME_VARIANTS: Readonly<Record<ResolverResult, ReviewChipVariant>> = {
  resolved: "success",
  partial: "info",
  ambiguous: "warning",
  unmapped: "neutral",
};

const REVIEWABLE_EXTRACTED_STATUSES: Readonly<Record<string, true>> = {
  needs_review: true,
  pending_review: true,
};

const UNSTATED_SPECIMEN: Readonly<Record<string, true>> = { unspecified: true };
const UNSTATED_MODIFIER: Readonly<Record<string, true>> = { none: true };
const NOTHING_UNSTATED: Readonly<Record<string, true>> = {};

export function isResolverResult(value: unknown): value is ResolverResult {
  return typeof value === "string" && value in RESOLVER_RESULTS;
}

function asVerificationStatus(value: unknown): VerificationStatus | null {
  if (typeof value !== "string") return null;
  return value in VERIFICATION_LABELS ? (value as VerificationStatus) : null;
}

function asConfidenceBand(value: unknown): MappingConfidenceBand | null {
  if (typeof value !== "string") return null;
  return value in CONFIDENCE_BANDS ? (value as MappingConfidenceBand) : null;
}

export function verificationStatusLabel(
  status: VerificationStatus | null | undefined,
): string {
  if (!status) return VERIFICATION_LABELS.pending;
  return VERIFICATION_LABELS[status];
}

export function verificationStatusVariant(
  status: VerificationStatus | null | undefined,
): ReviewChipVariant {
  if (!status) return VERIFICATION_VARIANTS.pending;
  return VERIFICATION_VARIANTS[status];
}

export function resolverOutcomeVariant(
  outcome: ResolverResult | null | undefined,
): ReviewChipVariant {
  if (!outcome) return "neutral";
  return OUTCOME_VARIANTS[outcome];
}

/**
 * Page-level provenance descriptor. EH-118 is not implemented, so no row can
 * report `"region"` precision yet; the contract exists so an overlay can be
 * layered in without reshaping the workspace.
 */
export function resolveSourceLocation(
  sourcePage: number | null | undefined,
  sourceText: string | null | undefined,
): ReviewRowSourceLocation {
  const page =
    typeof sourcePage === "number" &&
    Number.isFinite(sourcePage) &&
    sourcePage > 0
      ? Math.trunc(sourcePage)
      : null;
  const snippet =
    typeof sourceText === "string" && sourceText.trim().length > 0
      ? sourceText
      : null;
  return {
    precision: page === null ? "document" : "page",
    page,
    snippet,
    label: page === null ? "Source page not recorded" : `Page ${page}`,
  };
}

function statedAxis(
  value: string | null | undefined,
  unstated: Readonly<Record<string, true>>,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.toLowerCase() in unstated ? null : trimmed;
}

function formatReportedValue(
  numeric: number | string | null | undefined,
  text: string | null | undefined,
  unit: string | null | undefined,
): string | null {
  const unitSuffix =
    typeof unit === "string" && unit.trim().length > 0 ? ` ${unit.trim()}` : "";
  if (numeric !== null && numeric !== undefined && numeric !== "") {
    return `${numeric}${unitSuffix}`;
  }
  if (typeof text === "string" && text.trim().length > 0) {
    return `${text.trim()}${unitSuffix}`;
  }
  return null;
}

function buildMappingState(options: {
  outcome: ResolverResult | null;
  verificationStatus: VerificationStatus | null;
  confidenceBand: MappingConfidenceBand | null;
  registryBindingReady: boolean;
  reviewable: boolean;
}): ReviewRowMappingState {
  const { outcome, confidenceBand } = options;
  return {
    outcome,
    label: outcome
      ? measurementMappingLabel(outcome, confidenceBand ?? "low")
      : null,
    guidance: outcome ? measurementMappingGuidance(outcome) : null,
    verificationStatus: options.verificationStatus,
    verificationLabel: verificationStatusLabel(options.verificationStatus),
    confidenceBand,
    registryBindingReady: options.registryBindingReady,
    acceptableAsRaw:
      options.reviewable && outcome !== null && outcome !== "resolved",
  };
}

export type ExtractedReviewRowInput = {
  id: string;
  biomarker_name: string;
  raw_name?: string | null;
  value_numeric: number | null;
  value_text?: string | null;
  value_kind?: string | null;
  unit: string | null;
  raw_unit?: string | null;
  raw_value_text?: string | null;
  reference_range: string | null;
  raw_reference_range?: string | null;
  specimen?: string | null;
  modifier?: string | null;
  method?: string | null;
  confidence: number | null;
  source_page: number | null;
  source_text: string | null;
  status: string;
  normalization?: {
    result: ResolverResult;
    mappingConfidenceBand: MappingConfidenceBand;
    registryBindingReady: boolean;
    resolutionDetails: LaboratoryResolutionDetails;
    activeRevision: { verification_status: VerificationStatus } | null;
  } | null;
};

export function buildExtractedReviewRow(
  item: ExtractedReviewRowInput,
): ReviewRow {
  const reviewable = item.status in REVIEWABLE_EXTRACTED_STATUSES;
  const normalization = item.normalization ?? null;
  const numericValue =
    item.value_kind && item.value_kind !== "numeric" ? null : item.value_numeric;
  const value = formatReportedValue(
    numericValue,
    item.value_text,
    item.unit ?? item.raw_unit,
  );
  const rawValueText =
    typeof item.raw_value_text === "string" &&
    item.raw_value_text.trim().length > 0 &&
    item.raw_value_text.trim() !== value
      ? item.raw_value_text.trim()
      : null;

  return {
    id: item.id,
    sourceKind: "extracted",
    reviewable,
    accepted: item.status === "accepted" || item.status === "auto_accepted",
    rawEvidence: {
      displayName: item.raw_name?.trim() || item.biomarker_name,
      value,
      rawValueText,
      referenceText:
        item.raw_reference_range?.trim() || item.reference_range?.trim() || null,
      specimen: statedAxis(item.specimen, UNSTATED_SPECIMEN),
      modifier: statedAxis(item.modifier, UNSTATED_MODIFIER),
      method: statedAxis(item.method, NOTHING_UNSTATED),
      extractionConfidence: item.confidence,
    },
    source: resolveSourceLocation(item.source_page, item.source_text),
    mapping: buildMappingState({
      outcome: isResolverResult(normalization?.result)
        ? normalization.result
        : null,
      verificationStatus:
        asVerificationStatus(
          normalization?.resolutionDetails?.verificationStatus,
        ) ??
        asVerificationStatus(normalization?.activeRevision?.verification_status),
      confidenceBand: asConfidenceBand(normalization?.mappingConfidenceBand),
      registryBindingReady: normalization?.registryBindingReady === true,
      reviewable,
    }),
    resolutionDetails: normalization?.resolutionDetails ?? null,
  };
}

export type ObservationReviewRowInput = {
  id: string;
  name: string;
  raw_name?: string | null;
  value: number | string | null;
  value_kind?: string | null;
  value_text?: string | null;
  unit: string | null;
  raw_unit?: string | null;
  raw_value_text?: string | null;
  raw_reference_text?: string | null;
  ref_low?: number | string | null;
  ref_high?: number | string | null;
  specimen?: string | null;
  modifier?: string | null;
  confidence?: number | null;
  source_page?: number | null;
  source_text?: string | null;
  resolution_status?: string | null;
  resolver_result?: string | null;
  verification_status?: string | null;
  registry_binding_ready?: boolean;
  resolution_details?: LaboratoryResolutionDetails | null;
};

function observationReferenceText(
  item: ObservationReviewRowInput,
): string | null {
  const raw = item.raw_reference_text?.trim();
  if (raw) return raw;
  if (item.ref_low != null && item.ref_high != null) {
    return `${item.ref_low}–${item.ref_high}`;
  }
  return null;
}

export function buildObservationReviewRow(
  item: ObservationReviewRowInput,
): ReviewRow {
  const numericValue =
    item.value_kind && item.value_kind !== "numeric" ? null : item.value;
  const value = formatReportedValue(
    numericValue,
    item.value_text,
    item.unit ?? item.raw_unit,
  );
  const rawValueText =
    typeof item.raw_value_text === "string" &&
    item.raw_value_text.trim().length > 0 &&
    item.raw_value_text.trim() !== value
      ? item.raw_value_text.trim()
      : null;
  const reportedOutcome = item.resolver_result ?? item.resolution_status;
  const outcome = isResolverResult(reportedOutcome) ? reportedOutcome : null;

  return {
    id: item.id,
    sourceKind: "observation",
    reviewable: false,
    accepted: true,
    rawEvidence: {
      displayName: item.raw_name?.trim() || item.name,
      value,
      rawValueText,
      referenceText: observationReferenceText(item),
      specimen: statedAxis(item.specimen, UNSTATED_SPECIMEN),
      modifier: statedAxis(item.modifier, UNSTATED_MODIFIER),
      method: null,
      extractionConfidence: item.confidence ?? null,
    },
    source: resolveSourceLocation(item.source_page, item.source_text),
    mapping: buildMappingState({
      outcome,
      verificationStatus: asVerificationStatus(item.verification_status),
      confidenceBand: asConfidenceBand(
        item.resolution_details?.mappingConfidenceBand,
      ),
      registryBindingReady: item.registry_binding_ready === true,
      reviewable: false,
    }),
    resolutionDetails: item.resolution_details ?? null,
  };
}

/**
 * Groups rows by their source page so the list mirrors the document pane.
 * Pages are ascending; rows without a recorded page are collected last.
 */
export function groupReviewRowsByPage(
  rows: readonly ReviewRow[],
): readonly ReviewPageGroup[] {
  const byPage = new Map<number, ReviewRow[]>();
  const withoutPage: ReviewRow[] = [];

  for (const row of rows) {
    const page = row.source.page;
    if (page === null) {
      withoutPage.push(row);
      continue;
    }
    const bucket = byPage.get(page);
    if (bucket) bucket.push(row);
    else byPage.set(page, [row]);
  }

  const groups: ReviewPageGroup[] = [...byPage.keys()]
    .sort((a, b) => a - b)
    .map((page) => ({
      page,
      label: `Page ${page}`,
      rows: byPage.get(page)!,
    }));

  if (withoutPage.length > 0) {
    groups.push({
      page: null,
      label: "Source page not recorded",
      rows: withoutPage,
    });
  }

  return groups;
}

export function findReviewRow(
  rows: readonly ReviewRow[],
  rowId: string | null,
): ReviewRow | null {
  if (!rowId) return null;
  return rows.find((row) => row.id === rowId) ?? null;
}

/**
 * Document -> list synchronization. Keeps the current selection when it still
 * belongs to the visible page, otherwise selects the first row anchored to
 * that page. Rows without a recorded page never steal the selection.
 */
export function resolveSelectionForPage(
  rows: readonly ReviewRow[],
  page: number,
  selectedRowId: string | null,
): string | null {
  const selected = findReviewRow(rows, selectedRowId);
  if (selected && selected.source.page === page) return selected.id;
  const firstOnPage = rows.find((row) => row.source.page === page);
  if (firstOnPage) return firstOnPage.id;
  return selected ? selected.id : null;
}

/** List -> document synchronization for a row activated by the reviewer. */
export function resolveNavigationForRow(
  row: ReviewRow,
  currentPage: number,
): Readonly<{ page: number; snippet: string | null }> {
  return {
    page: row.source.page ?? currentPage,
    snippet: row.source.snippet,
  };
}

export function summarizeReviewRows(
  rows: readonly ReviewRow[],
): ReviewRowsSummary {
  let reviewable = 0;
  let resolved = 0;
  let incomplete = 0;
  let unverified = 0;
  const pages = new Set<number>();

  for (const row of rows) {
    if (row.reviewable) reviewable += 1;
    if (row.mapping.outcome === "resolved") resolved += 1;
    else if (row.mapping.outcome !== null) incomplete += 1;
    if (
      row.mapping.verificationStatus === null ||
      row.mapping.verificationStatus === "pending"
    ) {
      unverified += 1;
    }
    if (row.source.page !== null) pages.add(row.source.page);
  }

  return {
    total: rows.length,
    reviewable,
    resolved,
    incomplete,
    unverified,
    pagesWithRows: [...pages].sort((a, b) => a - b),
  };
}

/**
 * Reprocessing stays a document-level action for incomplete outcomes
 * (EH-112: no row-level reprocessing, no candidate key in the request).
 */
export function hasIncompleteOutcomes(rows: readonly ReviewRow[]): boolean {
  return rows.some(
    (row) => row.mapping.outcome !== null && row.mapping.outcome !== "resolved",
  );
}
