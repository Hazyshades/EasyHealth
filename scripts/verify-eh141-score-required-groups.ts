import assert from "node:assert/strict";
import { getReviewedAssessmentBinding } from "../src/lib/biomarkers";
import {
  getRegistryV2ExpectedSpecimen,
  getRegistryV2ScoreReadinessGroups,
  getRegistryV2System,
  NAMED_BODY_SYSTEMS,
} from "../src/lib/biomarkers/registry-v2-runtime";
import type { NamedBodySystemId } from "../src/lib/biomarkers/types";
import {
  evaluateHealthProfileScorePolicy,
  REGISTRY_V2_SCORE_READINESS_CONTEXT,
  type AssessmentCandidate,
} from "../src/lib/health-profile-score-policy";
import {
  HEALTH_PROFILE_FRESHNESS_POLICY,
  type HealthProfileFreshnessPolicy,
} from "../src/lib/health-profile-freshness";
import type { SystemMarker } from "../src/lib/health-systems";

const APPROVED_GROUPS: Record<
  NamedBodySystemId,
  readonly (readonly string[])[]
> = {
  cardiovascular: [["ldl", "non_hdl_cholesterol"], ["hdl"], ["triglycerides"]],
  metabolic: [["fasting_glucose", "hba1c"]],
  thyroid: [["tsh"], ["free_t4"]],
  liver: [["alt"], ["ast"], ["alp"], ["bilirubin"], ["albumin"]],
  kidney: [["egfr", "creatinine"], ["uacr"]],
  blood: [["hemoglobin", "hematocrit"], ["wbc"], ["platelets"], ["mcv"]],
  nutrients: [["vitamin_d"], ["b12"], ["folate"]],
  inflammation: [],
};

const CONTEXT_ONLY_INPUTS: Partial<
  Record<NamedBodySystemId, readonly string[]>
> = {
  cardiovascular: ["total_cholesterol"],
  metabolic: ["glucose"],
  liver: ["ggt"],
  kidney: [
    "bun",
    "urea",
    "sodium",
    "potassium",
    "chloride",
    "bicarbonate",
    "calcium",
  ],
  blood: ["rbc", "rdw"],
  inflammation: ["crp"],
};

const POLICY_CONTEXT = {
  asOf: "2026-01-01",
  evaluatedAt: "2026-01-01T00:00:00.000Z",
  freshnessPolicy:
    HEALTH_PROFILE_FRESHNESS_POLICY satisfies HealthProfileFreshnessPolicy,
  registry: REGISTRY_V2_SCORE_READINESS_CONTEXT,
};

function usableMarker(key: string, hasReference = true): SystemMarker {
  return {
    key,
    name: key,
    value: 1,
    unit: "unit",
    ref_low: hasReference ? 0 : null,
    ref_high: hasReference ? 2 : null,
    status: hasReference ? "in_range" : "unknown",
    freshness_status: "current",
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    value_kind: "numeric",
    specimen: getRegistryV2ExpectedSpecimen(key) ?? "unspecified",
    modifier: "none",
  };
}

function candidateFor(marker: SystemMarker): AssessmentCandidate {
  const binding = getReviewedAssessmentBinding(marker.key);
  assert.ok(binding, `expected reviewed assessment binding for ${marker.key}`);
  return {
    observation: {
      biomarker_key: marker.key,
      measurement_definition_key: binding.definition.key,
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
      value_text: marker.value_text,
      specimen: marker.specimen,
      modifier: marker.modifier,
    },
    system_id: getRegistryV2System(marker.key),
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

function evaluate(systemId: NamedBodySystemId, markers: SystemMarker[]) {
  const result = evaluateHealthProfileScorePolicy(
    markers.map(candidateFor),
    POLICY_CONTEXT,
  ).systems.find((system) => system.id === systemId);
  assert.ok(result, `expected ${systemId} policy result`);
  return result;
}

for (const system of NAMED_BODY_SYSTEMS) {
  assert.deepEqual(
    getRegistryV2ScoreReadinessGroups(system),
    APPROVED_GROUPS[system],
    `${system} readiness groups must match the approved EH-141 policy`,
  );
}

for (const system of NAMED_BODY_SYSTEMS.filter(
  (candidate) => candidate !== "inflammation",
)) {
  const groups = APPROVED_GROUPS[system];
  const complete = groups.map((group) => usableMarker(group[0]!));
  const completeResult = evaluate(system, complete);

  assert.equal(
    completeResult.scoreability,
    "scoreable",
    `${system} must be scoreable when every approved group is usable`,
  );
  assert.notEqual(completeResult.state_score, null);

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const incomplete = complete.filter((_, index) => index !== groupIndex);
    const incompleteForEvaluation =
      incomplete.length > 0
        ? incomplete
        : [usableMarker(CONTEXT_ONLY_INPUTS[system]?.[0] ?? "glucose")];
    const incompleteResult = evaluate(system, incompleteForEvaluation);
    assert.equal(
      incompleteResult.scoreability,
      "incomplete",
      `${system} must remain incomplete when required group ${groupIndex + 1} is absent`,
    );
    assert.equal(incompleteResult.state_score, null);

    const noReference = complete.map((marker, index) =>
      index === groupIndex ? usableMarker(marker.key, false) : marker,
    );
    assert.equal(
      evaluate(system, noReference).scoreability,
      "incomplete",
      `${system} must not accept a required group without a document reference`,
    );

    for (const alternative of groups[groupIndex]!) {
      const withAlternative = complete.map((marker, index) =>
        index === groupIndex ? usableMarker(alternative) : marker,
      );
      assert.equal(
        evaluate(system, withAlternative).scoreability,
        "scoreable",
        `${system} must accept approved alternative ${alternative}`,
      );
    }
  }

  for (const contextOnly of CONTEXT_ONLY_INPUTS[system] ?? []) {
    const contextOnlyResult = evaluate(system, [usableMarker(contextOnly)]);
    assert.equal(
      contextOnlyResult.scoreability,
      "incomplete",
      `${system} context-only input ${contextOnly} must not satisfy readiness`,
    );
    assert.equal(contextOnlyResult.state_score, null);
  }

  for (const contextOnly of CONTEXT_ONLY_INPUTS[system] ?? []) {
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const swapped = complete.map((marker, index) =>
        index === groupIndex ? usableMarker(contextOnly) : marker,
      );
      const swappedResult = evaluate(system, swapped);
      assert.equal(
        swappedResult.scoreability,
        "incomplete",
        `${system} context-only input ${contextOnly} must not replace required group ${groupIndex + 1}`,
      );
      assert.equal(swappedResult.state_score, null);
    }
  }
}

const inflammationResult = evaluate("inflammation", [usableMarker("crp")]);
assert.equal(inflammationResult.scoreability, "non_scoreable");
assert.equal(inflammationResult.state_score, null);

console.log("verify-eh141-score-required-groups: all checks passed");
