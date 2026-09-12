import assert from "node:assert/strict";
import {
  getRegistryV2ScoreReadinessGroups,
  getReviewedAssessmentBinding,
} from "../src/lib/biomarkers";
import {
  getRegistryV2System,
  NAMED_BODY_SYSTEMS,
} from "../src/lib/biomarkers/registry-v2-runtime";
import {
  HEALTH_PROFILE_FRESHNESS_POLICY,
  type HealthProfileFreshnessPolicy,
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

const OBSERVED_AT = "2026-08-01";
const POLICY_CONTEXT = {
  asOf: OBSERVED_AT,
  evaluatedAt: "2026-08-01T00:00:00.000Z",
  freshnessPolicy:
    HEALTH_PROFILE_FRESHNESS_POLICY satisfies HealthProfileFreshnessPolicy,
  registry: REGISTRY_V2_SCORE_READINESS_CONTEXT,
};

function markerFor(key: string): SystemMarker {
  const binding = getReviewedAssessmentBinding(key);
  assert.ok(binding, `expected reviewed assessment binding for ${key}`);

  return {
    key,
    measurement_definition_key: binding.definition.key,
    name: key,
    value: 50,
    unit: "fixture-unit",
    ref_low: 0,
    ref_high: 100,
    status: "in_range",
    freshness_status: "current",
    observed_at: OBSERVED_AT,
    document_id: null,
    source: null,
    score_role: binding.binding.scoreRole,
    value_kind: "numeric",
    specimen: binding.definition.specimen,
    modifier: "none",
  };
}

function completeMarkers(
  systemId: (typeof NAMED_BODY_SYSTEMS)[number],
): SystemMarker[] {
  return getRegistryV2ScoreReadinessGroups(systemId).map((group) =>
    markerFor(group[0]!),
  );
}

function observationFor(marker: SystemMarker): ObservationInput {
  return {
    biomarker_key: marker.key,
    measurement_definition_key: marker.measurement_definition_key,
    resolution_status: "resolved",
    name: marker.name,
    value: marker.value,
    unit: marker.unit,
    ref_low: marker.ref_low,
    ref_high: marker.ref_high,
    observed_at: marker.observed_at,
    document_id: marker.document_id,
    observation_kind: "lab",
    value_kind: marker.value_kind,
    specimen: marker.specimen,
    modifier: marker.modifier,
  };
}

function candidateFor(marker: SystemMarker): AssessmentCandidate {
  const binding = getReviewedAssessmentBinding(marker.key);
  assert.ok(binding, `expected reviewed assessment binding for ${marker.key}`);
  return {
    observation: observationFor(marker),
    system_id: binding.binding.system ?? getRegistryV2System(marker.key),
    assessment_input_key: binding.binding.assessmentInputKey,
    measurement_definition_key: binding.definition.key,
    score_role: binding.binding.scoreRole,
    expected_specimen:
      binding.definition.specimen !== "unspecified"
        ? binding.definition.specimen
        : null,
    source: marker.source,
  };
}

function evaluate(
  systemId: (typeof NAMED_BODY_SYSTEMS)[number],
  markers: SystemMarker[],
) {
  const result = evaluateHealthProfileScorePolicy(
    markers.map(candidateFor),
    POLICY_CONTEXT,
  ).systems.find((system) => system.id === systemId);
  assert.ok(result, `expected ${systemId} policy result`);
  return result;
}

for (const systemId of NAMED_BODY_SYSTEMS) {
  if (systemId === "inflammation") {
    const evaluation = evaluate(systemId, [markerFor("crp")]);
    assert.equal(evaluation.scoreability, "non_scoreable");
    assert.equal(evaluation.state_score, null);
    continue;
  }

  const markers = completeMarkers(systemId);
  const evaluation = evaluate(systemId, markers);
  assert.equal(
    evaluation.scoreability,
    "scoreable",
    `${systemId} needs every required group`,
  );
  assert.deepEqual(
    evaluation.score_readiness.reasons,
    [],
    `${systemId} has no readiness reason when complete`,
  );
  assert.notEqual(
    evaluation.state_score,
    null,
    `${systemId} can produce a score only after complete readiness`,
  );

  const missingGroup = evaluation.score_readiness.required_groups[0]!;
  const missingMarkers = markers.filter(
    (marker) => !missingGroup.keys.includes(marker.key),
  );
  const missingEvaluationMarkers =
    missingMarkers.length > 0 ? missingMarkers : [markerFor("glucose")];
  const missing = evaluate(systemId, missingEvaluationMarkers);
  assert.equal(missing.scoreability, "incomplete");
  assert.deepEqual(missing.score_readiness.reasons, [
    {
      code: "missing",
      required_group: missingGroup.keys,
      present_keys: [],
    },
  ]);
  assert.equal(missing.state_score, null);

  const invalidMarkers = markers.map((marker) =>
    missingGroup.keys.includes(marker.key)
      ? { ...marker, ref_low: null, ref_high: null, status: "unknown" as const }
      : marker,
  );
  const invalid = evaluate(systemId, invalidMarkers);
  assert.equal(invalid.scoreability, "incomplete");
  assert.deepEqual(invalid.score_readiness.reasons, [
    {
      code: "invalid",
      required_group: missingGroup.keys,
      present_keys: [missingGroup.keys[0]!],
    },
  ]);
  assert.equal(invalid.state_score, null);
}

const alternativeSystem = NAMED_BODY_SYSTEMS.find((systemId) =>
  getRegistryV2ScoreReadinessGroups(systemId).some((group) => group.length > 1),
)!;
const alternativeGroups = getRegistryV2ScoreReadinessGroups(alternativeSystem);
const alternativeGroup = alternativeGroups.find((group) => group.length > 1)!;
const alternativeMarkers = alternativeGroups.map((group) =>
  markerFor(group === alternativeGroup ? group[1]! : group[0]!),
);
const alternativeEvaluation = evaluate(alternativeSystem, alternativeMarkers);
assert.equal(alternativeEvaluation.scoreability, "scoreable");
assert.equal(
  alternativeEvaluation.score_readiness.required_groups.find(
    (group) =>
      group.keys.length === alternativeGroup.length &&
      group.keys.every((key, index) => key === alternativeGroup[index]),
  )?.satisfied_by,
  alternativeGroup[1],
  "one approved alternative satisfies its group",
);

const contextOnlyCardiovascular = evaluate("cardiovascular", [
  markerFor("total_cholesterol"),
]);
assert.equal(contextOnlyCardiovascular.scoreability, "incomplete");
assert.equal(contextOnlyCardiovascular.score_readiness.reasons.length, 3);
assert.ok(
  contextOnlyCardiovascular.score_readiness.reasons.every(
    (reason) => reason.code === "missing",
  ),
  "context-only cholesterol cannot satisfy cardiovascular readiness",
);
const incompleteProfile = buildHealthProfile(
  [observationFor(markerFor("ldl"))],
  [],
);
const namedIncompleteSystems = incompleteProfile.systems.filter(
  (system) => system.id !== "general",
);
assert.equal(namedIncompleteSystems.length, NAMED_BODY_SYSTEMS.length);
assert.ok(
  namedIncompleteSystems.every((system) => system.state_score === null),
);
assert.equal(incompleteProfile.overall_state_score, null);

const overallInputs = (
  ["cardiovascular", "metabolic", "thyroid"] as const
).flatMap((systemId) => completeMarkers(systemId).map(observationFor));
const scoreableProfile = buildHealthProfile(overallInputs, []);
assert.equal(scoreableProfile.scoreable_named_system_count, 3);
assert.notEqual(scoreableProfile.overall_state_score, null);
assert.equal(scoreableProfile.assessment_freshness, "current");

console.log("verify-eh143-readiness: all checks passed");
