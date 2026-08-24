import assert from "node:assert/strict";
import {
  buildHealthProfile,
  HEALTH_PROFILE_SCORE_ALGORITHM_VERSION,
  type ObservationInput,
  type ScoreExclusion,
} from "../src/lib/health-systems";
import { buildSourceRegion } from "../src/lib/documents/source-region";

const source = {
  id: "eh145-fixture-document",
  original_filename: "eh145-fixture.pdf",
  observed_at: "2026-08-01",
  lab_name: "Synthetic laboratory",
  document_type: "lab_result",
};

const exactRegion = buildSourceRegion({
  page: 2,
  bbox: { x: 0.1, y: 0.2, w: 0.2, h: 0.02 },
  match: {
    strategy: "exact",
    score: 1,
    engine: "pdf-text-bbox",
    resolver_version: "eh145-fixture",
  },
});
assert.ok(exactRegion, "fixture source region should be valid");

function observation(overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    observation_id: "obs-hba1c",
    biomarker_key: "hba1c",
    measurement_definition_key: "hba1c_whole_blood",
    resolution_status: "resolved",
    name: "Hemoglobin A1c",
    value: 5.4,
    unit: "%",
    ref_low: 4,
    ref_high: 5.6,
    observed_at: "2026-08-01",
    document_id: source.id,
    observation_kind: "lab",
    value_kind: "numeric",
    value_text: "5.4",
    specimen: "whole_blood",
    modifier: "none",
    source_page: 2,
    source_text: "Hemoglobin A1c 5.4 % 4.0-5.6",
    source_region: exactRegion,
    ...overrides,
  };
}

const glucose = observation({
  observation_id: "obs-glucose",
  biomarker_key: "glucose",
  measurement_definition_key: "glucose_serum",
  name: "Glucose",
  value: 90,
  unit: "mg/dL",
  ref_low: 70,
  ref_high: 99,
  specimen: "serum",
  source_page: 1,
  source_text: "Glucose 90 mg/dL 70-99",
  source_region: null,
});

const preProjectionExclusion: ScoreExclusion = {
  observation_id: "obs-unmapped",
  system_id: "general",
  key: "mystery_result",
  measurement_definition_key: null,
  name: "Unmapped result",
  value: null,
  value_text: "pending",
  unit: "",
  ref_low: null,
  ref_high: null,
  status: "unknown",
  observed_at: "2026-08-01",
  document_id: source.id,
  source,
  source_page: 3,
  source_text: "Unmapped result pending review",
  source_region: null,
  reason: "incomplete_resolution",
  reason_detail: "axis_not_stated",
  contribution_group: null,
};

const profile = buildHealthProfile(
  [observation(), glucose],
  [source],
  { excludedObservations: [preProjectionExclusion] },
);
const metabolic = profile.systems.find((system) => system.id === "metabolic");
assert.ok(metabolic, "metabolic system should be rendered");
assert.equal(profile.score_algorithm_version, HEALTH_PROFILE_SCORE_ALGORITHM_VERSION);
assert.equal(metabolic.score_provenance.algorithm_version, HEALTH_PROFILE_SCORE_ALGORITHM_VERSION);
assert.equal(metabolic.score_readiness.required_groups[0]?.status, "satisfied");
assert.deepEqual(
  metabolic.score_provenance.contributors.map((item) => item.key),
  ["glucose"],
  "the readiness/contribution winner is the only contributor",
);
assert.equal(metabolic.score_provenance.contributors[0]?.contribution_group, "glycemia");
assert.equal(metabolic.score_provenance.contributors[0]?.source_page, 1);
assert.equal(
  metabolic.score_provenance.excluded.find((item) => item.key === "hba1c")?.reason,
  "duplicate_contribution_group",
);
assert.equal(metabolic.score_provenance.excluded.find((item) => item.key === "hba1c")?.source_page, 2);
assert.equal(
  metabolic.score_provenance.excluded.find((item) => item.key === "hba1c")?.source_region?.match.strategy,
  "exact",
);
assert.ok(
  profile.score_provenance.excluded_observations.some(
    (item) => item.observation_id === "obs-unmapped" && item.reason === "incomplete_resolution",
  ),
  "pre-projection exclusions remain visible at profile level",
);

const incompleteProfile = buildHealthProfile([glucose], [source]);
const incompleteMetabolic = incompleteProfile.systems.find((system) => system.id === "metabolic");
assert.ok(incompleteMetabolic, "metabolic placeholder should remain visible");
assert.equal(incompleteMetabolic.state_score, null);
assert.equal(
  incompleteMetabolic.score_provenance.contributors.length,
  0,
  "a null score has no contributors",
);
assert.equal(
  incompleteMetabolic.score_provenance.excluded[0]?.reason,
  "score_not_available",
);

console.log("verify-eh145-score-provenance: all checks passed");
