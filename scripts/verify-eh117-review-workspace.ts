import assert from "node:assert/strict";
import {
  measurementMappingGuidance,
  measurementMappingLabel,
} from "../src/lib/documents/biomarker-review-state";
import {
  buildExtractedReviewRow,
  buildObservationReviewRow,
  findReviewRow,
  groupReviewRowsByPage,
  hasIncompleteOutcomes,
  resolveSelectionForPage,
  resolveSourceLocation,
  resolverOutcomeVariant,
  summarizeReviewRows,
  verificationStatusLabel,
  verificationStatusVariant,
  type ExtractedReviewRowInput,
  type ObservationReviewRowInput,
} from "../src/lib/documents/observation-review-workspace";
import type { LaboratoryResolutionDetails } from "../src/lib/documents/incomplete-laboratory-outcomes";
import type {
  ClinicalCompatibilityAxis,
  MappingConfidenceBand,
  IncompleteReasonClass,
  ResolutionReasonCode,
  ResolverResult,
  VerificationStatus,
} from "../src/lib/biomarkers";

function resolutionDetails(options: {
  outcome: ResolverResult;
  verificationStatus: VerificationStatus | null;
  band: MappingConfidenceBand | null;
  missingAxes?: readonly ClinicalCompatibilityAxis[];
  conflictCodes?: readonly ResolutionReasonCode[];
  candidateCount?: number;
  incompleteReason?: IncompleteReasonClass | null;
}): LaboratoryResolutionDetails {
  return {
    source: "active_revision",
    outcome: options.outcome,
    verificationStatus: options.verificationStatus,
    mappingConfidence: 0.42,
    mappingConfidenceBand: options.band,
    missingAxes: options.missingAxes ?? [],
    conflictCodes: options.conflictCodes ?? [],
    supportCodes: [],
    candidateCount: options.candidateCount ?? 0,
    incompleteReason:
      options.incompleteReason ??
      (options.outcome === null || options.outcome === "resolved" ? null : "axis_not_stated"),
    versions: {
      catalog: "2026-07-20.0",
      resolver: "5",
      normalization: "4",
      trace: 1,
      compatibilityPolicy: "1",
    },
    eligibility: {
      trendEligible: options.outcome === "resolved",
      conversionEligible: options.outcome === "resolved",
      reportEligible: options.outcome === "resolved",
      structuredContextEligible: options.outcome === "resolved",
      assessmentEligible: options.outcome === "resolved",
      exclusions: {
        trend: null,
        conversion: null,
        report: null,
        structuredContext: null,
        assessment: null,
      },
    },
  };
}

function extractedFixture(
  overrides: Partial<ExtractedReviewRowInput> = {},
): ExtractedReviewRowInput {
  return {
    id: "extracted-1",
    biomarker_name: "Alanine aminotransferase",
    raw_name: "ALT (SGPT)",
    value_numeric: 31,
    value_text: null,
    value_kind: "numeric",
    unit: "U/L",
    raw_unit: "U/L",
    raw_value_text: "31",
    reference_range: "0-41",
    raw_reference_range: "0 - 41",
    specimen: "serum",
    modifier: "none",
    method: null,
    confidence: 0.94,
    source_page: 2,
    source_text: "ALT (SGPT) 31 U/L (0 - 41)",
    status: "needs_review",
    normalization: {
      result: "resolved",
      mappingConfidenceBand: "high",
      registryBindingReady: true,
      resolutionDetails: resolutionDetails({
        outcome: "resolved",
        verificationStatus: "auto_verified",
        band: "high",
      }),
      activeRevision: { verification_status: "auto_verified" },
    },
    ...overrides,
  };
}

function observationFixture(
  overrides: Partial<ObservationReviewRowInput> = {},
): ObservationReviewRowInput {
  return {
    id: "observation-1",
    name: "Glucose",
    raw_name: "GLU",
    value: 90,
    value_kind: "numeric",
    value_text: null,
    unit: "mg/dL",
    raw_unit: "mg/dL",
    raw_value_text: "90",
    raw_reference_text: "70 - 99",
    ref_low: 70,
    ref_high: 99,
    specimen: "unspecified",
    modifier: "none",
    confidence: 0.81,
    source_page: 1,
    source_text: "GLU 90 mg/dL",
    resolution_status: "partial",
    resolver_result: "partial",
    verification_status: "pending",
    registry_binding_ready: false,
    resolution_details: resolutionDetails({
      outcome: "partial",
      verificationStatus: "pending",
      band: "low",
      missingAxes: ["specimen"],
      candidateCount: 3,
    }),
    ...overrides,
  };
}

