import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  applyMeasurementOverride,
  type MeasurementOverride,
} from "../src/lib/documents/observation-measurement-correction";
import type { NormalizationRevision } from "../src/lib/documents/normalization-revisions";
import type { ExtractedBiomarkerWriterRow } from "../src/lib/documents/observation-normalization-writer";
import type { PersistedResolverDecisionTrace } from "../src/lib/biomarkers";
async function main() {

  // These modules import the server environment at module load time. The verifier
  // exercises their pure projection/hash/diff helpers without requiring a live
  // Supabase instance.
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "verify-eh119-dummy";
process.env.OPENAI_API_KEY ??= "verify-eh119-dummy";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://verify-eh119.example";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "verify-eh119-dummy";

const {
  buildNormalizationReview,
  effectiveMeasurementFromExtracted,
} = await import("../src/lib/documents/normalization-review");
const {
  buildNormalizationWriterRequestHash,
  measurementInputFromWriterRow,
} = await import("../src/lib/documents/observation-normalization-writer");
const { computeReprocessBatchDiff } = await import("../src/lib/registry-reprocessing/diff");
const documentViewerSource = readFileSync(
  path.resolve(__dirname, "../src/components/documents/document-viewer.tsx"),
  "utf8",
);
assert.match(documentViewerSource, /action:\s*"edit-value"/);
assert.match(documentViewerSource, /handleCorrectMeasurement/);
assert.match(documentViewerSource, /correctionDrafts/);
assert.match(documentViewerSource, /correctingRowId/);
const correctionRouteSource = readFileSync(
  path.resolve(__dirname, "../src/app/api/documents/[id]/biomarkers/route.ts"),
  "utf8",
);
assert.match(
  correctionRouteSource,
  /targetRevision\.measurement_definition_key[\s\S]*buildManualCorrectionResolution/,
  "undo restores a target revision's concrete identity when one exists",
);
assert.match(
  correctionRouteSource,
  /userCorrected:\s*targetOverride !== null/,
  "undo reports whether the restored revision carries a measurement correction",
);
const correctionFormSource = readFileSync(
  path.resolve(__dirname, "../src/components/documents/review/observation-correction-form.tsx"),
  "utf8",
);
assert.match(correctionFormSource, /onSave/);
assert.match(correctionFormSource, /onUndo/);
assert.doesNotMatch(
  correctionFormSource,
  /\b(?:specimen|modifier|timing)\b/i,
  "the correction form must not offer unstated clinical axes",
);
assert.doesNotMatch(
  correctionFormSource,
  /(?:update\("(?:specimen|modifier|timing|method)"|name=["'](?:specimen|modifier|timing|method)["']|>\s*(?:Specimen|Modifier|Timing|Method)\s*<)/i,
  "the correction form must not offer an unstated clinical-axis control",
);
const reviewRowSource = readFileSync(
  path.resolve(__dirname, "../src/components/documents/review/observation-review-row.tsx"),
  "utf8",
);
assert.ok(
  reviewRowSource.indexOf("{correction}") < reviewRowSource.indexOf("{technicalDetails}"),
  "the correction slot must remain outside progressive technical details",
);

const row: ExtractedBiomarkerWriterRow & {
  profile_id: string;
  document_id: string;
  observation_kind: "lab";
} = {
  id: "eh119-flow-row",
  profile_id: "eh119-flow-profile",
  document_id: "eh119-flow-document",
  biomarker_key: null,
  biomarker_name: "ALT (alanine aminotransferase)",
  raw_name: "ALT (alanine aminotransferase)",
  value_numeric: 31,
  value_text: "31",
  value_kind: "numeric",
  ordinal: null,
  unit: "U/L",
  raw_unit: "U/L",
  reference_range: "0 - 41",
  raw_reference_range: "0 - 41",
  section_context: null,
  confidence: 0.9,
  specimen: "serum",
  modifier: null,
  source_page: 1,
  source_text: "ALT (alanine aminotransferase) 31 U/L",
  bounding_box: null,
  reported_alt_value: null,
  reported_alt_unit: null,
  raw_value_text: "31",
  method: null,
  processing_version: "eh119-test",
  observation_kind: "lab",
};

const override: MeasurementOverride = {
  value: 32,
  ref_high: 42,
  observed_at: "2026-08-02",
};

const activeRevision = {
  id: "eh119-flow-revision",
  extracted_biomarker_id: row.id,
  observation_id: "eh119-flow-observation",
  measurement_definition_key: null,
  analyte_key: null,
  resolver_result: "partial",
  mapping_confidence: 0.42,
  mapping_confidence_band: "low",
  verification_status: "user_verified",
  verification_decided_at: null,
  verification_actor_type: "user",
  verification_actor_id: "eh119-flow-actor",
  is_active: true,
  mapping_change_classification: "additive",
  resolver_evidence: {},
  measurement_override: override,
} as NormalizationRevision;
const rawMeasurement = {
  value: 31,
  valueText: "31",
  valueKind: "numeric" as const,
  ordinal: null,
  unit: "U/L",
  refLow: 0,
  refHigh: 41,
  observedAt: "2026-08-01",
};

const effective = effectiveMeasurementFromExtracted(row, override);
assert.deepEqual(effective, {
  value: 32,
  valueText: "31",
  valueKind: "numeric",
  ordinal: null,
  unit: "U/L",
  refLow: 0,
  refHigh: 42,
  observedAt: "2026-08-02",
});
assert.equal(row.value_numeric, 31, "the extracted row remains immutable");

const review = buildNormalizationReview(
  { ...row, measurement_definition_key: null, resolver_result: "partial" },
  [
    {
      ...activeRevision,
      created_at: "2026-08-09T12:00:00Z",
      catalog_manifest_version: "eh119-test",
      resolver_version: "eh119-test",
      normalization_version: "eh119-test",
      resolver_decision_trace: null,
      resolver_trace_schema_version: null,
    },
  ],
);
assert.equal(review.userCorrected, true);
assert.equal(review.effectiveMeasurement?.value, 32);
assert.equal(review.effectiveMeasurement?.refHigh, 42);
assert.equal(review.effectiveMeasurement?.observedAt, "2026-08-02");
assert.equal(review.result, "partial");

const correctedInput = measurementInputFromWriterRow(row, override);
assert.equal(correctedInput.referenceHigh, 42);
assert.equal(correctedInput.rawValueText, "31");

const trace: PersistedResolverDecisionTrace = {
  schemaVersion: "1",
  outcome: "partial",
  decisionKind: "recognized_incomplete",
  inputEvidenceHash: "a".repeat(64),
  catalogManifestVersion: "eh119-test",
  catalogManifestDigest: "b".repeat(64),
  resolverVersion: "eh119-test",
  winningCandidateKey: null,
  candidates: [],
  missingAxes: [],
  conflicts: [],
};
const hashOptions = {
  actorId: "eh119-flow-actor",
  extractedBiomarkerId: row.id,
  inputEvidenceHash: trace.inputEvidenceHash,
  decisionTrace: trace,
  writeKind: "value_correction" as const,
  mappingClassification: "additive" as const,
  correctionReason: "The printed result is 32, not 31.",
  measurementOverride: override,
};
const firstHash = buildNormalizationWriterRequestHash(hashOptions);
assert.equal(buildNormalizationWriterRequestHash(hashOptions), firstHash);
assert.notEqual(
  buildNormalizationWriterRequestHash({
    ...hashOptions,
    measurementOverride: { value: 33 },
  }),
  firstHash,
  "different restatements must not share an idempotency key",
);

const reprocessDiff = computeReprocessBatchDiff({
  extractedRow: row,
  activeRevision,
  includeManualDecisions: false,
});
assert.equal(reprocessDiff.diffClassification, "skipped_manual_correction");
assert.equal(reprocessDiff.diffReasonCode, "default_protection_measurement_correction");
assert.deepEqual(
  applyMeasurementOverride(rawMeasurement, override),
  {
    ...rawMeasurement,
    value: 32,
    refHigh: 42,
    observedAt: "2026-08-02",
  },
  "the writer's effective measurement carries the correction forward",
);

  console.log("EH-119 correction flow checks passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
