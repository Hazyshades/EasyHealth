import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getReviewedAssessmentBinding } from "../src/lib/biomarkers";
import {
  evaluateSystemObservationFreshness,
  HEALTH_PROFILE_FRESHNESS_POLICY,
} from "../src/lib/health-profile-freshness";
import {
  evaluateHealthProfileScorePolicy,
  REGISTRY_V2_SCORE_READINESS_CONTEXT,
  type AssessmentCandidate,
} from "../src/lib/health-profile-score-policy";
import {
  buildHealthProfile,
  type ObservationInput,
  type SystemMarker,
} from "../src/lib/health-systems";
import { hashHealthProfileSnapshotInput } from "../src/lib/health-profile-snapshot-canonical";

const AS_OF = "2026-08-23";
const EVALUATED_AT = "2026-08-23T12:00:00.000Z";
const POLICY_CONTEXT = {
  asOf: AS_OF,
  evaluatedAt: EVALUATED_AT,
  freshnessPolicy: HEALTH_PROFILE_FRESHNESS_POLICY,
  registry: REGISTRY_V2_SCORE_READINESS_CONTEXT,
};
const source = {
  id: "document-eh144",
  original_filename: "lipids.pdf",
  observed_at: AS_OF,
  lab_name: "Synthetic Lab",
  document_type: "lab_result",
};

function observation(
  biomarkerKey: string,
  measurementDefinitionKey: string,
  observedAt: string | null,
  value = 100,
  observationId = `observation-${biomarkerKey}`,
): ObservationInput {
  return {
    biomarker_key: biomarkerKey,
    observation_id: observationId,
    measurement_definition_key: measurementDefinitionKey,
    resolution_status: "resolved",
    name: biomarkerKey,
    value,
    unit: "mg/dL",
    ref_low: 0,
    ref_high: 200,
    observed_at: observedAt,
    document_id: source.id,
    observation_kind: "lab",
    value_kind: "numeric",
    specimen: "serum",
  };
}

function marker(
  key: string,
  definitionKey: string,
  observedAt: string | null,
): SystemMarker {
  return {
    key,
    measurement_definition_key: definitionKey,
    name: key,
    value: 100,
    unit: "mg/dL",
    ref_low: 0,
    ref_high: 200,
    status: "in_range",
    freshness_status: evaluateSystemObservationFreshness({
      systemId: "cardiovascular",
      measuredAt: observedAt,
      asOf: AS_OF,
    }),
    observed_at: observedAt,
    document_id: source.id,
    observation_kind: "lab",
    source,
    score_role: "core",
    value_kind: "numeric",
    specimen: "serum",
    modifier: "none",
  };
}

function candidateFor(item: SystemMarker): AssessmentCandidate {
  const binding = getReviewedAssessmentBinding(item.key);
  assert.ok(binding, `expected reviewed assessment binding for ${item.key}`);
  return {
    observation: observation(
      item.key,
      binding.definition.key,
      item.observed_at,
      item.value ?? 100,
      item.observation_id ?? `fixture-${item.key}`,
    ),
    system_id: binding.binding.system,
    assessment_input_key: binding.binding.assessmentInputKey,
    measurement_definition_key: binding.definition.key,
    score_role: binding.binding.scoreRole,
    expected_specimen:
      binding.definition.specimen !== "unspecified"
        ? binding.definition.specimen
        : null,
    source: item.source,
  };
}

function evaluate(systemId: "cardiovascular", markers: SystemMarker[]) {
  const result = evaluateHealthProfileScorePolicy(
    markers.map(candidateFor),
    POLICY_CONTEXT,
  ).systems.find((system) => system.id === systemId);
  assert.ok(result, `expected ${systemId} policy result`);
  return result;
}
assert.equal(HEALTH_PROFILE_FRESHNESS_POLICY.version, "eh-144.v1");
assert.equal(
  HEALTH_PROFILE_FRESHNESS_POLICY.maxAgeDaysBySystem.cardiovascular,
  365,
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: AS_OF,
    asOf: AS_OF,
  }),
  "current",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "2025-08-23",
    asOf: AS_OF,
  }),
  "current",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "2025-08-22",
    asOf: AS_OF,
  }),
  "outdated",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "2026-08-24",
    asOf: AS_OF,
  }),
  "unknown_date",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "2025-01-01",
    asOf: AS_OF,
  }),
  "outdated",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: null,
    asOf: AS_OF,
  }),
  "unknown_date",
);
assert.equal(
  evaluateSystemObservationFreshness({
    systemId: "cardiovascular",
    measuredAt: "not-a-date",
    asOf: AS_OF,
  }),
  "unknown_date",
);

