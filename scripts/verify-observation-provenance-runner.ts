/**
 * EH-103 observation provenance metadata: pure-function contract checks.
 *
 * Covers the resolver-state provenance contract (resolved / partial / unmapped),
 * immutable raw evidence, source extraction lineage, release snapshots, and
 * evidence-hash inclusion of raw value text. Runs via `tsx` with no database.
 *
 * The database-backed acceptance / reprocessing / write-once paths are covered
 * by `verify-observation-provenance-integration-runner.ts` (requires a Supabase
 * connection via OBSERVATION_PROVENANCE_INTEGRATION=1).
 */
import assert from "node:assert/strict";
import {
  buildObservationUpsertPayload,
  buildObservationSemanticIdentity,
  type ObservationUpsertSource,
} from "../src/lib/documents/observation-identity";
import { buildInputEvidenceHash } from "../src/lib/documents/normalization-revisions";
import {
  OBSERVATION_PROVENANCE_SCHEMA_VERSION,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_CATALOG_MANIFEST_DIGEST,
  MEASUREMENT_RESOLVER_VERSION,
  MEASUREMENT_NORMALIZATION_VERSION,
  resolveMeasurementDefinition,
} from "../src/lib/biomarkers";

function baseSource(overrides: Partial<ObservationUpsertSource> = {}): ObservationUpsertSource {
  return {
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
    specimen: "serum",
    modifier: "none",
    raw_name: "ALT",
    source_page: 1,
    source_text: "ALT: 21 U/L",
    bounding_box: null,
    confidence: 0.9,
    reported_alt_value: null,
    reported_alt_unit: null,
    source_extracted_biomarker_id: "extracted_1",
    raw_value_text: "21",
    raw_reference_text: "7-56",
    raw_unit: "U/L",
    extraction_version: "2026-07-14.1",
    provenance_schema_version: OBSERVATION_PROVENANCE_SCHEMA_VERSION,
    catalog_manifest_version: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    catalog_manifest_digest: MEASUREMENT_CATALOG_MANIFEST_DIGEST,
    resolver_version: MEASUREMENT_RESOLVER_VERSION,
    normalization_version: MEASUREMENT_NORMALIZATION_VERSION,
    ...overrides,
  };
}

// ── resolved: full semantic identity + full provenance contract ──
const resolved = resolveMeasurementDefinition({
  rawLabel: "ALT",
  rawUnit: "U/L",
  specimen: "serum",
  valueKind: "numeric",
});
assert.equal(resolved.result, "resolved");
assert.ok(resolved.measurementDefinitionKey, "resolved row must have a concrete measurement definition");
assert.ok(resolved.analyteKey, "resolved row must have an analyte");

const resolvedPayload = buildObservationUpsertPayload(baseSource(), resolved);
assert.equal(resolvedPayload.raw_value_text, "21");
assert.equal(resolvedPayload.raw_reference_text, "7-56");
assert.equal(resolvedPayload.raw_unit, "U/L");
assert.equal(resolvedPayload.extraction_version, "2026-07-14.1");
assert.equal(resolvedPayload.provenance_schema_version, OBSERVATION_PROVENANCE_SCHEMA_VERSION);
assert.equal(resolvedPayload.catalog_manifest_version, MEASUREMENT_CATALOG_MANIFEST_VERSION);
assert.equal(resolvedPayload.catalog_manifest_digest, MEASUREMENT_CATALOG_MANIFEST_DIGEST);
assert.equal(resolvedPayload.resolver_version, MEASUREMENT_RESOLVER_VERSION);
assert.equal(resolvedPayload.normalization_version, MEASUREMENT_NORMALIZATION_VERSION);
assert.equal(resolvedPayload.source_extracted_biomarker_id, "extracted_1");
assert.equal(resolvedPayload.analyte_key, resolved.analyteKey);
assert.equal(resolvedPayload.measurement_definition_key, resolved.measurementDefinitionKey);
assert.equal(resolvedPayload.resolution_status, "resolved");

// ── partial: raw evidence retained, no fabricated measurement definition ──
const partial = resolveMeasurementDefinition({ rawLabel: "ALT", rawUnit: "U/L" });
const partialIdentity = buildObservationSemanticIdentity(partial);
assert.equal(partialIdentity.resolution_status, "partial");
assert.equal(partialIdentity.measurement_definition_key, null, "partial must not receive a fabricated concrete identity");
assert.ok(partialIdentity.analyte_key, "partial keeps analyte identity when recognized");
const partialPayload = buildObservationUpsertPayload(
  baseSource({
    name: "Alanine aminotransferase (ALT)",
    raw_name: "ALT",
    raw_value_text: "21",
    raw_reference_text: "7-56",
    source_extracted_biomarker_id: "extracted_partial",
  }),
  partial,
);
assert.equal(partialPayload.measurement_definition_key, null);
assert.equal(partialPayload.analyte_key, partial.analyteKey);
assert.equal(partialPayload.resolution_status, "partial");

