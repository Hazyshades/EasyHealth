import assert from "node:assert/strict";
import {
  getRegistryV2ExpectedSpecimen,
  getRegistryV2ScoreReadinessGroups,
  NAMED_BODY_SYSTEMS,
} from "../src/lib/biomarkers/registry-v2-runtime";
import type { NamedBodySystemId } from "../src/lib/biomarkers/types";
import {
  computeSystemStateScore,
  evaluateSystemScoreReadiness,
  type SystemMarker,
} from "../src/lib/health-systems";

const APPROVED_GROUPS: Record<NamedBodySystemId, readonly (readonly string[])[]> = {
  cardiovascular: [["ldl", "non_hdl_cholesterol"], ["hdl"], ["triglycerides"]],
  metabolic: [["fasting_glucose", "hba1c"]],
  thyroid: [["tsh"], ["free_t4"]],
  liver: [["alt"], ["ast"], ["alp"], ["bilirubin"], ["albumin"]],
  kidney: [["egfr", "creatinine"], ["uacr"]],
  blood: [["hemoglobin", "hematocrit"], ["wbc"], ["platelets"], ["mcv"]],
  nutrients: [["vitamin_d"], ["b12"], ["folate"]],
  inflammation: [],
};

const CONTEXT_ONLY_INPUTS: Partial<Record<NamedBodySystemId, readonly string[]>> = {
  cardiovascular: ["total_cholesterol"],
  metabolic: ["glucose"],
  liver: ["ggt"],
  kidney: ["bun", "urea", "sodium", "potassium", "chloride", "bicarbonate", "calcium"],
  blood: ["rbc", "rdw"],
  inflammation: ["crp"],
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
    observed_at: "2026-01-01",
    document_id: null,
    source: null,
    value_kind: "numeric",
    specimen: getRegistryV2ExpectedSpecimen(key) ?? "unspecified",
    modifier: "none",
  };
}


for (const system of NAMED_BODY_SYSTEMS) {
  assert.deepEqual(
    getRegistryV2ScoreReadinessGroups(system),
    APPROVED_GROUPS[system],
    `${system} readiness groups must match the approved EH-141 policy`
  );
}

for (const system of NAMED_BODY_SYSTEMS.filter((candidate) => candidate !== "inflammation")) {
  const groups = APPROVED_GROUPS[system];
  const complete = groups.map((group) => usableMarker(group[0]!));

  assert.equal(
    evaluateSystemScoreReadiness(system, complete).scoreability,
    "scoreable",
    `${system} must be scoreable when every approved group is usable`
  );
  assert.notEqual(computeSystemStateScore(system, complete), null);

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const incomplete = complete.filter((_, index) => index !== groupIndex);
    assert.equal(
      evaluateSystemScoreReadiness(system, incomplete).scoreability,
      "incomplete",
      `${system} must remain incomplete when required group ${groupIndex + 1} is absent`
    );
    assert.equal(computeSystemStateScore(system, incomplete), null);

    const noReference = complete.map((marker, index) =>
      index === groupIndex ? usableMarker(marker.key, false) : marker
    );
    assert.equal(
      evaluateSystemScoreReadiness(system, noReference).scoreability,
      "incomplete",
      `${system} must not accept a required group without a document reference`
    );

    for (const alternative of groups[groupIndex]!) {
      const withAlternative = complete.map((marker, index) =>
        index === groupIndex ? usableMarker(alternative) : marker
      );
      assert.equal(
        evaluateSystemScoreReadiness(system, withAlternative).scoreability,
        "scoreable",
        `${system} must accept approved alternative ${alternative}`
      );
    }
  }

  for (const contextOnly of CONTEXT_ONLY_INPUTS[system] ?? []) {
    const contextOnlyMarkers = [usableMarker(contextOnly)];
    assert.equal(
      evaluateSystemScoreReadiness(system, contextOnlyMarkers).scoreability,
      "incomplete",
      `${system} context-only input ${contextOnly} must not satisfy readiness`
    );
    assert.equal(computeSystemStateScore(system, contextOnlyMarkers), null);
  }
}

const inflammationMarkers = [usableMarker("crp")];
assert.equal(evaluateSystemScoreReadiness("inflammation", inflammationMarkers).scoreability, "non_scoreable");
assert.equal(computeSystemStateScore("inflammation", inflammationMarkers), null);

console.log("verify-eh141-score-required-groups: all checks passed");