// --- Source provenance: page fallback, no bounding-box precision (EH-118 deferred) ---

const pageLocation = resolveSourceLocation(3, "CRP 4.1 mg/L");
assert.equal(pageLocation.precision, "page");
assert.equal(pageLocation.page, 3);
assert.equal(pageLocation.label, "Page 3");
assert.equal(pageLocation.snippet, "CRP 4.1 mg/L");

const documentLocation = resolveSourceLocation(null, "   ");
assert.equal(
  documentLocation.precision,
  "document",
  "a row without a recorded page must degrade to document-level provenance",
);
assert.equal(documentLocation.page, null);
assert.equal(documentLocation.snippet, null);
assert.equal(documentLocation.label, "Source page not recorded");

for (const invalidPage of [0, -1, Number.NaN]) {
  assert.equal(
    resolveSourceLocation(invalidPage, null).precision,
    "document",
    `page ${invalidPage} must not be presented as a navigable page`,
  );
}

// --- Resolution and verification are presented as two independent axes ---

const resolvedRow = buildExtractedReviewRow(extractedFixture());
assert.equal(resolvedRow.mapping.outcome, "resolved");
assert.equal(resolvedRow.mapping.label, measurementMappingLabel("resolved", "high"));
assert.equal(resolvedRow.mapping.guidance, measurementMappingGuidance("resolved"));
assert.equal(resolvedRow.mapping.verificationStatus, "auto_verified");
assert.equal(resolvedRow.mapping.verificationLabel, "Verified automatically");
assert.equal(resolvedRow.mapping.registryBindingReady, true);
assert.equal(
  resolvedRow.mapping.acceptableAsRaw,
  false,
  "a resolved row must not advertise raw-only acceptance",
);

assert.equal(verificationStatusLabel(null), "Not verified yet");
assert.equal(verificationStatusLabel("pending"), "Not verified yet");
assert.equal(verificationStatusLabel("user_verified"), "Verified by you");
assert.equal(verificationStatusLabel("manually_corrected"), "Corrected by you");
assert.equal(verificationStatusVariant("pending"), "neutral");
assert.equal(verificationStatusVariant("user_verified"), "success");
assert.equal(resolverOutcomeVariant("resolved"), "success");
assert.equal(resolverOutcomeVariant("partial"), "info");
assert.equal(resolverOutcomeVariant("ambiguous"), "warning");
assert.equal(resolverOutcomeVariant("unmapped"), "neutral");
assert.equal(resolverOutcomeVariant(null), "neutral");

// --- Raw acceptance without forced mapping ---

for (const outcome of ["partial", "ambiguous", "unmapped"] as const) {
  const row = buildExtractedReviewRow(
    extractedFixture({
      id: `extracted-${outcome}`,
      normalization: {
        result: outcome,
        mappingConfidenceBand: "low",
        registryBindingReady: false,
        resolutionDetails: resolutionDetails({
          outcome,
          verificationStatus: "pending",
          band: "low",
          missingAxes: ["specimen"],
          candidateCount: 2,
        }),
        activeRevision: { verification_status: "pending" },
        // Extra server-payload fields must be dropped by the row projection.
        candidateDefinitionKey: "candidate-only-key-must-not-leak",
        analyteKey: "candidate-only-analyte-must-not-leak",
      } as ExtractedReviewRowInput["normalization"],
    }),
  );
  assert.equal(row.mapping.outcome, outcome);
  assert.equal(row.mapping.registryBindingReady, false);
  assert.equal(
    row.mapping.acceptableAsRaw,
    true,
    `${outcome} rows awaiting review must remain acceptable as raw evidence`,
  );
  assert.equal(row.mapping.label, measurementMappingLabel(outcome, "low"));
  // #114: guidance is now chosen by reason, so it must be compared against the
  // same context the row carries — not against the outcome alone.
  assert.equal(
    row.mapping.guidance,
    measurementMappingGuidance(outcome, {
      incompleteReason: row.mapping.incompleteReason,
      missingAxes: row.resolutionDetails?.missingAxes ?? [],
    }),
  );
  assert.equal(
    row.rawEvidence.displayName,
    "ALT (SGPT)",
    "incomplete rows must keep the reported name, never a candidate display name",
  );
  assert.equal(row.rawEvidence.value, "31 U/L");
  assert.equal(row.rawEvidence.referenceText, "0 - 41");
  assert.equal(
    JSON.stringify(row).includes("candidate-only-key-must-not-leak"),
    false,
    "the row projection must not carry a candidate measurement key",
  );
  assert.equal(
    JSON.stringify(row).includes("candidate-only-analyte-must-not-leak"),
    false,
    "the row projection must not carry a candidate analyte key",
  );
}