const currentReadiness = evaluate("cardiovascular", [
  marker("ldl", "ldl_serum", AS_OF),
  marker("hdl", "hdl_serum", AS_OF),
  marker("triglycerides", "triglycerides_serum", AS_OF),
]);
assert.equal(currentReadiness.scoreability, "scoreable");
assert.equal(
  currentReadiness.score_readiness.reasons.some(
    (reason) => reason.code === "outdated" || reason.code === "unknown_date",
  ),
  false,
);

const outdatedReadiness = evaluate("cardiovascular", [
  marker("ldl", "ldl_serum", "2025-08-22"),
  marker("hdl", "hdl_serum", AS_OF),
  marker("triglycerides", "triglycerides_serum", AS_OF),
]);
assert.equal(outdatedReadiness.scoreability, "incomplete");
assert.deepEqual(
  outdatedReadiness.score_readiness.reasons
    .filter((reason) => reason.code === "outdated")
    .map((reason) => reason.required_group),
  [["ldl", "non_hdl_cholesterol"]],
);
assert.equal(outdatedReadiness.state_score, null);

const unknownDateReadiness = evaluate("cardiovascular", [
  marker("ldl", "ldl_serum", null),
  marker("hdl", "hdl_serum", AS_OF),
  marker("triglycerides", "triglycerides_serum", AS_OF),
]);
assert.equal(unknownDateReadiness.scoreability, "incomplete");
assert.deepEqual(
  unknownDateReadiness.score_readiness.reasons
    .filter((reason) => reason.code === "unknown_date")
    .map((reason) => reason.required_group),
  [["ldl", "non_hdl_cholesterol"]],
);

const currentProfile = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", AS_OF),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const currentCardiovascular = currentProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(currentCardiovascular);
assert.equal(currentCardiovascular.state_score !== null, true);
assert.equal(currentProfile.freshness_policy_version, "eh-144.v1");
assert.equal(currentProfile.freshness_evaluated_at, EVALUATED_AT);
assert.equal(
  currentCardiovascular.markers.every(
    (item) => item.freshness_status === "current",
  ),
  true,
);

const outdatedProfile = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", "2025-01-01"),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const outdatedCardiovascular = outdatedProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(outdatedCardiovascular);
assert.equal(outdatedCardiovascular.state_score, null);
assert.deepEqual(
  outdatedCardiovascular.score_readiness.reasons
    .filter((reason) => reason.code === "outdated")
    .map((reason) => reason.required_group),
  [["ldl", "non_hdl_cholesterol"]],
);
assert.equal(
  outdatedCardiovascular.markers.find((item) => item.key === "ldl")
    ?.observed_at,
  "2025-01-01",
);

const unknownDateProfile = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", null),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const unknownDateCardiovascular = unknownDateProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(unknownDateCardiovascular);
assert.equal(unknownDateCardiovascular.state_score, null);
assert.deepEqual(
  unknownDateCardiovascular.score_readiness.reasons
    .filter((reason) => reason.code === "unknown_date")
    .map((reason) => reason.required_group),
  [["ldl", "non_hdl_cholesterol"]],
);
assert.equal(
  unknownDateCardiovascular.markers.find((item) => item.key === "ldl")
    ?.observed_at,
  null,
);

