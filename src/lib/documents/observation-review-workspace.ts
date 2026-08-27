import type {
  IncompleteReasonClass,

  MappingConfidenceBand,
  ResolverResult,
  VerificationStatus,
} from "@/lib/biomarkers";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";
import type { MeasurementOverride } from "./observation-measurement-correction";
import { getMeasurementDefinition } from "@/lib/biomarkers";
import {
  measurementMappingGuidance,
  measurementMappingLabel,
} from "./biomarker-review-state";
import type { NormalizationActionAvailabilityMap } from "./normalization-review";
import {
  isRecordStatus,
  type RecordStatus,
} from "./observation-verification-workflow";
import type { LaboratoryResolutionDetails } from "./incomplete-laboratory-outcomes";
import { parseSourceRegion, sourceRegionCanRender, type SourceRegion } from "./source-region";

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
 * Source-locator precision. `"region"` means the extraction was grounded to a
 * rectangle on the page and can be highlighted; `"page"` means only the page is
 * known; `"document"` means not even the page was recorded.
 */
export type SourcePrecision = "region" | "page" | "document";

export type ReviewChipVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";
export type ReviewRowCorrectedMeasurement = Readonly<{
  /** Effective measurement after applying the active human restatement. */
  value: string | null;
  /** Corrected unit, when the reviewer restated it. */
  unit: string | null;
  /** Corrected reference bounds in compact display form. */
  referenceText: string | null;
  /** Corrected report date; null when the date was not restated. */
  observedAt: string | null;
}>;

export type ReviewRowRawEvidence = Readonly<{
  /** Name as reported by the document, never a candidate display name. */
  displayName: string;
  /**
   * Canonical English Registry measurement name when the row is concretely
   * resolved; null for incomplete outcomes so no candidate is implied.
   */
  canonicalEnglishName: string | null;
  /** Formatted reported value with its reported unit, when available. */
  value: string | null;
  /** Verbatim value text from the document when it differs from `value`. */
  rawValueText: string | null;
  /** Reported reference range, verbatim. */
  referenceText: string | null;
  /** Effective corrected measurement, kept separate from raw evidence. */
  correctedMeasurement: ReviewRowCorrectedMeasurement | null;
  /** Explicitly stated specimen; null when the report did not state one. */
  specimen: string | null;
  /** Explicitly stated modifier; null when the report did not state one. */
  modifier: string | null;
  /** Explicitly stated laboratory method (EH-113); null when unavailable. */
  method: string | null;
  /** Extraction confidence in [0,1]; distinct from mapping confidence. */
  extractionConfidence: number | null;
  /** Day-precision collected date from the extracted row, when present. */
  collectedAt: string | null;
}>;

export type ReviewRowSourceLocation = Readonly<{
  precision: SourcePrecision;
  page: number | null;
  snippet: string | null;
  /** EH-118 highlight geometry; null whenever the region could not be grounded. */
  region: SourceRegion | null;
  /** Tester- and user-facing label, e.g. `Page 2` or `Source page not recorded`. */
  label: string;
}>;

export type ReviewRowMappingState = Readonly<{
  outcome: ResolverResult | null;
  /** EH-112 wording; null when the row carries no resolver outcome at all. */
  label: string | null;
  guidance: string | null;
  /** #114: which of the four reasons the guidance is speaking to; null when resolved. */
  incompleteReason: IncompleteReasonClass | null;
  verificationStatus: VerificationStatus | null;
  verificationLabel: string;
  confidenceBand: MappingConfidenceBand | null;
  registryBindingReady: boolean;
  recordStatus: RecordStatus;
  recordStatusLabel: string;
  recordStatusVariant: ReviewChipVariant;
  /** True when the row can be preserved as raw evidence without choosing a measurement. */
  acceptableAsRaw: boolean;
}>;

