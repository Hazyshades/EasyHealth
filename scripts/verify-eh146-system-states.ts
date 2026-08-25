import assert from "node:assert/strict";
import {
  assessmentDisplayStateDescription,
  assessmentDisplayStateLabel,
  resolveAssessmentDisplayState,
} from "../src/lib/health-profile-assessment-state";
import {
  assessmentStatusLabel,
  buildHealthProfile,
  stateScoreColor,
} from "../src/lib/health-systems";

const stateCases = [
  ["succeeded", true, "current"],
  ["succeeded", false, "processing"],
  ["queued", false, "processing"],
  ["processing", false, "processing"],
  ["queued", true, "outdated"],
  ["processing", true, "outdated"],
  ["retryable_failed", false, "error"],
  ["failed", true, "error"],
  [null, true, "current"],
  [null, false, "processing"],
] as const;

for (const [jobStatus, hasCurrentVersion, expected] of stateCases) {
  assert.equal(
    resolveAssessmentDisplayState(jobStatus, hasCurrentVersion),
    expected,
    `${jobStatus ?? "missing"} with ${hasCurrentVersion ? "" : "no "}version should be ${expected}`,
  );
}

for (const state of ["current", "processing", "outdated", "error"] as const) {
  assert.ok(assessmentDisplayStateLabel(state).length > 0);
  assert.match(assessmentDisplayStateDescription(state), /not a diagnosis or disease-risk score/);
}

assert.equal(stateScoreColor(null), "fill-slate-300 stroke-slate-400");
assert.equal(assessmentStatusLabel(null, 100), "Assessment unavailable");
assert.equal(assessmentStatusLabel(85, 100), "Stable");
assert.equal(assessmentStatusLabel(45, 100), "Needs attention");
assert.equal(assessmentStatusLabel(85, 20), "Limited data");

const sources = [
  {
    id: "eh146-state-fixture",
    original_filename: "EH146 synthetic lab.pdf",
    observed_at: "2026-08-23",
    lab_name: "Synthetic Laboratory",
  },
];

const incompleteProfile = buildHealthProfile(
  [
    {
      biomarker_key: "glucose",
      measurement_definition_key: "glucose_serum",
      name: "Glucose",
      value: 5.2,
      unit: "mmol/L",
      ref_low: 3.9,
      ref_high: 5.5,
      observed_at: "2026-08-23",
      document_id: sources[0].id,
      specimen: "serum",
    },
  ],
  sources,
);
const metabolic = incompleteProfile.systems.find((system) => system.id === "metabolic");
assert.ok(metabolic);
assert.equal(metabolic.state_score, null, "one marker must not become a partial system score");
assert.equal(metabolic.scoreability, "incomplete");
assert.equal(incompleteProfile.profile_display_state, "body_map");

const scoredProfile = buildHealthProfile(
  [
    {
      biomarker_key: "ldl",
      measurement_definition_key: "ldl_serum",
      name: "LDL",
      value: 90,
      unit: "mg/dL",
      ref_low: 0,
      ref_high: 100,
      observed_at: "2026-08-23",
      document_id: sources[0].id,
      specimen: "serum",
    },
    {
      biomarker_key: "hdl",
      measurement_definition_key: "hdl_serum",
      name: "HDL",
      value: 55,
      unit: "mg/dL",
      ref_low: 40,
      ref_high: 100,
      observed_at: "2026-08-23",
      document_id: sources[0].id,
      specimen: "serum",
    },
    {
      biomarker_key: "triglycerides",
      measurement_definition_key: "triglycerides_serum",
      name: "Triglycerides",
      value: 100,
      unit: "mg/dL",
      ref_low: 0,
      ref_high: 150,
      observed_at: "2026-08-23",
      document_id: sources[0].id,
      specimen: "serum",
    },
  ],
  sources,
);
const cardiovascular = scoredProfile.systems.find((system) => system.id === "cardiovascular");
assert.ok(cardiovascular);
assert.equal(cardiovascular.scoreability, "scoreable");
assert.notEqual(cardiovascular.state_score, null);

console.log("verify-eh146-system-states: all checks passed");
