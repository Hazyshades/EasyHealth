import assert from "node:assert/strict";
import { MEASUREMENT_DEFINITIONS } from "../src/lib/biomarkers";
import { projectHealthProfileLaboratoryInput } from "../src/lib/health-profile-input";
import { buildHealthProfile } from "../src/lib/health-systems";

const source = {
  id: "fixture-document",
  original_filename: "fixture.pdf",
  observed_at: "2026-08-01",
  lab_name: "Fixture laboratory",
  document_type: "lab_result",
};

function observation(overrides: Record<string, unknown> = {}) {
  return {
    observation_kind: "lab" as const,
    measurement_definition_key: "glucose_serum",
    resolution_status: "resolved",
    name: "Glucose",
    value: 90,
    unit: "mg/dL",
    ref_low: 70,
    ref_high: 99,
    raw_reference_text: "70–99",
    observed_at: "2026-08-01",
    document_id: "fixture-document",
    value_kind: "numeric",
    value_text: "90",
    ordinal: null,
    specimen: "serum",
    modifier: "none",
    ...overrides,
  };
}

function revision(overrides: Record<string, unknown> = {}) {
  return {
    resolver_result: "resolved",
    verification_status: "user_verified",
    measurement_definition_key: "glucose_serum",
    is_active: true,
    resolver_evidence: {
      version: 2,
      selectedCandidateKey: "glucose_serum",
      outcome: "resolved",
    },
    ...overrides,
  };
}

const project = (observationOverrides: Record<string, unknown> = {}, relationOverrides: Record<string, unknown> = {}) =>
  projectHealthProfileLaboratoryInput({
    observation: observation(observationOverrides),
    relation: revision(relationOverrides),
    labUnitSystem: "si",
  });

const resolved = project();
assert.deepEqual(resolved, {
  biomarker_key: "glucose",
  measurement_definition_key: "glucose_serum",
  name: "Glucose",
  value: 5,
  unit: "mmol/L",
  ref_low: 3.89,
  ref_high: 5.49,
  observed_at: "2026-08-01",
  document_id: "fixture-document",
  observation_kind: "lab",
  value_kind: "numeric",
  value_text: "90",
  ordinal: null,
  specimen: "serum",
  modifier: "none",
  converted: true,
  conversion_note: "Converted for display · Original: 90 mg/dL",
  original_value: 90,
  original_unit: "mg/dL",
});

for (const [name, relationOverrides] of [
  ["partial", { resolver_result: "partial", verification_status: "pending", resolver_evidence: { version: 2, selectedCandidateKey: "glucose_serum", outcome: "partial" } }],
  ["ambiguous", { resolver_result: "ambiguous", verification_status: "pending", resolver_evidence: { version: 2, selectedCandidateKey: "glucose_serum", outcome: "ambiguous" } }],
  ["unmapped", { resolver_result: "unmapped", verification_status: "pending", measurement_definition_key: null, resolver_evidence: { version: 2, selectedCandidateKey: null, outcome: "unmapped" } }],
  ["no active revision", { is_active: false }],
  ["trace mismatch", { resolver_evidence: { version: 2, selectedCandidateKey: "alt_serum_catalytic_activity", outcome: "resolved" } }],
] as const) {
  assert.equal(project({}, relationOverrides), null, `${name} must not enter Health Profile`);
}

assert.equal(project({ observation_kind: "instrumental" }), null, "non-laboratory observations must not enter Health Profile");
const provisional = MEASUREMENT_DEFINITIONS.find((definition) => definition.maturity === "provisional")!;
assert.equal(
  project(
    { measurement_definition_key: provisional.key, specimen: provisional.specimen },
    { measurement_definition_key: provisional.key, resolver_evidence: { version: 2, selectedCandidateKey: provisional.key, outcome: "resolved" } },
  ),
  null,
  "a synthetic resolved revision cannot make a provisional definition eligible",
);
const assessmentIneligible = MEASUREMENT_DEFINITIONS.find(
  (definition) => definition.maturity === "reviewed" && definition.assessmentBindings.length === 0,
)!;
assert.equal(
  project(
    { measurement_definition_key: assessmentIneligible.key, specimen: assessmentIneligible.specimen },
    { measurement_definition_key: assessmentIneligible.key, resolver_evidence: { version: 2, selectedCandidateKey: assessmentIneligible.key, outcome: "resolved" } },
  ),
  null,
  "a reviewed definition without a compatible assessment binding must not enter Health Profile",
);

assert.equal(
  project({ value: null, unit: "positive", value_kind: "qualitative", value_text: "positive" }),
  null,
  "qualitative results must not enter Health Profile assessment input",
);
assert.equal(
  project({ ref_low: null, ref_high: null }),
  null,
  "a result without a usable source reference range must not enter Health Profile assessment input",
);

const profile = buildHealthProfile(resolved ? [resolved] : [], [source]);
assert.equal(profile.records_used_count, 1);
assert.equal(profile.biomarker_observation_count, 1);
assert.equal(profile.profile_display_state, "body_map");
assert.deepEqual(profile.sources, [source]);
assert.equal(profile.systems.flatMap((system) => system.markers).filter((marker) => marker.measurement_definition_key === "glucose_serum").length, 1);

console.log("verify-health-profile-lab-input: all checks passed");
