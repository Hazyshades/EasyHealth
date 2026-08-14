import assert from "node:assert/strict";
import {
  resolveMeasurementDefinition,
  type MeasurementResolution,
} from "../src/lib/biomarkers";
import {
  evaluateBatchVerificationEligibility,
  summarizeBatchVerificationEligibility,
} from "../src/lib/documents/batch-verification-eligibility";
import { summarizeBatchVerificationSelection } from "../src/lib/documents/batch-verification-workspace";

const resolved = resolveMeasurementDefinition({
  rawLabel: "Hemoglobin (HGB)",
  rawUnit: "g/L",
  valueKind: "numeric",
  specimen: "whole_blood",
  modifier: null,
  method: null,
  section: null,
  referenceLow: 120,
  referenceHigh: 160,
  extractionConfidence: 0.94,
  proposedKey: "hemoglobin_whole_blood",
  rawValueText: "140",
});

assert.equal(resolved.result, "resolved", "fixture must resolve");
assert.equal(
  resolved.candidateEvidence.find(
    (candidate) => candidate.candidateKey === resolved.measurementDefinitionKey,
  )?.matchedAlias.matchType,
  "exact",
);
assert.equal(resolved.measurementDefinitionKey !== null, true);

function policy(
  resolution: MeasurementResolution = resolved,
  overrides: Partial<Parameters<typeof evaluateBatchVerificationEligibility>[0]> = {},
) {
  return evaluateBatchVerificationEligibility({
    recordStatus: "active",
    status: "needs_review",
    isCurrent: true,
    sourceSnapshot: "extract-1",
    activeRevision: null,
    resolution,
    ...overrides,
  });
}

assert.deepEqual(policy(), { eligible: true, exclusionCodes: [] });

for (const matchType of [
  "normalized",
  "ocr_variant",
  "bounded_fuzzy",
  "token_set",
] as const) {
  const nonExactAlias: MeasurementResolution = {
    ...resolved,
    candidateEvidence: resolved.candidateEvidence.map((candidate) =>
      candidate.candidateKey === resolved.measurementDefinitionKey
        ? {
            ...candidate,
            matchedAlias: { ...candidate.matchedAlias, matchType },
          }
        : candidate,
    ),
  };
  assert.deepEqual(policy(nonExactAlias).exclusionCodes, ["alias_not_exact"]);
}

const foldFallback: MeasurementResolution = {
  ...resolved,
  candidateEvidence: resolved.candidateEvidence.map((candidate) =>
    candidate.candidateKey === resolved.measurementDefinitionKey
      ? {
          ...candidate,
          matchedAlias: { ...candidate.matchedAlias, foldFallback: true },
        }
      : candidate,
  ),
};
assert.deepEqual(policy(foldFallback).exclusionCodes, ["alias_fold_fallback"]);

const provisionalAlias: MeasurementResolution = {
  ...resolved,
  candidateEvidence: resolved.candidateEvidence.map((candidate) =>
    candidate.candidateKey === resolved.measurementDefinitionKey
      ? {
          ...candidate,
          matchedAlias: {
            ...candidate.matchedAlias,
            approvalStatus: "provisional",
          },
        }
      : candidate,
  ),
};
assert.deepEqual(policy(provisionalAlias).exclusionCodes, ["alias_not_reviewed"]);

const partial: MeasurementResolution = {
  ...resolved,
  result: "partial",
  measurementDefinitionKey: null,
  candidateEvidence: [],
};
assert.deepEqual(policy(partial).exclusionCodes, [
  "not_resolved",
  "missing_definition",
  "winning_candidate_missing",
]);

const missingEvidence: MeasurementResolution = {
  ...resolved,
  candidateEvidence: resolved.candidateEvidence.map((candidate) =>
    candidate.candidateKey === resolved.measurementDefinitionKey
      ? { ...candidate, missingAxes: ["method"] }
      : candidate,
  ),
};
assert.deepEqual(policy(missingEvidence).exclusionCodes, [
  "candidate_missing_axes",
]);

const conflictingEvidence: MeasurementResolution = {
  ...resolved,
  candidateEvidence: resolved.candidateEvidence.map((candidate) =>
    candidate.candidateKey === resolved.measurementDefinitionKey
      ? {
          ...candidate,
          rejected: [
            {
              code: "unit_not_accepted",
              strength: "hard",
              score: 0,
              source: "unit",
            },
          ],
        }
      : candidate,
  ),
};
assert.deepEqual(policy(conflictingEvidence).exclusionCodes, [
  "candidate_conflicts",
]);

const missingWinner: MeasurementResolution = {
  ...resolved,
  candidateEvidence: [],
};
assert.deepEqual(policy(missingWinner).exclusionCodes, [
  "winning_candidate_missing",
]);

assert.deepEqual(
  policy(resolved, {
    activeRevision: {
      id: "revision-1",
      verification_status: "manually_corrected",
      measurement_override: { unit: "IU/L" },
    },
  }).exclusionCodes,
  ["measurement_overridden", "manual_decision_protected"],
);

assert.deepEqual(
  policy(resolved, {
    activeRevision: {
      id: "revision-2",
      verification_status: "pending",
      reversal_of_revision_id: "revision-1",
    },
  }).exclusionCodes,
  ["reversal_protected"],
);

assert.deepEqual(
  policy(resolved, {
    expectedSourceSnapshot: "extract-before-refresh",
    expectedActiveRevisionId: "revision-before-refresh",
  }).exclusionCodes,
  ["stale_source_snapshot", "stale_active_revision"],
);

const normalizedAlias: MeasurementResolution = {
  ...resolved,
  candidateEvidence: resolved.candidateEvidence.map((candidate) =>
    candidate.candidateKey === resolved.measurementDefinitionKey
      ? {
          ...candidate,
          matchedAlias: { ...candidate.matchedAlias, matchType: "normalized" },
        }
      : candidate,
  ),
};

const summary = summarizeBatchVerificationEligibility(
  [
    { id: "eligible", resolution: resolved },
    { id: "partial", resolution: partial },
    { id: "normalized", resolution: normalizedAlias },
  ],
  (row) => policy(row.resolution),
);
assert.deepEqual(summary.eligibleIds, ["eligible"]);
assert.equal(summary.excluded.length, 2);
assert.equal(summary.excludedCounts.not_resolved, 1);
assert.equal(summary.excludedCounts.alias_not_exact, 1);


const batchSelection = summarizeBatchVerificationSelection({
  eligibleIds: ["eligible", "deselected", "eligible"],
  selectedIds: new Set(["eligible", "ineligible"]),
  excludedCount: summary.excluded.length,
});
assert.deepEqual(
  batchSelection,
  {
    selectedCount: 1,
    deselectedEligibleCount: 1,
    excludedCount: 2,
  },
  "the confirmation model counts only the server-projected eligible cohort",
);
console.log("verify-eh122-batch-verification: all checks passed");
