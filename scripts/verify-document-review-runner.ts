import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measurementMappingGuidance, measurementMappingLabel, resolveBiomarkerPanelMode, resolveBiomarkerReviewAction, reviewDataErrorMessage, shouldCompleteDocumentReview, validateObservationFallbackConfirmation } from "../src/lib/documents/biomarker-review-state";
import {
  buildPersistedResolverDecisionTrace,
  resolveMeasurementDefinition,
} from "../src/lib/biomarkers";
import { buildNormalizationReview } from "../src/lib/documents/normalization-review";
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
