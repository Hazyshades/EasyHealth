import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measurementMappingGuidance, measurementMappingLabel, resolveBiomarkerPanelMode, resolveBiomarkerReviewAction, reviewDataErrorMessage, shouldCompleteDocumentReview, validateObservationFallbackConfirmation } from "../src/lib/documents/biomarker-review-state";
import {
  buildPersistedResolverDecisionTrace,
  resolveMeasurementDefinition,
} from "../src/lib/biomarkers";
import { buildNormalizationReview } from "../src/lib/documents/normalization-review";
import {
  buildExtractedReviewRow,
  buildObservationReviewRow,
} from "../src/lib/documents/observation-review-workspace";
import {
  mapPipelineBiomarkerEvidence,
  parsePipelineExtraction,
} from "../src/lib/documents/extraction";
import { isAxisStated } from "../src/lib/documents/stated-axis-evidence";
assert.equal(measurementMappingLabel("partial", "medium"), "More details needed");
assert.equal(measurementMappingLabel("unmapped", "low"), "Measurement not recognized");
assert.equal(measurementMappingLabel("resolved", "high"), "Matched measurement");
assert.match(measurementMappingGuidance("partial"), /required context is missing/);
assert.match(measurementMappingGuidance("resolved"), /not medical certainty/);
assert.equal(resolveBiomarkerPanelMode({ extractedCount: 0, observationCount: 3 }), "observations-fallback");
assert.equal(resolveBiomarkerReviewAction({ mode: "extracted-review", documentStatus: "needs_review", reviewableExtractedCount: 2 }), "accept-extracted");
assert.equal(shouldCompleteDocumentReview({ documentStatus: "needs_review", reviewableExtractedCount: 0 }), true);
assert.equal(shouldCompleteDocumentReview({ documentStatus: "needs_review", reviewableExtractedCount: 1 }), false);
assert.equal(shouldCompleteDocumentReview({ documentStatus: "ready", reviewableExtractedCount: 0 }), false);
assert.equal(reviewDataErrorMessage({ message: "query failed" }), "Biomarker review data could not be loaded.");
assert.deepEqual(validateObservationFallbackConfirmation({ documentStatus: "needs_review", submittedObservationIds: ["a"], linkedObservationIds: ["a"], reviewableExtractedCount: 0 }), { ok: true });

const acceptanceRoute = readFileSync(
  "src/app/api/documents/[id]/biomarkers/accept/route.ts",
  "utf8",
);
assert.match(acceptanceRoute, /shouldCompleteDocumentReview/);
assert.match(acceptanceRoute, /processing_status: "ready"/);
assert.match(acceptanceRoute, /status: "completed"/);

// Review rows must preserve extraction confidence in both the extracted-row
// and observations-only fallback contracts. Mapping confidence is separate.
const extractedReviewRow = buildExtractedReviewRow({
  id: "confidence-extracted-row",
  biomarker_name: "ALT",
  raw_name: "ALT",
  value_numeric: 28,
  value_text: "28",
  value_kind: "numeric",
  unit: "U/L",
  raw_unit: "U/L",
  raw_value_text: "28",
  reference_range: "2 - 41",
  raw_reference_range: "2 - 41",
  specimen: "unspecified",
  modifier: "none",
  method: null,
  confidence: 0.42,
  source_page: 1,
  source_text: "ALT 28 U/L",
  status: "needs_review",
});
assert.equal(
  extractedReviewRow.rawEvidence.extractionConfidence,
  0.42,
  "extracted review rows expose extraction confidence",
);
const observationFallbackRow = buildObservationReviewRow({
  id: "confidence-observation-row",
  name: "ALT",
  raw_name: "ALT",
  value: 28,
  value_kind: "numeric",
  value_text: "28",
  unit: "U/L",
  raw_unit: "U/L",
  raw_value_text: "28",
  raw_reference_text: "2 - 41",
  ref_low: 2,
  ref_high: 41,
  specimen: "unspecified",
  modifier: "none",
  confidence: 0.42,
  source_page: 1,
  source_text: "ALT 28 U/L",
});
assert.equal(
  observationFallbackRow.rawEvidence.extractionConfidence,
  0.42,
  "observations-only fallback rows expose extraction confidence",
);
assert.equal(
  observationFallbackRow.rawEvidence.value,
  "28 U/L",
  "observations-only fallback uses the extracted raw-value rendering contract",
);

// The extraction prompt's context fields must survive the pure parser-to
// persistence mapper, while absent context stays absent and cannot become
// specimen evidence merely because a prompt or heading names it.
const parsedPipelineEvidence = parsePipelineExtraction({
  biomarkers: [
    {
      raw_name: "ALT",
      key: "alt",
      name: "ALT",
      value: 28,
      unit: "U/L",
      ref_low: 2,
      ref_high: 41,
      raw_reference_range: "2 - 41",
      source_page: 2,
      source_text: "ALT 28 U/L",
      section_context: "Biochemistry panel",
      confidence: 0.73,
      specimen: null,
      modifier: null,
      method: null,
      reported_alt_value: null,
      reported_alt_unit: null,
    },
  ],
});
const parsedBiomarker = parsedPipelineEvidence.biomarkers[0];
assert.ok(parsedBiomarker, "the seam fixture must produce one parsed biomarker");
const persistedPipelineEvidence = mapPipelineBiomarkerEvidence(parsedBiomarker, {
  page: 2,
  region: null,
});
assert.equal(persistedPipelineEvidence.section_context, "Biochemistry panel");
assert.equal(persistedPipelineEvidence.raw_name, "ALT");
assert.equal(persistedPipelineEvidence.raw_reference_range, "2 - 41");
assert.equal(persistedPipelineEvidence.source_text, "ALT 28 U/L");
assert.equal(persistedPipelineEvidence.confidence, 0.73);