export type ReviewRow = Readonly<{
  id: string;
  sourceKind: ReviewRowSourceKind;
  /** Row is awaiting a review decision and may be selected for acceptance. */
  reviewable: boolean;
  /** Row has already been persisted as an observation. */
  accepted: boolean;
  /** True when the active revision carries a human measurement restatement. */
  userCorrected: boolean;
  sourceIsCurrent: boolean;
  lifecycleReasonCode: string | null;
  supersededAt: string | null;
  supersededByProcessingAttemptId: string | null;
  actionAvailability: NormalizationActionAvailabilityMap | null;
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
  /**
   * #114: `incomplete` split by who can resolve it. The three sum to
   * `incomplete`; the total is kept so the old figure stays available.
   */
  awaitingDocument: number;
  awaitingCatalog: number;
  conflicted: number;
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

const RECORD_STATUS_LABELS: Readonly<Record<RecordStatus, string>> = {
  active: "Active",
  rejected: "Rejected",
  superseded: "Superseded",
};

const RECORD_STATUS_VARIANTS: Readonly<
  Record<RecordStatus, ReviewChipVariant>
> = {
  active: "success",
  rejected: "error",
  superseded: "neutral",
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

function asRecordStatus(value: unknown, isCurrent?: boolean | null): RecordStatus {
  if (isRecordStatus(value)) return value;
  return isCurrent === false ? "superseded" : "active";
}

export function recordStatusLabel(status: RecordStatus | null | undefined): string {
  return status ? RECORD_STATUS_LABELS[status] : RECORD_STATUS_LABELS.active;
}

export function recordStatusVariant(
  status: RecordStatus | null | undefined,
): ReviewChipVariant {
  return status ? RECORD_STATUS_VARIANTS[status] : RECORD_STATUS_VARIANTS.active;
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
 * Provenance descriptor for one review row. A region is only reported when it
 * satisfies the EH-118 source-region contract and belongs to the recorded page;
 * anything else degrades to page-level and then to document-level provenance,
 * so the pane never draws a rectangle it cannot stand behind.
 */
export function resolveSourceLocation(
  sourcePage: number | null | undefined,
  sourceText: string | null | undefined,
  boundingBox?: unknown,
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
  const candidate = parseSourceRegion(boundingBox);
  const region = sourceRegionCanRender(candidate, page) ? candidate : null;
  return {
    precision: page === null ? "document" : region ? "region" : "page",
    page,
    snippet,
    region,
    label: page === null ? "Source page not recorded" : `Page ${page}`,
  };
}

/**
 * Returns a stated axis as user-facing text, or null when the value is absent
 * or is the storage default that means "the report did not say".
 *
 * Axis values are stored as snake_case enum tokens (`whole_blood`), which must
 * never reach the reviewer verbatim.
 */
function statedAxis(
  value: string | null | undefined,
  unstated: Readonly<Record<string, true>>,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const token = trimmed.toLowerCase();
  if (token in unstated) return null;
  const words = token.replaceAll("_", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
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
  recordStatus: RecordStatus;
  reviewable: boolean;
  incompleteReason: IncompleteReasonClass | null;
  missingAxes: readonly string[];
}): ReviewRowMappingState {
  const { outcome, confidenceBand } = options;
  return {
    outcome,
    label: outcome
      ? measurementMappingLabel(outcome, confidenceBand ?? "low")
      : null,
    guidance: outcome
      ? measurementMappingGuidance(outcome, {
          incompleteReason: options.incompleteReason,
          missingAxes: options.missingAxes,
        })
      : null,
    incompleteReason: options.incompleteReason,
    verificationStatus: options.verificationStatus,
    verificationLabel: verificationStatusLabel(options.verificationStatus),
    confidenceBand,
    registryBindingReady: options.registryBindingReady,
    recordStatus: options.recordStatus,
    recordStatusLabel: recordStatusLabel(options.recordStatus),
    recordStatusVariant: recordStatusVariant(options.recordStatus),
    acceptableAsRaw:
      options.reviewable && outcome !== null && outcome !== "resolved",
  };
}

function buildCorrectedMeasurement(
  item: ExtractedReviewRowInput,
  override: MeasurementOverride | null,
): ReviewRowCorrectedMeasurement | null {
  if (!override) return null;
  const baseNumeric =
    item.value_kind && item.value_kind !== "numeric" ? null : item.value_numeric;
  const baseText = item.value_text ?? null;
  const baseKind =
    item.value_kind === "numeric" ||
    item.value_kind === "qualitative" ||
    item.value_kind === "ordinal" ||
    item.value_kind === "text"
      ? item.value_kind
      : baseNumeric == null
        ? "text"
        : "numeric";
  const valueKind = override.value_kind ?? baseKind;
  const numericValue =
    "value" in override ? override.value ?? null : baseNumeric;
  const valueText = "value_text" in override ? override.value_text ?? null : baseText;
  const unit =
    "unit" in override ? override.unit ?? null : item.unit ?? item.raw_unit ?? null;
  const { ref_low: baseRefLow, ref_high: baseRefHigh } = parseReferenceRange(
    item.reference_range ?? item.raw_reference_range ?? null,
  );
  const refLow = "ref_low" in override ? override.ref_low ?? null : baseRefLow;
  const refHigh = "ref_high" in override ? override.ref_high ?? null : baseRefHigh;
  const referenceText =
    refLow === null && refHigh === null
      ? null
      : `${refLow ?? "—"} - ${refHigh ?? "—"}`;
  return {
    value: formatReportedValue(
      valueKind === "numeric" ? numericValue : null,
      valueText,
      unit,
    ),
    unit: typeof unit === "string" && unit.trim() ? unit.trim() : null,
    referenceText,
    observedAt: "observed_at" in override ? override.observed_at ?? null : null,
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
  collected_at?: string | null;
  confidence: number | null;
  source_page: number | null;
  source_text: string | null;
  bounding_box?: unknown;
  status: string;
  record_status?: string | null;
  lifecycle_reason_code?: string | null;
  superseded_at?: string | null;
  superseded_by_processing_attempt_id?: string | null;
  is_current?: boolean | null;
  measurement_definition_key?: string | null;
  normalization?: {
    result: ResolverResult;
    mappingConfidenceBand: MappingConfidenceBand;
    registryBindingReady: boolean;
    resolutionDetails: LaboratoryResolutionDetails;
    recordStatus?: RecordStatus;
    sourceIsCurrent?: boolean;
    lifecycleReasonCode?: string | null;
    supersededAt?: string | null;
    supersededByProcessingAttemptId?: string | null;
    actionAvailability?: NormalizationActionAvailabilityMap;
    activeRevision: {
      verification_status: VerificationStatus;
      measurement_override?: MeasurementOverride | null;
    } | null;
    candidateDefinitionKey?: string | null;
  } | null;
};

export function buildExtractedReviewRow(
  item: ExtractedReviewRowInput,
): ReviewRow {
  const normalization = item.normalization ?? null;
  const recordStatus = normalization?.recordStatus ??
    asRecordStatus(item.record_status, item.is_current);
  const sourceIsCurrent =
    normalization?.sourceIsCurrent ??
    (recordStatus === "active" && item.is_current !== false);
  const reviewable =
    sourceIsCurrent && item.status in REVIEWABLE_EXTRACTED_STATUSES;
  const measurementOverride =
    normalization?.activeRevision?.measurement_override ?? null;
  const correctedMeasurement = buildCorrectedMeasurement(
    item,
    measurementOverride,
  );
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

  const outcome = isResolverResult(normalization?.result)
    ? normalization.result
    : null;
  const definitionKey =
    outcome === "resolved"
      ? (normalization?.candidateDefinitionKey ??
        item.measurement_definition_key ??
        null)
      : null;
  const canonicalEnglishName =
    definitionKey != null
      ? (getMeasurementDefinition(definitionKey)?.displayName ?? null)
      : null;

  return {
    id: item.id,
    sourceKind: "extracted",
    reviewable,
    accepted: item.status === "accepted" || item.status === "auto_accepted",
    userCorrected: measurementOverride !== null,
    sourceIsCurrent,
    lifecycleReasonCode:
      normalization?.lifecycleReasonCode ?? item.lifecycle_reason_code ?? null,
    supersededAt: normalization?.supersededAt ?? item.superseded_at ?? null,
    supersededByProcessingAttemptId:
      normalization?.supersededByProcessingAttemptId ??
      item.superseded_by_processing_attempt_id ??
      null,
    actionAvailability: normalization?.actionAvailability ?? null,
    rawEvidence: {
      displayName: item.raw_name?.trim() || item.biomarker_name,
      canonicalEnglishName,
      value,
      rawValueText,
      referenceText:
        item.raw_reference_range?.trim() || item.reference_range?.trim() || null,
      correctedMeasurement,
      specimen: statedAxis(item.specimen, UNSTATED_SPECIMEN),
      modifier: statedAxis(item.modifier, UNSTATED_MODIFIER),
      method: statedAxis(item.method, NOTHING_UNSTATED),
      extractionConfidence: item.confidence,
      collectedAt: item.collected_at?.trim() || null,
    },
    source: resolveSourceLocation(item.source_page, item.source_text, item.bounding_box),
    mapping: buildMappingState({
      outcome,
      verificationStatus:
        asVerificationStatus(
          normalization?.resolutionDetails?.verificationStatus,
        ) ??
        asVerificationStatus(normalization?.activeRevision?.verification_status),
      confidenceBand: asConfidenceBand(normalization?.mappingConfidenceBand),
      registryBindingReady: normalization?.registryBindingReady === true,
      recordStatus,
      reviewable,
      incompleteReason: normalization?.resolutionDetails?.incompleteReason ?? null,
      missingAxes: normalization?.resolutionDetails?.minimalMissingAxes ?? [],
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
  bounding_box?: unknown;
  resolution_status?: string | null;
  resolver_result?: string | null;
  verification_status?: string | null;
  record_status?: string | null;
  lifecycle_reason_code?: string | null;
  superseded_at?: string | null;
  superseded_by_processing_attempt_id?: string | null;
  is_current?: boolean | null;
  registry_binding_ready?: boolean;
  measurement_definition_key?: string | null;
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
  const definitionKey =
    outcome === "resolved" ? (item.measurement_definition_key ?? null) : null;
  const canonicalEnglishName =
    definitionKey != null
      ? (getMeasurementDefinition(definitionKey)?.displayName ?? null)
      : null;
  const recordStatus = asRecordStatus(item.record_status, item.is_current);
  const sourceIsCurrent =
    recordStatus === "active" && item.is_current !== false;
  return {
    id: item.id,
    sourceKind: "observation",
    reviewable: false,
    accepted: true,
    userCorrected: false,
    sourceIsCurrent,
    lifecycleReasonCode: item.lifecycle_reason_code ?? null,
    supersededAt: item.superseded_at ?? null,
    supersededByProcessingAttemptId:
      item.superseded_by_processing_attempt_id ?? null,
    actionAvailability: null,
    rawEvidence: {
      displayName: item.raw_name?.trim() || item.name,
      canonicalEnglishName,
      value,
      rawValueText,
      referenceText: observationReferenceText(item),
      correctedMeasurement: null,
      specimen: statedAxis(item.specimen, UNSTATED_SPECIMEN),
      modifier: statedAxis(item.modifier, UNSTATED_MODIFIER),
      method: null,
      extractionConfidence: item.confidence ?? null,
      collectedAt: null,
    },
    source: resolveSourceLocation(item.source_page, item.source_text, item.bounding_box),
    mapping: buildMappingState({
      outcome,
      verificationStatus: asVerificationStatus(item.verification_status),
      confidenceBand: asConfidenceBand(
        item.resolution_details?.mappingConfidenceBand,
      ),
      registryBindingReady: item.registry_binding_ready === true,
      recordStatus,
      reviewable: false,
      incompleteReason: item.resolution_details?.incompleteReason ?? null,
      missingAxes: item.resolution_details?.minimalMissingAxes ?? [],
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

export function summarizeReviewRows(
  rows: readonly ReviewRow[],
): ReviewRowsSummary {
  let reviewable = 0;
  let resolved = 0;
  let incomplete = 0;
  // #114: `incomplete` on its own merged work owed by the product with work owed
  // by the document, so a reviewer read one number and could not tell which.
  let awaitingDocument = 0;
  let awaitingCatalog = 0;
  let conflicted = 0;
  let unverified = 0;
  const pages = new Set<number>();

  for (const row of rows) {
    if (row.reviewable) reviewable += 1;
    if (row.mapping.outcome === "resolved") resolved += 1;
    else if (row.mapping.outcome !== null) {
      incomplete += 1;
      switch (row.mapping.incompleteReason) {
        case "definition_not_reviewed":
          awaitingCatalog += 1;
          break;
        case "unit_or_value_conflict":
          conflicted += 1;
          break;
        default:
          // `axis_not_stated`, `no_candidate` and an unclassified row all wait on
          // the document. Defaulting here keeps the three buckets summing to
          // `incomplete` even for a legacy row that carries no reason.
          awaitingDocument += 1;
      }
    }
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
    awaitingDocument,
    awaitingCatalog,
    conflicted,
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
    (row) =>
      row.mapping.outcome !== null &&
      row.mapping.outcome !== "resolved" &&
      // #114: reprocessing re-runs the resolver against the deployed catalog
      // release. A row held back only by definition maturity will return the
      // same verdict, so offering reprocess as the remedy is the same false
      // affordance this change removes from the copy.
      row.mapping.incompleteReason !== "definition_not_reviewed",
  );
}
