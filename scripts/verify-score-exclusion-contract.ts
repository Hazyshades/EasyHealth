/**
 * Pins the score-exclusion contract across every reachable reason branch. The
 * EH-141/143/144/145 suites assert `reason` but never `reason_detail`, so the
 * two exclusion paths could drift silently. The registry is synthetic so the
 * scenarios survive catalog growth.
 */

import assert from "node:assert/strict";
import {
  evaluateHealthProfileScorePolicy,
  type AssessmentCandidate,
  type ScoreReadinessPolicyContext,
  type ScoreReadinessPolicyResult,
  type ScoreReadinessRegistryContext,
} from "../src/lib/health-profile-score-policy";
import { HEALTH_PROFILE_FRESHNESS_POLICY } from "../src/lib/health-profile-freshness";
import type {
  BodySystemId,
  NamedBodySystemId,
  ScoreContributionGroup,
  ScoreRequiredGroup,
} from "../src/lib/biomarkers";
import type {
  ObservationInput,
  ScoreExclusion,
  ScoreExclusionReason,
} from "../src/lib/health-systems";

const AS_OF = "2026-09-27";
const OBSERVED_AT = "2026-09-01";
const SCORE_UNAVAILABLE = "required_readiness_group_incomplete";

/**
 * `metabolic` has a contribution group covering every readiness key, so it can
 * only reach the "scoreable with a score" state. `thyroid` does not, which is
 * what makes "scoreable but no score" reachable at all.
 */
const READINESS_GROUPS: Record<string, readonly ScoreRequiredGroup[]> = {
  metabolic: [["hba1c", "glucose"]],
  thyroid: [["tsh"]],
  inflammation: [["marker_c"]],
};

const CONTRIBUTION_GROUPS: Record<string, readonly ScoreContributionGroup[]> = {
  metabolic: [{ id: "glycemia", keys: ["hba1c", "glucose"] }],
  thyroid: [{ id: "tsh", keys: ["absent_from_contribution"] }],
  inflammation: [],
};

const COVERAGE_KEYS: Record<string, readonly string[]> = {
  metabolic: ["hba1c", "glucose"],
  thyroid: ["tsh"],
  inflammation: ["marker_c"],
};

const NAMED_SYSTEMS: readonly NamedBodySystemId[] = [
  "metabolic",
  "thyroid",
  "inflammation",
];

function bySystem<V>(
  table: Record<string, V>,
  systems: readonly BodySystemId[],
): Map<BodySystemId, V> {
  return new Map(systems.map((systemId) => [systemId, table[systemId]]));
}

const REGISTRY: ScoreReadinessRegistryContext = {
  named_systems: NAMED_SYSTEMS,
  non_scoreable_systems: new Set<NamedBodySystemId>(["inflammation"]),
  readiness_groups_by_system: bySystem(READINESS_GROUPS, NAMED_SYSTEMS),
  contribution_groups_by_system: bySystem(CONTRIBUTION_GROUPS, NAMED_SYSTEMS),
  coverage_keys_by_system: bySystem(COVERAGE_KEYS, NAMED_SYSTEMS),
};

const CONTEXT: ScoreReadinessPolicyContext = {
  asOf: AS_OF,
  evaluatedAt: `${AS_OF}T00:00:00.000Z`,
  freshnessPolicy: HEALTH_PROFILE_FRESHNESS_POLICY,
  registry: REGISTRY,
};

type CandidateOverrides = Partial<Omit<AssessmentCandidate, "observation">> & {
  observation?: Partial<ObservationInput>;
};

function candidate(
  systemId: BodySystemId,
  key: string,
  overrides: CandidateOverrides = {},
): AssessmentCandidate {
  const { observation, ...candidateOverrides } = overrides;
  return {
    observation: {
      observation_id: `obs-${key}`,
      biomarker_key: key,
      measurement_definition_key: `${key}_measurement`,
      name: key,
      value: 5,
      unit: "unit",
      ref_low: 1,
      ref_high: 9,
      observed_at: OBSERVED_AT,
      document_id: "verify-document",
      value_kind: "numeric",
      specimen: "serum",
      modifier: "none",
      ...observation,
    },
    system_id: systemId,
    assessment_input_key: key,
    measurement_definition_key: `${key}_measurement`,
    score_role: "core",
    expected_specimen: "serum",
    source: null,
    ...candidateOverrides,
  };
}

function systemOf(
  result: ScoreReadinessPolicyResult,
  id: BodySystemId,
): ScoreReadinessPolicyResult["systems"][number] {
  const found = result.systems.find((entry) => entry.id === id);
  assert.ok(found, `${id} should be rendered`);
  return found;
}

/**
 * The ladder makes one decision, so a changed detail or group is a contract
 * break even when the reason is unchanged.
 */
function assertExclusion(
  result: ScoreReadinessPolicyResult,
  id: BodySystemId,
  key: string,
  reason: ScoreExclusionReason,
  reasonDetail: string | null,
  contributionGroup: string | null = null,
) {
  const actual: ScoreExclusion | undefined = systemOf(
    result,
    id,
  ).score_provenance.excluded.find((item) => item.key === key);
  assert.ok(actual, `${id}/${key} should be excluded`);
  assert.deepEqual(
    {
      reason: actual.reason,
      reason_detail: actual.reason_detail,
      contribution_group: actual.contribution_group,
    },
    {
      reason,
      reason_detail: reasonDetail,
      contribution_group: contributionGroup,
    },
    `${id}/${key} exclusion contract`,
  );
}