const absentContext = parsePipelineExtraction({
  biomarkers: [
    {
      raw_name: "ALT",
      key: "alt",
      name: "ALT",
      value: 28,
      unit: "U/L",
      source_page: 2,
      source_text: "ALT 28 U/L",
      section_context: null,
      confidence: 0.73,
      specimen: "serum",
      modifier: null,
      method: null,
      reported_alt_value: null,
      reported_alt_unit: null,
    },
  ],
}).biomarkers[0];
assert.ok(absentContext, "the absent-context fixture must produce one parsed biomarker");
const persistedAbsentContext = mapPipelineBiomarkerEvidence(absentContext, {
  page: 2,
  region: null,
});
assert.equal(persistedAbsentContext.section_context, null);
assert.equal(
  isAxisStated("specimen", "serum", {
    label: persistedAbsentContext.raw_name,
    sourceText: persistedAbsentContext.source_text,
    sectionContext: persistedAbsentContext.section_context,
  }),
  false,
  "missing captured context cannot unlock a specimen axis",
);

// All hooks, including review and batch-derived hooks, must be declared before
// the loading/error returns so every empty-to-loaded transition has one order.
const documentViewerSource = readFileSync(
  "src/components/documents/document-viewer.tsx",
  "utf8",
);
const documentViewerStart = documentViewerSource.indexOf(
  "export function DocumentViewer",
);
const loadingReturn = documentViewerSource.indexOf("  if (loading)", documentViewerStart);
const errorReturn = documentViewerSource.indexOf(
  "  if (error || !doc)",
  documentViewerStart,
);
assert.ok(documentViewerStart >= 0, "DocumentViewer declaration must be present");
assert.ok(loadingReturn > documentViewerStart, "loading return must be present");
assert.ok(errorReturn > loadingReturn, "error return must follow loading return");
assert.ok(
  documentViewerSource.slice(documentViewerStart, loadingReturn).includes(
    "const reviewRows = useMemo",
  ),
  "review-derived state must be evaluated before early returns",
);
assert.match(
  documentViewerSource.slice(documentViewerStart, loadingReturn),
  /const reviewRows = useMemo[\s\S]*?return \[\];/,
  "empty and review-error states must remain hook-safe derived branches",
);
assert.equal(
  documentViewerSource.slice(errorReturn).match(/\buse(?:Callback|Effect|Memo|Ref|State)\s*\(/),
  null,
  "no React hook may be introduced after the loading/error returns",
);

const persistedTrace = buildPersistedResolverDecisionTrace(
  resolveMeasurementDefinition({
    rawLabel: "ALT",
    rawUnit: "U/L",
    specimen: "serum",
    valueKind: "numeric",
  }),
  {
    inputEvidenceHash: "b".repeat(64),
    catalogManifestVersion: "eh115-test",
    catalogManifestDigest: "eh115-test-digest",
    resolverVersion: "eh115-test",
  },
);
const persistedReview = buildNormalizationReview(
  {
    id: "persisted-row",
    biomarker_key: null,
    biomarker_name: "Changed source label",
    raw_name: "Changed source label",
  },
  [
    {
      id: "persisted-revision",
      extracted_biomarker_id: "persisted-row",
      measurement_definition_key: "alt_serum_catalytic_activity",
      analyte_key: "alt",
      resolver_result: "resolved",
      mapping_confidence: 0.95,
      mapping_confidence_band: "high",
      verification_status: "user_verified",
      is_active: true,
      catalog_manifest_version: "eh115-test",
      resolver_version: "eh115-test",
      normalization_version: "eh115-test",
      resolver_decision_trace: persistedTrace,
      resolver_trace_schema_version: "1",
      created_at: "2026-07-30T00:00:00Z",
    },
  ],
);
assert.equal(persistedReview.decisionTrace.availability, "persisted");
assert.equal(persistedReview.result, "resolved");
assert.equal(persistedReview.decisionTrace.trace, persistedTrace);
assert.equal(JSON.stringify(persistedReview.decisionTrace).includes("Changed source label"), false);

const legacyReview = buildNormalizationReview(
  {
    id: "legacy-row",
    biomarker_key: null,
    biomarker_name: "ALT",
  },
  [
    {
      id: "legacy-revision",
      extracted_biomarker_id: "legacy-row",
      measurement_definition_key: null,
      analyte_key: null,
      resolver_result: "partial",
      mapping_confidence: 0.7,
      mapping_confidence_band: "medium",
      verification_status: "pending",
      is_active: true,
      catalog_manifest_version: "legacy",
      resolver_version: "legacy",
      normalization_version: "legacy",
      resolver_decision_trace: null,
      resolver_trace_schema_version: null,
      created_at: "2026-07-30T00:00:00Z",
    },
  ],
);
assert.equal(legacyReview.decisionTrace.availability, "legacy_unavailable");
assert.equal(legacyReview.previewCandidateEvidence.length, 0);
console.log("verify-document-review: all checks passed");
