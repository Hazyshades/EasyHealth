import assert from "node:assert/strict";
import { resolveMeasurementDefinition } from "../src/lib/biomarkers";
import type {
  ClinicalCompatibilityAxis,
  ResolutionReasonCode,
  ResolverDecisionTrace,
} from "../src/lib/biomarkers";
import {
  buildResolutionOutcomeMetric,
  emitResolutionOutcomeMetricForWrite,
  projectLaboratoryOutcome,
  serializeLaboratoryOutcome,
} from "../src/lib/documents/incomplete-laboratory-outcomes";
import {
  measurementMappingGuidance,
  measurementMappingLabel,
  measurementReasonLabel,
} from "../src/lib/documents/biomarker-review-state";
import { getDocumentReprocessTypeOverride } from "../src/lib/documents/reprocess-policy";

const resolvedKey = "alt_serum_catalytic_activity";
const candidateOnlyKey = "candidate-only-key-must-not-leak";

type TraceCandidate = {
  key: string;
  missingAxes?: ClinicalCompatibilityAxis[];
  accepted?: ResolutionReasonCode[];
  rejected?: ResolutionReasonCode[];
};

function trace(
  outcome: "resolved" | "partial" | "ambiguous" | "unmapped",
  candidates: TraceCandidate[],
  selectedCandidateKey: string | null = null,
): ResolverDecisionTrace {
  return {
    version: 2,
    compatibilityPolicyVersion: "eh111-compatibility-v2",
    selectedCandidateKey,
    runnerUpCandidateKey: null,
    outcome,
    confidence: 0.78,
    candidates: candidates.map((candidate) => ({
      candidateKey: candidate.key,
      matchedAlias: {
        key: `test-${candidate.key}`,
        measurementDefinitionKey: candidate.key,
        value: candidate.key,
        normalizedValue: candidate.key,
        matchType: "exact",
        matchAuthority: "reviewed_resolution",
        approvalStatus: "reviewed",
        lifecycle: "active",
        provenance: {
          kind: "registry_v2_review",
          sourceRecordKey: "eh112-test",
        },
      },
      accepted: (candidate.accepted ?? []).map((code) => ({
        code,
        source: "label",
        strength: "strong",
        score: 5,
      })),
      missing: [],
      rejected: (candidate.rejected ?? []).map((code) => ({
        code,
        source: "unit",
        strength: "hard",
        score: 0,
      })),
      missingAxes: candidate.missingAxes ?? [],
      score: 40,
      selectable: outcome !== "unmapped",
      eligible: outcome === "resolved",
    })),
  };
}

function activeRevision(
  outcome: "resolved" | "partial" | "ambiguous" | "unmapped",
  measurementDefinitionKey: string | null,
  decisionTrace: ResolverDecisionTrace,
) {
  return {
    is_active: true,
    resolver_result: outcome,
    verification_status: outcome === "resolved" ? "user_verified" : "pending",
    measurement_definition_key: measurementDefinitionKey,
    mapping_confidence: 0.78,
    mapping_confidence_band: "medium",
    catalog_manifest_version: "registry-v2-test",
    resolver_version: "resolver-v6-test",
    normalization_version: "normalization-v2-test",
    resolver_evidence: decisionTrace,
  } as const;
}

const resolved = projectLaboratoryOutcome({
  observation: {
    observation_kind: "lab",
    measurement_definition_key: resolvedKey,
    resolution_status: "resolved",
  },
  relation: activeRevision(
    "resolved",
    resolvedKey,
    trace("resolved", [{ key: resolvedKey, accepted: ["alias_exact_match"] }], resolvedKey),
  ),
});
assert.equal(resolved.outcome, "resolved");
assert.equal(resolved.measurementDefinitionKey, resolvedKey);
assert.equal(resolved.registryBindingReady, true);
assert.equal(resolved.resolutionDetails.eligibility.trendEligible, true);

const partial = projectLaboratoryOutcome({
  observation: {
    observation_kind: "lab",
    measurement_definition_key: null,
    resolution_status: "partial",
  },
  relation: activeRevision(
    "partial",
    null,
    trace("partial", [
      { key: candidateOnlyKey, missingAxes: ["unit", "specimen"], accepted: ["alias_exact_match"] },
    ]),
  ),
});
assert.equal(partial.outcome, "partial");
assert.equal(partial.measurementDefinitionKey, null);
assert.equal(partial.analyteKey, null);
assert.equal(partial.resolutionDetails.source, "active_revision");
assert.deepEqual(partial.resolutionDetails.missingAxes, ["specimen", "unit"]);
assert.equal(partial.resolutionDetails.eligibility.trendEligible, false);
assert.equal(partial.resolutionDetails.eligibility.conversionEligible, false);
assert.equal(partial.resolutionDetails.eligibility.assessmentEligible, false);
assert.equal(JSON.stringify(partial).includes(candidateOnlyKey), false);

