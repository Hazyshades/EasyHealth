import {
  getMeasurementDefinition,
  type MeasurementResolution,
  type VerificationStatus,
} from "@/lib/biomarkers";
import type { MeasurementOverride } from "./observation-measurement-correction";

export const BATCH_VERIFICATION_EXCLUSION_CODES = [
  "not_awaiting_review",
  "record_not_active",
  "source_not_current",
  "stale_source_snapshot",
  "stale_active_revision",
  "not_resolved",
  "missing_definition",
  "definition_not_reviewed",
  "definition_not_registry_reviewed",
  "winning_candidate_missing",
  "candidate_missing_axes",
  "candidate_conflicts",
  "alias_not_exact",
  "alias_fold_fallback",
  "alias_not_reviewed",
  "alias_not_authoritative",
  "alias_not_active",
  "measurement_overridden",
  "manual_decision_protected",
  "reversal_protected",
] as const;

export type BatchVerificationExclusionCode =
  (typeof BATCH_VERIFICATION_EXCLUSION_CODES)[number];

export type BatchVerificationEligibility = Readonly<{
  eligible: boolean;
  exclusionCodes: readonly BatchVerificationExclusionCode[];
}>;
export type BatchVerificationEligibilityInput = Readonly<{
  status: string | null;
  recordStatus: "active" | "rejected" | "superseded" | null;
  isCurrent: boolean;
  sourceSnapshot: string | null;
  expectedSourceSnapshot?: string | null;
  expectedActiveRevisionId?: string | null;
  resolution: MeasurementResolution;
  activeRevision: {
    id: string;
    verification_status: VerificationStatus;
    measurement_override?: MeasurementOverride | null;
    reversal_of_revision_id?: string | null;
  } | null;
}>;

export const BATCH_VERIFICATION_EXCLUSION_LABELS: Readonly<
  Record<BatchVerificationExclusionCode, string>
> = {
  record_not_active: "This result was rejected and cannot be verified.",
  not_awaiting_review: "This result is no longer awaiting review.",
  source_not_current: "This result was superseded and cannot be verified.",
  stale_source_snapshot: "This result changed while the review was open.",
  stale_active_revision: "This result changed while the review was open.",
  not_resolved: "This result does not have one safe concrete match.",
  missing_definition: "The matched measurement definition is unavailable.",
  definition_not_reviewed:
    "The matched measurement is not reviewed for verification.",
  definition_not_registry_reviewed:
    "The matched measurement is not a reviewed Registry 2.0 definition.",
  winning_candidate_missing: "The match evidence is unavailable for verification.",
  candidate_missing_axes:
    "This match needs individual review because required evidence is missing.",
  candidate_conflicts:
    "This match conflicts with the reported evidence and needs individual review.",
  alias_not_exact: "This match is not an exact approved label match.",
  alias_fold_fallback:
    "This match used a fallback label form and needs individual review.",
  alias_not_reviewed: "The matching alias is not reviewed for verification.",
  alias_not_authoritative:
    "The matching alias is not approved to verify a concrete measurement.",
  alias_not_active: "The matching alias is no longer active.",
  measurement_overridden:
    "This result was edited and must remain an individual review decision.",
  manual_decision_protected:
    "This result already has a protected human verification decision.",
  reversal_protected:
    "This result is part of a reversal history and must remain an individual review decision.",
};

function add(
  codes: BatchVerificationExclusionCode[],
  condition: boolean,
  code: BatchVerificationExclusionCode,
) {
  if (condition) codes.push(code);
}

/**
 * Applies the narrow EH-122 allow-list to canonical resolver output. The caller
 * owns producing the deterministic resolution from current source evidence;
 * this function intentionally accepts no client-provided eligibility flag.
 */