// Scoreable, score present. Every ladder branch above `score_not_available`
// records no detail, including the two that only exist once a score exists.

const scoreable = evaluateHealthProfileScorePolicy(
  [
    candidate("metabolic", "hba1c"),
    candidate("metabolic", "glucose"),
    candidate("metabolic", "insulin", { observation: { specimen: "plasma" } }),
    candidate("metabolic", "ldl"),
    candidate("metabolic", "alt", { score_role: "extended" }),
    candidate("metabolic", "ast", {
      observation: { value_kind: "qualitative", value: null },
    }),
    candidate("metabolic", "bilirubin", {
      observation: { ref_low: null, ref_high: null },
    }),
  ],
  CONTEXT,
);

assert.equal(
  systemOf(scoreable, "metabolic").state_score,
  95,
  "an in-range core marker scores 95",
);
assert.deepEqual(
  systemOf(scoreable, "metabolic").score_provenance.contributors.map(
    (item) => item.key,
  ),
  ["hba1c"],
  "only the readiness winner contributes",
);
assertExclusion(
  scoreable,
  "metabolic",
  "glucose",
  "duplicate_contribution_group",
  null,
  "glycemia",
);
assertExclusion(scoreable, "metabolic", "insulin", "specimen_mismatch", null);
assertExclusion(
  scoreable,
  "metabolic",
  "ldl",
  "not_in_contribution_group",
  null,
);
assertExclusion(scoreable, "metabolic", "alt", "not_core", null);
assertExclusion(scoreable, "metabolic", "ast", "non_numeric_value", null);
assertExclusion(
  scoreable,
  "metabolic",
  "bilirubin",
  "missing_reference_range",
  null,
);

// Scoreable, required groups satisfied, no contribution group matched. The
// one case where `score_not_available` must not imply the readiness detail.

const scoreableWithoutScore = evaluateHealthProfileScorePolicy(
  [
    candidate("thyroid", "tsh"),
    candidate("thyroid", "t4", { score_role: "extended" }),
    candidate("thyroid", "t3", {
      observation: { value_kind: "qualitative", value: null },
    }),
  ],
  CONTEXT,
);

assert.equal(
  systemOf(scoreableWithoutScore, "thyroid").scoreability,
  "scoreable",
);
assert.equal(systemOf(scoreableWithoutScore, "thyroid").state_score, null);
assert.deepEqual(
  systemOf(scoreableWithoutScore, "thyroid").score_readiness.reasons,
  [],
  "every required group is satisfied, so readiness is not the cause",
);
assertExclusion(
  scoreableWithoutScore,
  "thyroid",
  "tsh",
  "score_not_available",
  null,
);
assertExclusion(scoreableWithoutScore, "thyroid", "t4", "not_core", null);
assertExclusion(
  scoreableWithoutScore,
  "thyroid",
  "t3",
  "non_numeric_value",
  null,
);

// Not scoreable: a required group is missing. The readiness detail belongs to
// the score-less marker alone.

const notScoreable = evaluateHealthProfileScorePolicy(
  [
    candidate("thyroid", "t4", { score_role: "extended" }),
    candidate("thyroid", "ft4"),
    candidate("thyroid", "t3", {
      observation: { value_kind: "qualitative", value: null },
    }),
  ],
  CONTEXT,
);

assert.equal(systemOf(notScoreable, "thyroid").scoreability, "incomplete");
assert.equal(systemOf(notScoreable, "thyroid").state_score, null);
assert.deepEqual(
  systemOf(notScoreable, "thyroid").score_readiness.reasons.map(
    (reason) => reason.code,
  ),
  ["missing"],
);
assertExclusion(notScoreable, "thyroid", "t4", "not_core", null);
assertExclusion(
  notScoreable,
  "thyroid",
  "ft4",
  "score_not_available",
  SCORE_UNAVAILABLE,
);
assertExclusion(notScoreable, "thyroid", "t3", "non_numeric_value", null);

// System ids that gate before the ladder, and the two shapes an id decides.

const gated = evaluateHealthProfileScorePolicy(
  [
    candidate("inflammation", "marker_c"),
    candidate("general", "free_note", {
      observation: {
        value_kind: "text",
        value: null,
        ref_low: null,
        ref_high: null,
      },
    }),
  ],
  CONTEXT,
);

assert.equal(systemOf(gated, "inflammation").scoreability, "non_scoreable");
assert.deepEqual(
  systemOf(gated, "inflammation").score_readiness.reasons,
  [],
  "a factual-only system has no required groups, so it cannot be incomplete",
);
assertExclusion(
  gated,
  "inflammation",
  "marker_c",
  "system_not_scoreable",
  null,
);
assert.equal(systemOf(gated, "general").scoreability, "supporting_only");
assertExclusion(gated, "general", "free_note", "system_not_scoreable", null);

console.log("verify-score-exclusion-contract: all checks passed");