const ambiguous = projectLaboratoryOutcome({
  observation: {
    observation_kind: "lab",
    measurement_definition_key: null,
    resolution_status: "ambiguous",
  },
  relation: activeRevision(
    "ambiguous",
    null,
    trace("ambiguous", [
      { key: "candidate-a", accepted: ["alias_exact_match"] },
      { key: "candidate-b", accepted: ["alias_normalized_match"] },
    ]),
  ),
});
assert.equal(ambiguous.outcome, "ambiguous");
assert.equal(ambiguous.resolutionDetails.candidateCount, 2);
assert.equal(ambiguous.resolutionDetails.eligibility.assessmentEligible, false);

const unmapped = projectLaboratoryOutcome({
  observation: {
    observation_kind: "lab",
    measurement_definition_key: null,
    resolution_status: "unmapped",
  },
  relation: activeRevision("unmapped", null, trace("unmapped", [])),
});
assert.equal(unmapped.outcome, "unmapped");
assert.equal(unmapped.measurementDefinitionKey, null);
assert.equal(unmapped.resolutionDetails.eligibility.reportEligible, false);

const raw = serializeLaboratoryOutcome({
  observation: {
    observation_kind: "lab",
    measurement_definition_key: null,
    resolution_status: "partial",
    raw_name: "Glucose",
    raw_value_text: "90",
    raw_unit: null,
    source_text: "Glucose 90",
  },
  relation: activeRevision(
    "partial",
    null,
    trace("partial", [{ key: candidateOnlyKey, missingAxes: ["unit"] }]),
  ),
});
assert.equal(raw.raw_name, "Glucose");
assert.equal(raw.raw_value_text, "90");
assert.equal(raw.measurement_definition_key, null);
assert.equal(JSON.stringify(raw).includes(candidateOnlyKey), false);

const preview = resolveMeasurementDefinition({
  rawLabel: "EH112 unknown synthetic result",
  rawUnit: null,
  valueKind: null,
  specimen: null,
});
const previewOutcome = projectLaboratoryOutcome({
  observation: {
    observation_kind: "lab",
    measurement_definition_key: null,
    resolution_status: null,
  },
  relation: null,
  preview,
});
assert.equal(previewOutcome.resolutionDetails.source, "preview");
assert.equal(previewOutcome.resolutionDetails.eligibility.trendEligible, false);
assert.equal(previewOutcome.measurementDefinitionKey, null);

const metric = buildResolutionOutcomeMetric({
  resolution: preview,
  writeKind: "acceptance",
  resolverVersion: "resolver-v6-test",
  catalogVersion: "registry-v2-test",
});
assert.deepEqual(Object.keys(metric).sort(), [
  "catalogVersion",
  "compatibilityPolicyVersion",
  "conflictCodes",
  "consumerExclusionReasons",
  "mappingConfidenceBand",
  "missingAxes",
  "name",
  "outcome",
  "resolverVersion",
  "writeKind",
]);
let metricCalls = 0;
const originalInfo = console.info;
console.info = () => {
  metricCalls += 1;
};
try {
  assert.equal(emitResolutionOutcomeMetricForWrite({ wasReused: true, metric }), false);
  assert.equal(emitResolutionOutcomeMetricForWrite({ wasReused: false, metric }), true);
} finally {
  console.info = originalInfo;
}
assert.equal(metricCalls, 1);

assert.equal(measurementMappingLabel("resolved", "high"), "Matched measurement");
assert.equal(measurementMappingLabel("partial", "medium"), "More details needed");
assert.equal(
  measurementMappingLabel("ambiguous", "medium"),
  "Multiple possible matches",
);
assert.equal(measurementMappingLabel("unmapped", "low"), "Measurement not recognized");
assert.match(measurementMappingGuidance("partial"), /required context is missing/);
assert.match(measurementMappingGuidance("ambiguous"), /No measurement was selected/);
assert.equal(measurementReasonLabel("unit_missing"), "Unit is missing");

assert.equal(
  getDocumentReprocessTypeOverride({ candidate_key: candidateOnlyKey }),
  undefined,
);
assert.equal(
  getDocumentReprocessTypeOverride({ document_type: "lab_result", candidate_key: candidateOnlyKey }),
  "lab_result",
);

console.log("verify-eh112-incomplete-outcomes: all checks passed");
