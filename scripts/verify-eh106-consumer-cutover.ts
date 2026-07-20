import assert from "node:assert/strict";
import {
  hasResolvedLaboratoryDefinition,
  isLaboratoryObservation,
} from "../src/lib/documents/observation-read-boundaries";
import { buildReportContext, isAbnormalObservation } from "../src/lib/reports";

assert.equal(
  hasResolvedLaboratoryDefinition({
    observation_kind: "lab",
    resolution_status: "resolved",
    measurement_definition_key: "alt_serum_catalytic_activity",
  }),
  true
);
assert.equal(
  hasResolvedLaboratoryDefinition({
    observation_kind: "lab",
    resolution_status: "partial",
    measurement_definition_key: null,
  }),
  false
);
assert.equal(
  hasResolvedLaboratoryDefinition({
    observation_kind: "instrumental",
    resolution_status: "resolved",
    measurement_definition_key: "alt_serum_catalytic_activity",
  }),
  false
);
assert.equal(isLaboratoryObservation({ observation_kind: "instrumental" }), false);

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
