import assert from "node:assert/strict";
import {
  EMPTY_HEALTH_PROFILE_REPORTED_RESULTS,
  projectHealthProfileReportedResults,
  type ReportedResultProjectionRow,
} from "../src/lib/health-profile-reported-results";
import { buildHealthProfile, type ObservationInput } from "../src/lib/health-systems";
import type { LaboratoryOutcomeSummary } from "../src/lib/documents/incomplete-laboratory-outcomes";

const source = {
  id: "reported-results-document",
  original_filename: "synthetic-report.pdf",
  observed_at: "2026-08-01",
  lab_name: "Synthetic laboratory",
  document_type: "lab_result",
};

const baseOutcome: LaboratoryOutcomeSummary = {
  outcome: "partial",
  verificationStatus: "pending",
  measurementDefinitionKey: null,
  analyteKey: null,
  registryBindingReady: false,
  assessmentInputKey: null,
  resolvedMeasurementBinding: null,
  resolutionDetails: {
    source: "preview",
    outcome: "partial",
    verificationStatus: "pending",
    mappingConfidence: 0.6,
    mappingConfidenceBand: "medium",
    missingAxes: [],
    minimalMissingAxes: [],
    conflictCodes: [],
    supportCodes: [],
    candidateCount: 1,
    incompleteReason: null,
    versions: {
      catalog: null,
      resolver: null,
      normalization: null,
      trace: 2,
      compatibilityPolicy: "fixture-policy",
    },
    eligibility: {
      trendEligible: false,
      conversionEligible: false,
      reportEligible: false,
      structuredContextEligible: false,
      assessmentEligible: false,
      exclusions: {
        trend: "incomplete_resolution",
        conversion: "incomplete_resolution",
        report: "incomplete_resolution",
        structuredContext: "incomplete_resolution",
        assessment: "incomplete_resolution",
      },
    },
  },
};

function row(
  id: string,
  documentId: string,
  options: {
    assessmentInput?: unknown | null;
    incompleteReason?: LaboratoryOutcomeSummary["resolutionDetails"]["incompleteReason"];
    assessmentExclusion?: LaboratoryOutcomeSummary["resolutionDetails"]["eligibility"]["exclusions"]["assessment"];
  } = {},
): ReportedResultProjectionRow {
  return {
    id,
    document_id: documentId,
    assessment_input: options.assessmentInput ?? null,
    outcome: {
      ...baseOutcome,
      resolutionDetails: {
        ...baseOutcome.resolutionDetails,
        incompleteReason: options.incompleteReason ?? baseOutcome.resolutionDetails.incompleteReason,
        eligibility: {
          ...baseOutcome.resolutionDetails.eligibility,
          exclusions: {
            ...baseOutcome.resolutionDetails.eligibility.exclusions,
            assessment:
              options.assessmentExclusion ??
              baseOutcome.resolutionDetails.eligibility.exclusions.assessment,
          },
        },
      },
    },
  };
}

assert.deepEqual(
  projectHealthProfileReportedResults([]),
  EMPTY_HEALTH_PROFILE_REPORTED_RESULTS,
  "zero current extracted rows produce an empty summary",
);

const mixed = projectHealthProfileReportedResults([
  row("ready", source.id, { assessmentInput: { biomarker_key: "glucose" } }),
  row("axis", source.id, { incompleteReason: "axis_not_stated" }),
  row("conflict", source.id, { incompleteReason: "unit_or_value_conflict" }),
  row("unknown", "second-document", { incompleteReason: "no_candidate" }),
  row("unreviewed", "second-document", { incompleteReason: "definition_not_reviewed" }),
  row("unverified", "second-document", { assessmentExclusion: "verification_required" }),
]);
assert.deepEqual(mixed, {
  reported_count: 6,
  ready_for_scoring_count: 1,
  needs_document_details_count: 2,
  awaiting_catalog_review_count: 2,
  awaiting_verification_count: 1,
  source_document_count: 2,
}, "mixed rows occupy exclusive readiness buckets");

const allReady = projectHealthProfileReportedResults([
  row("ready-a", source.id, { assessmentInput: {} }),
  row("ready-b", source.id, { assessmentInput: { biomarker_key: "hba1c" } }),
]);
assert.equal(allReady.reported_count, 2);
assert.equal(allReady.ready_for_scoring_count, 2);
assert.equal(allReady.needs_document_details_count, 0);
assert.equal(allReady.awaiting_catalog_review_count, 0);
assert.equal(allReady.awaiting_verification_count, 0);

const resolvedObservation: ObservationInput = {
  observation_id: "resolved-observation",
  biomarker_key: "glucose",
  measurement_definition_key: "glucose_serum",
  resolution_status: "resolved",
  name: "Glucose",
  value: 5,
  unit: "mmol/L",
  ref_low: 3.9,
  ref_high: 5.5,
  observed_at: "2026-08-01",
  document_id: source.id,
  observation_kind: "lab",
  value_kind: "numeric",
  value_text: "5",
  specimen: "serum",
  modifier: "none",
};

const onboarding = buildHealthProfile([], []);
assert.equal(onboarding.profile_display_state, "onboarding");
assert.equal(onboarding.reported_results.reported_count, 0);

const unrecognized = buildHealthProfile([], [source]);
assert.equal(unrecognized.profile_display_state, "no_recognized_biomarkers");

const reportedOnly = buildHealthProfile([], [source], {
  reportedResults: projectHealthProfileReportedResults([
    row("reported-only", source.id, { incompleteReason: "axis_not_stated" }),
  ]),
});
assert.equal(reportedOnly.profile_display_state, "reported_but_not_scoreable");
assert.equal(reportedOnly.overall_state_score, null);
assert.equal(reportedOnly.systems.length, 0);

const mixedCoverage = buildHealthProfile([resolvedObservation], [source], {
  reportedResults: mixed,
});
assert.equal(mixedCoverage.profile_display_state, "body_map");
assert.equal(mixedCoverage.reported_results.awaiting_catalog_review_count, 2);
assert.equal(mixedCoverage.overall_state_score, null);
assert.equal(
  mixedCoverage.systems.some((system) => system.id === "metabolic"),
  true,
  "score-ready observations remain visible in the body map",
);

console.log("verify-health-profile-reported-results: all checks passed");