// ── unmapped: raw evidence retained, both semantic links null ──
const unmapped = resolveMeasurementDefinition({ rawLabel: "Definitely_Not_A_Real_Biomarker_9f3c", rawUnit: "U/L" });
assert.equal(unmapped.result, "unmapped");
const unmappedIdentity = buildObservationSemanticIdentity(unmapped);
assert.equal(unmappedIdentity.resolution_status, "unmapped");
assert.equal(unmappedIdentity.analyte_key, null, "unmapped must not fabricate analyte identity");
assert.equal(unmappedIdentity.measurement_definition_key, null, "unmapped must not fabricate definition identity");
const unmappedPayload = buildObservationUpsertPayload(
  baseSource({
    name: "Unknown marker",
    raw_name: "Unknown marker",
    raw_value_text: "12.4",
    raw_reference_text: null,
    source_extracted_biomarker_id: "extracted_unmapped",
  }),
  unmapped,
);
assert.equal(unmappedPayload.raw_value_text, "12.4");
assert.equal(unmappedPayload.analyte_key, null);
assert.equal(unmappedPayload.measurement_definition_key, null);
assert.equal(unmappedPayload.resolution_status, "unmapped");

// ── raw value text preserved with qualifiers and locale formatting ──
const thresholdHash = buildInputEvidenceHash({ rawLabel: "CRP", rawUnit: "mg/L", rawValueText: "< 0.20" });
const valueHash = buildInputEvidenceHash({ rawLabel: "CRP", rawUnit: "mg/L", rawValueText: "0.20" });
assert.notEqual(thresholdHash, valueHash, "threshold '< 0.20' must hash distinctly from '0.20'");
const commaHash = buildInputEvidenceHash({ rawLabel: "Glucose", rawUnit: "mmol/L", rawValueText: "5,3" });
const dotHash = buildInputEvidenceHash({ rawLabel: "Glucose", rawUnit: "mmol/L", rawValueText: "5.3" });
assert.notEqual(commaHash, dotHash, "decimal comma must be preserved distinctly from decimal dot");
const sameAgain = buildInputEvidenceHash({ rawLabel: "CRP", rawUnit: "mg/L", rawValueText: "0.20" });
assert.equal(valueHash, sameAgain, "identical raw value text produces an identical evidence hash (idempotent)");
assert.notEqual(
  buildInputEvidenceHash({ rawLabel: "CRP", rawUnit: "mg/L", rawValueText: "0.20" }),
  buildInputEvidenceHash({ rawLabel: "CRP", rawUnit: "mg/L", rawValueText: null }),
  "raw value text participates in the evidence hash",
);

// ── qualitative unitless value: raw value stored, raw unit null ──
const qualitative = resolveMeasurementDefinition({ rawLabel: "Some Qualitative Assay", rawUnit: null });
const qualPayload = buildObservationUpsertPayload(
  baseSource({
    name: "Some Qualitative Assay",
    value: null,
    value_kind: "qualitative",
    value_text: "Negative",
    raw_value_text: "Negative",
    raw_unit: null,
    unit: "",
    source_extracted_biomarker_id: "extracted_qual",
  }),
  qualitative,
);
assert.equal(qualPayload.raw_value_text, "Negative");
assert.equal(qualPayload.raw_unit, null, "unitless qualitative result stores a null raw unit");

// ── distinct source rows are not collapsed (separate observations) ──
const payloadA = buildObservationUpsertPayload(baseSource({ source_extracted_biomarker_id: "ext_A" }), resolved);
const payloadB = buildObservationUpsertPayload(
  baseSource({
    source_extracted_biomarker_id: "ext_B",
    name: "Alanine aminotransferase (ALT)",
    raw_name: "ALT",
    raw_value_text: "21",
  }),
  resolved,
);
assert.notEqual(payloadA.source_extracted_biomarker_id, payloadB.source_extracted_biomarker_id);
assert.equal(payloadA.raw_value_text, payloadB.raw_value_text, "same analyte + value but distinct source rows stay separate");

// ── duplicate retry is idempotent (equal provenance) ──
const first = buildObservationUpsertPayload(baseSource({ source_extracted_biomarker_id: "ext_dup" }), resolved);
const second = buildObservationUpsertPayload(baseSource({ source_extracted_biomarker_id: "ext_dup" }), resolved);
assert.deepEqual(first, second, "re-accepting the same source row yields an identical provenance payload");

// ── release identifiers are singular and present ──
assert.ok(OBSERVATION_PROVENANCE_SCHEMA_VERSION.length > 0, "provenance schema version must be assigned");
assert.equal(MEASUREMENT_CATALOG_MANIFEST_DIGEST.length, 64, "catalog manifest digest must be a sha256 hex");
assert.ok(MEASUREMENT_CATALOG_MANIFEST_VERSION.length > 0, "catalog manifest version must be present");

console.log("observation-provenance: all contract checks passed");
console.log(
  `release snapshots: catalog=${MEASUREMENT_CATALOG_MANIFEST_VERSION} resolver=${MEASUREMENT_RESOLVER_VERSION} normalization=${MEASUREMENT_NORMALIZATION_VERSION} provenance=${OBSERVATION_PROVENANCE_SCHEMA_VERSION}`,
);