const alternativeCurrentProfile = buildHealthProfile(
  [
    observation("non_hdl_cholesterol", "non_hdl_cholesterol_serum", AS_OF),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const alternativeCardiovascular = alternativeCurrentProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(alternativeCardiovascular);
assert.equal(alternativeCardiovascular.state_score !== null, true);

const firstInput = observation("ldl", "ldl_serum", AS_OF, 80, "observation-a");
const secondInput = observation(
  "ldl",
  "ldl_serum",
  AS_OF,
  120,
  "observation-b",
);
const deterministicProfile = buildHealthProfile(
  [firstInput, secondInput],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const deterministicMarker = deterministicProfile.systems
  .find((system) => system.id === "cardiovascular")
  ?.markers.find((item) => item.key === "ldl");
assert.equal(deterministicMarker?.value, 120);

const knownDateWinsOverMalformedDate = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", "2025-01-01", 80, "observation-known-date"),
    observation(
      "ldl",
      "ldl_serum",
      "not-a-date",
      120,
      "observation-malformed-date",
    ),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const knownDateMarker = knownDateWinsOverMalformedDate.systems
  .find((system) => system.id === "cardiovascular")
  ?.markers.find((item) => item.key === "ldl");
assert.equal(knownDateMarker?.observed_at, "2025-01-01");
// Identical date/id/document ties intentionally retain input order; no new
// tie-breaker is introduced by the policy extraction.
const identicalTieFirst = observation(
  "ldl",
  "ldl_serum",
  AS_OF,
  80,
  "same-observation",
);
const identicalTieSecond = observation(
  "ldl",
  "ldl_serum",
  AS_OF,
  120,
  "same-observation",
);
const identicalTieForward = buildHealthProfile(
  [identicalTieFirst, identicalTieSecond],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
const identicalTieReverse = buildHealthProfile(
  [identicalTieSecond, identicalTieFirst],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: EVALUATED_AT },
);
assert.equal(
  identicalTieForward.systems
    .find((system) => system.id === "cardiovascular")
    ?.markers.find((item) => item.key === "ldl")?.value,
  80,
);
assert.equal(
  identicalTieReverse.systems
    .find((system) => system.id === "cardiovascular")
    ?.markers.find((item) => item.key === "ldl")?.value,
  120,
);

const evaluatedAtOnlyProfile = buildHealthProfile(
  [
    observation("ldl", "ldl_serum", AS_OF),
    observation("hdl", "hdl_serum", AS_OF),
    observation("triglycerides", "triglycerides_serum", AS_OF),
  ],
  [source],
  { freshnessAsOf: AS_OF, freshnessEvaluatedAt: "2026-08-24T12:00:00.000Z" },
);
const scoreReadinessProjection = (profile: typeof currentProfile) =>
  profile.systems.map((system) => ({
    id: system.id,
    state_score: system.state_score,
    data_confidence: system.data_confidence,
    scoreability: system.scoreability,
    score_readiness: system.score_readiness,
    markers: system.markers.map((item) => ({
      key: item.key,
      status: item.status,
      freshness_status: item.freshness_status,
      observed_at: item.observed_at,
    })),
  }));
assert.deepEqual(
  scoreReadinessProjection(evaluatedAtOnlyProfile),
  scoreReadinessProjection(currentProfile),
  "evaluatedAt is provenance only and cannot change score/readiness",
);
assert.equal(
  evaluatedAtOnlyProfile.overall_state_score,
  currentProfile.overall_state_score,
);

const hashWithPolicy = hashHealthProfileSnapshotInput({
  freshness_policy_version: "eh-144.v1",
  freshness_as_of: AS_OF,
  inputs: [firstInput],
});
const hashWithDifferentPolicy = hashHealthProfileSnapshotInput({
  freshness_policy_version: "eh-144.v2",
  freshness_as_of: AS_OF,
  inputs: [firstInput],
});
assert.notEqual(hashWithPolicy, hashWithDifferentPolicy);

const drawerSource = readFileSync(
  resolve(process.cwd(), "src/components/health-profile-drawer.tsx"),
  "utf8",
);
const profilePageSource = readFileSync(
  resolve(process.cwd(), "src/app/app/profile/page.tsx"),
  "utf8",
);
assert.match(drawerSource, /outdated data/);
assert.match(drawerSource, /date unavailable/);
assert.match(profilePageSource, /observed_at \?\? "Date unavailable"/);
assert.doesNotMatch(drawerSource, /order\s+(?:a\s+)?(?:new\s+)?tests?/i);
const bodySilhouetteSource = readFileSync(
  resolve(process.cwd(), "src/components/body-silhouette.tsx"),
  "utf8",
);
const healthProfileAssessmentReadSource = readFileSync(
  resolve(process.cwd(), "src/lib/health-profile-assessment-read.ts"),
  "utf8",
);
assert.match(healthProfileAssessmentReadSource, /freshness_policy_version/);
assert.match(healthProfileAssessmentReadSource, /freshness_evaluated_at/);
assert.match(
  healthProfileAssessmentReadSource,
  /candidate\.freshness_policy_version\s*!==\s*HEALTH_PROFILE_FRESHNESS_POLICY\.version/,
);
assert.match(bodySilhouetteSource, /outdated evidence/);
assert.match(bodySilhouetteSource, /medical date unavailable/);

console.log("verify-eh144-freshness-policy: all checks passed");
