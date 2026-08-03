import assert from "node:assert/strict";
import {
  isLaboratoryObservation,
  projectActiveRegistryV2LaboratoryBinding,
} from "../src/lib/documents/observation-read-boundaries";
import { buildHealthProfile } from "../src/lib/health-systems";
import { buildReportContext, isAbnormalObservation } from "../src/lib/reports";
const resolverEvidence = (
  selectedCandidateKey: string | null,
  outcome: "resolved" | "partial" | "ambiguous" | "unmapped"
) => ({ selectedCandidateKey, outcome });

assert.equal(isLaboratoryObservation({ observation_kind: "instrumental" }), false);

const reviewedResolved = projectActiveRegistryV2LaboratoryBinding(
  {
    observation_kind: "lab",
    measurement_definition_key: "alt_serum_catalytic_activity",
    resolution_status: "resolved",
  },
  {
    is_active: true,
    resolver_result: "resolved",
    verification_status: "user_verified",
    measurement_definition_key: "alt_serum_catalytic_activity",
    resolver_evidence: resolverEvidence("alt_serum_catalytic_activity", "resolved"),
  }
);
assert.equal(reviewedResolved.registryBindingReady, true);
assert.equal(reviewedResolved.measurementDefinitionKey, "alt_serum_catalytic_activity");
assert.equal(reviewedResolved.verificationStatus, "user_verified");

for (const result of ["partial", "ambiguous", "unmapped"] as const) {
  const incomplete = projectActiveRegistryV2LaboratoryBinding(
    {
      observation_kind: "lab",
      measurement_definition_key: null,
      resolution_status: result,
    },
    {
      is_active: true,
      resolver_result: result,
      verification_status: "pending",
      measurement_definition_key: null,
      resolver_evidence: resolverEvidence(null, result),
    }
  );
  assert.equal(incomplete.resolutionStatus, result);
  assert.equal(incomplete.measurementDefinitionKey, null);
  assert.equal(incomplete.registryBindingReady, false);
}

const provisional = projectActiveRegistryV2LaboratoryBinding(
  {
    observation_kind: "lab",
    measurement_definition_key: "sample_alt_sample",
    resolution_status: "resolved",
  },
  {
    is_active: true,
    resolver_result: "resolved",
    verification_status: "pending",
    measurement_definition_key: "sample_alt_sample",
    resolver_evidence: resolverEvidence("sample_alt_sample", "resolved"),
  }
);
assert.equal(provisional.measurementDefinition, undefined);
assert.equal(provisional.measurementDefinitionKey, null);
assert.equal(provisional.resolvedMeasurementBinding, null);
assert.equal(provisional.registryBindingReady, false);

const noActiveRevision = projectActiveRegistryV2LaboratoryBinding(
  {
    observation_kind: "lab",
    measurement_definition_key: "alt_serum_catalytic_activity",
    resolution_status: "resolved",
  },
  {
    is_active: false,
    resolver_result: "resolved",
    verification_status: "user_verified",
    measurement_definition_key: "alt_serum_catalytic_activity",
    resolver_evidence: resolverEvidence("alt_serum_catalytic_activity", "resolved"),
  }
);
assert.equal(noActiveRevision.activeRevision, null);
assert.equal(noActiveRevision.measurementDefinitionKey, null);
assert.equal(noActiveRevision.registryBindingReady, false);

const activeRevisionWins = projectActiveRegistryV2LaboratoryBinding(
  {
    observation_kind: "lab",
    measurement_definition_key: "alt_serum_catalytic_activity",
    resolution_status: "resolved",
  },
  [
    {
      is_active: false,
      resolver_result: "resolved",
      verification_status: "user_verified",
      measurement_definition_key: "alt_serum_catalytic_activity",
      resolver_evidence: resolverEvidence("alt_serum_catalytic_activity", "resolved"),
    },
    {
      is_active: true,
      resolver_result: "partial",
      verification_status: "pending",
      measurement_definition_key: null,
      resolver_evidence: resolverEvidence(null, "partial"),
    },
  ]
);
assert.equal(activeRevisionWins.resolutionStatus, "partial");
assert.equal(activeRevisionWins.measurementDefinitionKey, null);
assert.equal(activeRevisionWins.registryBindingReady, false);

const instrumental = projectActiveRegistryV2LaboratoryBinding(
  {
    observation_kind: "instrumental",
    measurement_definition_key: "alt_serum_catalytic_activity",
    resolution_status: "resolved",
  },
  {
    is_active: true,
    resolver_result: "resolved",
    verification_status: "user_verified",
    measurement_definition_key: "alt_serum_catalytic_activity",
    resolver_evidence: resolverEvidence("alt_serum_catalytic_activity", "resolved"),
  }
);
assert.equal(instrumental.registryBindingReady, false);

const healthProfileInput = {
  biomarker_key: "glucose",
  name: "Glucose",
  value: 5.2,
  unit: "mmol/L",
  ref_low: 3.9,
  ref_high: 5.5,
  observed_at: "2026-07-20",
  document_id: null,
  observation_kind: "lab" as const,
  resolution_status: "resolved" as const,
};
assert.equal(
  buildHealthProfile([
    { ...healthProfileInput, measurement_definition_key: null },
  ], []).biomarker_observation_count,
  0,
  "a key-only observation must not enter assessment without a reviewed Registry 2.0 definition"
);
assert.equal(
  buildHealthProfile([
    { ...healthProfileInput, measurement_definition_key: "sample_alt_sample" },
  ], []).biomarker_observation_count,
  0,
  "a provisional Registry definition must not enter assessment"
);
assert.equal(
  buildHealthProfile([
    { ...healthProfileInput, measurement_definition_key: "glucose_serum" },
  ], []).biomarker_observation_count,
  1,
  "a reviewed Registry 2.0 definition remains assessment eligible"
);

assert.equal(
  isAbnormalObservation({
    value: 100,
    ref_low: 0,
    ref_high: 10,
    registry_binding_ready: false,
  }),
  false
);
assert.equal(
  isAbnormalObservation({
    value: 100,
    ref_low: 0,
    ref_high: 10,
    registry_binding_ready: true,
  }),
  true
);

const [partial] = buildReportContext([
  {
    name: "ALT",
    analyte_key: "alt",
    measurement_definition_key: null,
    resolution_status: "partial",
    verification_status: "pending",
    registry_binding_ready: false,
    value_kind: "numeric",
    value_text: "21",
    value: 21,
    unit: "U/L",
    ref_low: null,
    ref_high: null,
    observed_at: "2026-01-01",
    documents: { original_filename: "partial-alt.pdf", observed_at: "2026-01-01" },
  },
]);

assert.equal(partial.registry_binding_ready, false);
assert.equal(partial.resolution_status, "partial");
assert.equal(partial.value_text, "21");
assert.equal(partial.source, "partial-alt.pdf");

console.log("verify-eh106-consumer-cutover: all checks passed");