// A stored (already accepted) row is no longer reviewable and cannot be re-accepted raw.
const acceptedRow = buildExtractedReviewRow(
  extractedFixture({ id: "extracted-accepted", status: "accepted" }),
);
assert.equal(acceptedRow.reviewable, false);
assert.equal(acceptedRow.accepted, true);
assert.equal(acceptedRow.mapping.acceptableAsRaw, false);

// --- Unstated axes are never inferred ---

const unstatedRow = buildExtractedReviewRow(
  extractedFixture({
    id: "extracted-unstated",
    specimen: "unspecified",
    modifier: "none",
    method: null,
  }),
);
assert.equal(unstatedRow.rawEvidence.specimen, null);
assert.equal(unstatedRow.rawEvidence.modifier, null);
assert.equal(unstatedRow.rawEvidence.method, null);

const statedRow = buildExtractedReviewRow(
  extractedFixture({
    id: "extracted-stated",
    specimen: "whole_blood",
    modifier: "percent",
    method: "automated",
  }),
);
assert.equal(
  statedRow.rawEvidence.specimen,
  "Whole blood",
  "snake_case storage tokens must never reach the reviewer verbatim",
);
assert.equal(statedRow.rawEvidence.modifier, "Percent");
assert.equal(statedRow.rawEvidence.method, "Automated");

// --- Qualitative results keep their reported text, not a numeric coercion ---

const qualitativeRow = buildExtractedReviewRow(
  extractedFixture({
    id: "extracted-qualitative",
    value_kind: "qualitative",
    value_numeric: 1,
    value_text: "Positive",
    raw_value_text: "POSITIVE",
    unit: null,
    raw_unit: null,
  }),
);
assert.equal(qualitativeRow.rawEvidence.value, "Positive");
assert.equal(qualitativeRow.rawEvidence.rawValueText, "POSITIVE");

// --- Observation-fallback rows ---

const observationRow = buildObservationReviewRow(observationFixture());
assert.equal(observationRow.sourceKind, "observation");
assert.equal(observationRow.reviewable, false);
assert.equal(observationRow.accepted, true);
assert.equal(observationRow.rawEvidence.displayName, "GLU");
assert.equal(observationRow.rawEvidence.value, "90 mg/dL");
assert.equal(observationRow.rawEvidence.referenceText, "70 - 99");
assert.equal(observationRow.rawEvidence.specimen, null);
assert.equal(observationRow.rawEvidence.extractionConfidence, 0.81);
assert.equal(observationRow.mapping.outcome, "partial");
assert.equal(observationRow.mapping.verificationLabel, "Not verified yet");
assert.equal(observationRow.source.page, 1);

const legacyObservationRow = buildObservationReviewRow(
  observationFixture({
    id: "observation-legacy",
    source_page: null,
    source_text: null,
    resolution_status: null,
    resolver_result: null,
    verification_status: null,
    resolution_details: null,
  }),
);
assert.equal(legacyObservationRow.source.precision, "document");
assert.equal(legacyObservationRow.mapping.outcome, null);
assert.equal(legacyObservationRow.mapping.label, null);
assert.equal(legacyObservationRow.mapping.guidance, null);
assert.equal(legacyObservationRow.mapping.verificationLabel, "Not verified yet");

// Resolver outcome falls back to the projected resolution_status.
const projectedOnlyRow = buildObservationReviewRow(
  observationFixture({
    id: "observation-projected",
    resolver_result: null,
    resolution_status: "unmapped",
  }),
);
assert.equal(projectedOnlyRow.mapping.outcome, "unmapped");

// --- Page grouping mirrors the document pane ---

const rows = [
  buildExtractedReviewRow(extractedFixture({ id: "a", source_page: 2 })),
  buildExtractedReviewRow(extractedFixture({ id: "b", source_page: 1 })),
  buildExtractedReviewRow(extractedFixture({ id: "c", source_page: 2 })),
  buildExtractedReviewRow(extractedFixture({ id: "d", source_page: null })),
];
const groups = groupReviewRowsByPage(rows);
assert.deepEqual(
  groups.map((group) => group.page),
  [1, 2, null],
  "groups must be ascending by page with unlocated rows last",
);
assert.deepEqual(
  groups.map((group) => group.label),
  ["Page 1", "Page 2", "Source page not recorded"],
);
assert.deepEqual(
  groups[1]!.rows.map((row) => row.id),
  ["a", "c"],
  "row order inside a page group must follow the API order",
);
assert.equal(groups[2]!.rows.length, 1);
assert.equal(groupReviewRowsByPage([]).length, 0);

