import assert from "node:assert/strict";
import {
  LAUNCH_CATALOG_MIGRATION_RECORDS,
  MEASUREMENT_DEFINITIONS,
} from "../src/lib/biomarkers";
import { buildObservationUpsertPayload } from "../src/lib/documents/observation-identity";

const rawSource = {
  profile_id: "profile_1",
  document_id: "document_1",
  name: "Alanine aminotransferase (ALT)",
  value: 21,
  value_kind: "numeric",
  value_text: "21",
  ordinal: null,
  unit: "U/L",
  ref_low: 7,
  ref_high: 56,
  observed_at: "2025-09-09",
  specimen: "unspecified",
  modifier: "none",
  raw_name: "ALT (alanine aminotransferase)",
  source_page: 1,
  source_text: "ALT (alanine aminotransferase): 21 U/L",
  bounding_box: null,
  confidence: 0.9,
  reported_alt_value: null,
  reported_alt_unit: null,
  source_extracted_biomarker_id: "extracted_1",
  raw_value_text: null,
  raw_reference_text: null,
  raw_unit: null,
  extraction_version: null,
  provenance_schema_version: "1",
  catalog_manifest_version: null,
  catalog_manifest_digest: null,
  resolver_version: null,
  normalization_version: null,
};

const cases = [
  {
    name: "resolved",
    resolution: {
      result: "resolved" as const,
      analyteKey: "alt",
      measurementDefinitionKey: "alt_serum_catalytic_activity",
    },
    expected: {
      analyte_key: "alt",
      measurement_definition_key: "alt_serum_catalytic_activity",
      resolution_status: "resolved",
    },
  },
  {
    name: "partial",
    resolution: {
      result: "partial" as const,
      analyteKey: "alt",
      measurementDefinitionKey: null,
    },
    expected: {
      analyte_key: "alt",
      measurement_definition_key: null,
      resolution_status: "partial",
    },
  },
  {
    name: "ambiguous",
    resolution: {
      result: "ambiguous" as const,
      analyteKey: "glucose",
      measurementDefinitionKey: null,
    },
    expected: {
      analyte_key: "glucose",
      measurement_definition_key: null,
      resolution_status: "ambiguous",
    },
  },
  {
    name: "unmapped",
    resolution: {
      result: "unmapped" as const,
      analyteKey: null,
      measurementDefinitionKey: null,
    },
    expected: {
      analyte_key: null,
      measurement_definition_key: null,
      resolution_status: "unmapped",
    },
  },
] as const;

for (const testCase of cases) {
  const payload = buildObservationUpsertPayload(rawSource, testCase.resolution);
  assert.equal(payload.profile_id, rawSource.profile_id);
  assert.equal(payload.document_id, rawSource.document_id);
  assert.equal(payload.name, rawSource.name);
  assert.equal(payload.raw_name, rawSource.raw_name);
  assert.equal(payload.unit, rawSource.unit);
  assert.equal(payload.source_extracted_biomarker_id, rawSource.source_extracted_biomarker_id);
  assert.deepEqual(
    {
      analyte_key: payload.analyte_key,
      measurement_definition_key: payload.measurement_definition_key,
      resolution_status: payload.resolution_status,
    },
    testCase.expected
  );
}

const reviewedBindings = MEASUREMENT_DEFINITIONS.filter((definition) =>
  definition.assessmentBindings.some(
    (binding) => binding.status === "reviewed" && binding.compatibility === "compatible"
  )
);
const provisionalBindings = MEASUREMENT_DEFINITIONS.filter((definition) =>
  definition.assessmentBindings.some(
    (binding) => binding.status === "provisional" && binding.compatibility === "compatible"
  )
);
const legacyScoreRoles = LAUNCH_CATALOG_MIGRATION_RECORDS.reduce(
  (counts, record) => {
    counts[record.scoreRole] += 1;
    return counts;
  },
  { core: 0, extended: 0, display: 0 } as Record<"core" | "extended" | "display", number>
);

assert.ok(reviewedBindings.length > 0);
assert.ok(provisionalBindings.length > 0);

console.log("observation-identity: all checks passed");
console.log(
  `assessment-impact: legacy core=${legacyScoreRoles.core}, extended=${legacyScoreRoles.extended}, display=${legacyScoreRoles.display}`
);
console.log(
  `assessment-impact: reviewed bindings=${reviewedBindings.length} on ${reviewedBindings
    .map((definition) => definition.key)
    .join(", ")}`
);
console.log(
  `assessment-impact: provisional bindings=${provisionalBindings.length} on ${provisionalBindings
    .map((definition) => definition.key)
    .join(", ")}`
);
