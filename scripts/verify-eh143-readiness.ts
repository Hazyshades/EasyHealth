import assert from "node:assert/strict";
import {
  getRegistryV2ScoreReadinessGroups,
  getReviewedAssessmentBinding,
} from "../src/lib/biomarkers";
import { NAMED_BODY_SYSTEMS } from "../src/lib/biomarkers/registry-v2-runtime";
import {
  buildHealthProfile,
  computeSystemStateScore,
  evaluateSystemScoreReadiness,
  suppressOutdatedHealthProfileAssessment,
  type ObservationInput,
  type SystemMarker,
} from "../src/lib/health-systems";

const OBSERVED_AT = "2026-08-01";

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
    observed_at: OBSERVED_AT,
    document_id: null,
    source: null,
    score_role: binding.binding.scoreRole,
    value_kind: "numeric",
    specimen: binding.definition.specimen,
    modifier: "none",
  };
}

function completeMarkers(systemId: (typeof NAMED_BODY_SYSTEMS)[number]): SystemMarker[] {
  return getRegistryV2ScoreReadinessGroups(systemId).map((group) => markerFor(group[0]!));
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

for (const systemId of NAMED_BODY_SYSTEMS) {
  if (systemId === "inflammation") {
    const evaluation = evaluateSystemScoreReadiness(systemId, []);
    assert.equal(evaluation.scoreability, "non_scoreable");
    assert.equal(computeSystemStateScore(systemId, []), null);
    continue;
  }

  const markers = completeMarkers(systemId);
  const evaluation = evaluateSystemScoreReadiness(systemId, markers);
  assert.equal(evaluation.scoreability, "scoreable", `${systemId} needs every required group`);
  assert.deepEqual(evaluation.readiness.reasons, [], `${systemId} has no readiness reason when complete`);
  assert.notEqual(
    computeSystemStateScore(systemId, markers, evaluation),
    null,
    `${systemId} can produce a score only after complete readiness`,
  );

  const missingGroup = evaluation.readiness.required_groups[0]!;
  const missingMarkers = markers.filter((marker) => !missingGroup.keys.includes(marker.key));
  const missing = evaluateSystemScoreReadiness(systemId, missingMarkers);
  assert.equal(missing.scoreability, "incomplete");
  assert.deepEqual(missing.readiness.reasons, [{
    code: "missing",
    required_group: missingGroup.keys,
    present_keys: [],
  }]);
  assert.equal(computeSystemStateScore(systemId, missingMarkers, missing), null);

  const invalidMarkers = markers.map((marker) =>
    missingGroup.keys.includes(marker.key)
      ? { ...marker, ref_low: null, ref_high: null, status: "unknown" as const }
      : marker,
  );
  const invalid = evaluateSystemScoreReadiness(systemId, invalidMarkers);
  assert.equal(invalid.scoreability, "incomplete");
  assert.deepEqual(invalid.readiness.reasons, [{
    code: "invalid",
    required_group: missingGroup.keys,
    present_keys: [missingGroup.keys[0]!],
  }]);
  assert.equal(computeSystemStateScore(systemId, invalidMarkers, invalid), null);
}

const alternativeSystem = NAMED_BODY_SYSTEMS.find((systemId) =>
  getRegistryV2ScoreReadinessGroups(systemId).some((group) => group.length > 1),
)!;
const alternativeGroups = getRegistryV2ScoreReadinessGroups(alternativeSystem);
const alternativeGroup = alternativeGroups.find((group) => group.length > 1)!;
const alternativeMarkers = alternativeGroups.map((group) =>
  markerFor(group === alternativeGroup ? group[1]! : group[0]!),
);
const alternativeEvaluation = evaluateSystemScoreReadiness(alternativeSystem, alternativeMarkers);
assert.equal(alternativeEvaluation.scoreability, "scoreable");
assert.equal(
  alternativeEvaluation.readiness.required_groups.find((group) =>
    group.keys.length === alternativeGroup.length &&
    group.keys.every((key, index) => key === alternativeGroup[index])
  )?.satisfied_by,
  alternativeGroup[1],
  "one approved alternative satisfies its group",
);

const contextOnlyCardiovascular = evaluateSystemScoreReadiness("cardiovascular", [
  markerFor("total_cholesterol"),
]);
assert.equal(contextOnlyCardiovascular.scoreability, "incomplete");
assert.equal(contextOnlyCardiovascular.readiness.reasons.length, 3);
assert.ok(
  contextOnlyCardiovascular.readiness.reasons.every((reason) => reason.code === "missing"),
  "context-only cholesterol cannot satisfy cardiovascular readiness",
);

const incompleteProfile = buildHealthProfile([observationFor(markerFor("ldl"))], []);
const namedIncompleteSystems = incompleteProfile.systems.filter((system) => system.id !== "general");
assert.equal(namedIncompleteSystems.length, NAMED_BODY_SYSTEMS.length);
assert.ok(namedIncompleteSystems.every((system) => system.state_score === null));
assert.equal(incompleteProfile.overall_state_score, null);

const overallInputs = (["cardiovascular", "metabolic", "thyroid"] as const).flatMap((systemId) =>
  completeMarkers(systemId).map(observationFor),
);
const scoreableProfile = buildHealthProfile(overallInputs, []);
assert.equal(scoreableProfile.scoreable_named_system_count, 3);
assert.notEqual(scoreableProfile.overall_state_score, null);

const outdatedProfile = suppressOutdatedHealthProfileAssessment(scoreableProfile);
assert.equal(outdatedProfile.assessment_freshness, "outdated");
assert.equal(outdatedProfile.overall_state_score, null);
assert.ok(
  outdatedProfile.systems
    .filter((system) => system.id !== "general")
    .every(
      (system) =>
        system.state_score === null &&
        system.score_readiness.reasons.some((reason) => reason.code === "outdated"),
    ),
  "outdated assessment snapshots suppress every named-system score",
);

console.log("verify-eh143-readiness: all checks passed");