// --- Selected-row synchronization in both directions ---

assert.equal(
  resolveSelectionForPage(rows, 1, null),
  "b",
  "navigating to a page selects the first row anchored to it",
);
assert.equal(
  resolveSelectionForPage(rows, 2, "a"),
  "a",
  "a selection already on the visible page must be preserved",
);
assert.equal(
  resolveSelectionForPage(rows, 2, "b"),
  "a",
  "a selection on another page is replaced by the first row of the visible page",
);
assert.equal(
  resolveSelectionForPage(rows, 9, "a"),
  "a",
  "a page without rows must not clear the current selection",
);
assert.equal(resolveSelectionForPage(rows, 9, null), null);
assert.equal(
  resolveSelectionForPage(rows, 1, "missing-row"),
  "b",
  "a stale selection id must resolve to the first row on the page",
);
assert.equal(
  resolveSelectionForPage(rows, 1, resolveSelectionForPage(rows, 1, null)),
  "b",
  "selection resolution must be idempotent so the sync effect cannot loop",
);

assert.equal(findReviewRow(rows, "c")?.id, "c");
assert.equal(findReviewRow(rows, null), null);
assert.equal(findReviewRow(rows, "nope"), null);
assert.equal(
  findReviewRow(rows, "d")?.source.page,
  null,
  "unlocated rows stay selectable without moving the document pane",
);

// --- Summary counters drive the pane header ---

const mixedRows = [
  buildExtractedReviewRow(extractedFixture({ id: "r1" })),
  buildObservationReviewRow(observationFixture({ id: "r2" })),
  buildObservationReviewRow(
    observationFixture({
      id: "r3",
      source_page: 4,
      resolver_result: "resolved",
      resolution_status: "resolved",
      verification_status: "user_verified",
      registry_binding_ready: true,
      resolution_details: resolutionDetails({
        outcome: "resolved",
        verificationStatus: "user_verified",
        band: "high",
      }),
    }),
  ),
];
const summary = summarizeReviewRows(mixedRows);
assert.equal(summary.total, 3);
assert.equal(summary.reviewable, 1);
assert.equal(summary.resolved, 2);
assert.equal(summary.incomplete, 1);
assert.equal(summary.unverified, 1);
assert.deepEqual(summary.pagesWithRows, [1, 2, 4]);

// #114: the split must account for every incomplete row, and the buckets must
// sum to the figure the header used to show on its own.
assert.equal(
  summary.awaitingDocument + summary.awaitingCatalog + summary.conflicted,
  summary.incomplete,
  "every incomplete row belongs to exactly one bucket",
);

const catalogBlockedRow = buildObservationReviewRow(
  observationFixture({
    id: "obs-catalog-blocked",
    source_page: 1,
    resolution_details: resolutionDetails({
      outcome: "partial",
      verificationStatus: null,
      band: "medium",
      candidateCount: 1,
      incompleteReason: "definition_not_reviewed",
    }),
  }),
);
const catalogSummary = summarizeReviewRows([catalogBlockedRow]);
assert.equal(catalogSummary.awaitingCatalog, 1, "a provisional-blocked row waits on us");
assert.equal(catalogSummary.awaitingDocument, 0, "it is not waiting on the report");
assert.equal(
  hasIncompleteOutcomes([catalogBlockedRow]),
  false,
  "reprocessing cannot change a maturity verdict, so it must not be offered as the remedy",
);
assert.match(
  catalogBlockedRow.mapping.guidance ?? "",
  /awaiting review in our catalog/i,
  "the row must say the wait is on us",
);
assert.doesNotMatch(
  catalogBlockedRow.mapping.guidance ?? "",
  /required context is missing/,
  "issue #114: a catalog-blocked row must never claim the reader is missing context",
);

const emptySummary = summarizeReviewRows([]);
assert.equal(emptySummary.total, 0);
assert.deepEqual(emptySummary.pagesWithRows, []);

// --- Document-level reprocess affordance ---

assert.equal(hasIncompleteOutcomes(mixedRows), true);
assert.equal(hasIncompleteOutcomes([resolvedRow]), false);
assert.equal(hasIncompleteOutcomes([legacyObservationRow]), false);
assert.equal(hasIncompleteOutcomes([]), false);

console.log("verify-eh117-review-workspace: all checks passed");