export function evaluateBatchVerificationEligibility(
  input: BatchVerificationEligibilityInput,
): BatchVerificationEligibility {
  const exclusionCodes: BatchVerificationExclusionCode[] = [];
  const reviewable =
    input.status === "needs_review" || input.status === "pending_review";
  add(
    exclusionCodes,
    input.recordStatus !== "active",
    "record_not_active",
  );

  add(exclusionCodes, !reviewable, "not_awaiting_review");
  add(exclusionCodes, !input.isCurrent, "source_not_current");
  add(
    exclusionCodes,
    input.expectedSourceSnapshot !== undefined &&
      input.expectedSourceSnapshot !== input.sourceSnapshot,
    "stale_source_snapshot",
  );
  add(
    exclusionCodes,
    input.expectedActiveRevisionId !== undefined &&
      input.expectedActiveRevisionId !== (input.activeRevision?.id ?? null),
    "stale_active_revision",
  );

  const { resolution, activeRevision } = input;
  add(exclusionCodes, resolution.result !== "resolved", "not_resolved");
  add(
    exclusionCodes,
    resolution.measurementDefinitionKey === null,
    "missing_definition",
  );

  const definition = resolution.measurementDefinitionKey
    ? getMeasurementDefinition(resolution.measurementDefinitionKey)
    : undefined;
  add(
    exclusionCodes,
    resolution.measurementDefinitionKey !== null && !definition,
    "missing_definition",
  );
  add(
    exclusionCodes,
    Boolean(definition && definition.maturity !== "reviewed"),
    "definition_not_reviewed",
  );
  add(
    exclusionCodes,
    Boolean(
      definition && definition.sourceProvenance.kind !== "registry_v2_review",
    ),
    "definition_not_registry_reviewed",
  );

  const winner =
    resolution.measurementDefinitionKey === null
      ? undefined
      : resolution.candidateEvidence.find(
          (candidate) =>
            candidate.candidateKey === resolution.measurementDefinitionKey,
        );
  add(exclusionCodes, !winner, "winning_candidate_missing");
  add(
    exclusionCodes,
    Boolean(winner && winner.missingAxes.length > 0),
    "candidate_missing_axes",
  );
  add(
    exclusionCodes,
    Boolean(winner && winner.rejected.length > 0),
    "candidate_conflicts",
  );
  const alias = winner?.matchedAlias;
  add(exclusionCodes, Boolean(alias && alias.matchType !== "exact"), "alias_not_exact");
  add(exclusionCodes, alias?.foldFallback === true, "alias_fold_fallback");
  add(
    exclusionCodes,
    Boolean(alias && alias.approvalStatus !== "reviewed"),
    "alias_not_reviewed",
  );
  add(
    exclusionCodes,
    Boolean(alias && alias.matchAuthority !== "reviewed_resolution"),
    "alias_not_authoritative",
  );
  add(exclusionCodes, Boolean(alias && alias.lifecycle !== "active"), "alias_not_active");

  add(
    exclusionCodes,
    activeRevision?.measurement_override != null,
    "measurement_overridden",
  );
  add(
    exclusionCodes,
    activeRevision?.verification_status === "user_verified" ||
      activeRevision?.verification_status === "manually_corrected",
    "manual_decision_protected",
  );
  add(
    exclusionCodes,
    activeRevision?.reversal_of_revision_id != null,
    "reversal_protected",
  );

  return {
    eligible: exclusionCodes.length === 0,
    exclusionCodes,
  };
}

export type BatchVerificationEligibilitySummary<Row extends { id: string }> =
  Readonly<{
    eligibleIds: readonly string[];
    excluded: readonly (Row & {
      exclusionCodes: readonly BatchVerificationExclusionCode[];
    })[];
    excludedCounts: Readonly<
      Partial<Record<BatchVerificationExclusionCode, number>>
    >;
  }>;

export function summarizeBatchVerificationEligibility<Row extends { id: string }>(
  rows: readonly Row[],
  evaluate: (row: Row) => BatchVerificationEligibility,
): BatchVerificationEligibilitySummary<Row> {
  const eligibleIds: string[] = [];
  const excluded: Array<
    Row & { exclusionCodes: readonly BatchVerificationExclusionCode[] }
  > = [];
  const excludedCounts: Partial<Record<BatchVerificationExclusionCode, number>> = {};

  for (const row of rows) {
    const outcome = evaluate(row);
    if (outcome.eligible) {
      eligibleIds.push(row.id);
      continue;
    }
    excluded.push({ ...row, exclusionCodes: outcome.exclusionCodes });
    for (const code of outcome.exclusionCodes) {
      excludedCounts[code] = (excludedCounts[code] ?? 0) + 1;
    }
  }

  return { eligibleIds, excluded, excludedCounts };
}
