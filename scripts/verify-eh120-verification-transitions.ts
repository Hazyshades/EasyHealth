import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EH120_OWNER_REQUEST,
  EH120_SERVICE_REQUEST,
  EH120_STALE_REQUEST,
  EH120_TRANSITION_FIXTURES,
} from "../src/lib/documents/observation-verification-fixtures";
import {
  evaluateObservationTransition,
  type ObservationTransitionDecision,
  type ObservationTransitionRequest,
  type ObservationTransitionSnapshot,
} from "../src/lib/documents/observation-verification-workflow";
import type { ObservationChangeEventRow } from "../src/lib/documents/observation-change-history";
import type { LaboratoryResolutionDetails } from "../src/lib/documents/incomplete-laboratory-outcomes";

process.env.SUPABASE_SERVICE_ROLE_KEY ??= "verify-eh120-dummy";
process.env.OPENAI_API_KEY ??= "verify-eh120-dummy";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://verify-eh120.example";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "verify-eh120-dummy";

const ROOT = path.resolve(__dirname, "..");

type TransitionNextState = Pick<
  ObservationTransitionSnapshot,
  "resolutionStatus" | "verificationStatus" | "recordStatus"
>;

function denied(
  decision: ObservationTransitionDecision,
  errorCode: string,
): void {
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.errorCode, errorCode);
}

function allowed(
  decision: ObservationTransitionDecision,
  next: Partial<TransitionNextState>,
): void {
  assert.equal(decision.allowed, true);
  if (!decision.allowed) return;
  for (const [key, value] of Object.entries(next)) {
    assert.equal(
      decision.next[key as keyof TransitionNextState],
      value,
      `transition next.${key}`,
    );
  }
}

function request(
  overrides: Partial<ObservationTransitionRequest>,
): ObservationTransitionRequest {
  return {
    ...EH120_OWNER_REQUEST,
    ...overrides,
  };
}

function resolutionDetails(
  outcome: "resolved" | "partial" | "ambiguous" | "unmapped",
  verificationStatus: "pending" | "auto_verified" | "user_verified" | "manually_corrected" | null,
): LaboratoryResolutionDetails {
  return {
    source: "active_revision",
    outcome,
    verificationStatus,
    mappingConfidence: outcome === "resolved" ? 0.98 : 0.35,
    mappingConfidenceBand: outcome === "resolved" ? "high" : "low",
    missingAxes: outcome === "resolved" ? [] : ["specimen"],
    minimalMissingAxes: outcome === "resolved" ? [] : ["specimen"],
    conflictCodes: [],
    supportCodes: [],
    candidateCount: outcome === "resolved" ? 1 : 0,
    incompleteReason: outcome === "resolved" ? null : "axis_not_stated",
    versions: {
      catalog: "eh120-test-catalog",
      resolver: "eh120-test-resolver",
      normalization: "eh120-test-normalization",
      trace: 1,
      compatibilityPolicy: "eh120-test-policy",
    },
    eligibility: {
      trendEligible: outcome === "resolved",
      conversionEligible: outcome === "resolved",
      reportEligible: outcome === "resolved",
      structuredContextEligible: outcome === "resolved",
      assessmentEligible: outcome === "resolved",
      exclusions: {
        trend: outcome === "resolved" ? null : "incomplete_resolution",
        conversion: outcome === "resolved" ? null : "incomplete_resolution",
        report: outcome === "resolved" ? null : "incomplete_resolution",
        structuredContext: outcome === "resolved" ? null : "incomplete_resolution",
        assessment: outcome === "resolved" ? null : "incomplete_resolution",
      },
    },
  };
}

function auditEvent(
  overrides: Partial<ObservationChangeEventRow> = {},
): ObservationChangeEventRow {
  return {
    id: "eh120-event-1",
    event_kind: "record_rejected",
    origin: "capture",
    observation_id: "eh120-observation-1",
    extracted_biomarker_id: "eh120-extracted-1",
    source_revision_id: "eh120-revision-1",
    source_prior_revision_id: null,
    source_reprocess_row_id: null,
    actor_type: "user",
    actor_id: "eh120-owner-1",
    correction_reason: null,
    prior_record_status: "active",
    next_record_status: "rejected",
    reason_code: "incorrect_extraction",
    transition_request_hash: "a".repeat(64),
    prior_measurement_definition_key: "glucose_serum",
    prior_analyte_key: "glucose",
    prior_resolver_result: "resolved",
    prior_verification_status: "pending",
    prior_mapping_confidence_band: "high",
    prior_input_evidence_hash: "b".repeat(64),
    next_measurement_definition_key: "glucose_serum",
    next_analyte_key: "glucose",
    next_resolver_result: "resolved",
    next_verification_status: "pending",
    next_mapping_confidence_band: "high",
    next_input_evidence_hash: "b".repeat(64),
    next_mapping_change_classification: "unchanged",
    catalog_manifest_version: "eh120-test-catalog",
    catalog_manifest_digest: "c".repeat(64),
    resolver_version: "eh120-test-resolver",
    normalization_version: "eh120-test-normalization",
    extraction_version: "eh120-test-extraction",
    occurred_at: "2026-08-13T10:00:00.000Z",
    created_at: "2026-08-13T10:00:00.000Z",
    ...overrides,
  };
}

async function main() {
  // These modules import the server environment at module load time. Dynamic
  // imports are intentional so the synthetic verifier environment above is set
  // before those modules initialize.
  const {
    buildExtractedReviewRow,
    buildObservationReviewRow,
  } = await import("../src/lib/documents/observation-review-workspace");
  const {
    buildNormalizationActionAvailability,
    buildNormalizationReview,
  } = await import("../src/lib/documents/normalization-review");
  const { buildObservationChangeEntry } = await import(
    "../src/lib/documents/observation-change-history"
  );

  // --- Authoritative transition policy --------------------------------------
  const active = EH120_TRANSITION_FIXTURES.active;
  allowed(
    evaluateObservationTransition(active, EH120_OWNER_REQUEST),
    { resolutionStatus: "resolved", verificationStatus: "user_verified", recordStatus: "active" },
  );
  allowed(
    evaluateObservationTransition(active, EH120_SERVICE_REQUEST),
    { resolutionStatus: "resolved", verificationStatus: "auto_verified", recordStatus: "active" },
  );
  assert.equal(
    evaluateObservationTransition(active, EH120_SERVICE_REQUEST).allowed,
    true,
    "the approved service request can promote the deterministic active fixture",
  );

  for (const outcome of ["partial", "ambiguous", "unmapped"] as const) {
    denied(
      evaluateObservationTransition(
        EH120_TRANSITION_FIXTURES[outcome],
        EH120_SERVICE_REQUEST,
      ),
      "incomplete_outcome",
    );
    denied(
      evaluateObservationTransition(
        EH120_TRANSITION_FIXTURES[outcome],
        EH120_OWNER_REQUEST,
      ),
      "incomplete_outcome",
    );
  }

  denied(
    evaluateObservationTransition(
      active,
      request({ operation: "verify_auto" }),
    ),
    "authorization_required",
  );
  denied(
    evaluateObservationTransition(
      { ...active, qualityGateApproved: false },
      EH120_SERVICE_REQUEST,
    ),
    "quality_gate_not_approved",
  );
  denied(
    evaluateObservationTransition(
      EH120_TRANSITION_FIXTURES.userVerified,
      request({
        operation: "verify_auto",
        actorType: "system",
        isOwner: false,
        isServiceRole: true,
        expectedActiveRevisionId: EH120_TRANSITION_FIXTURES.userVerified.activeRevisionId,
      }),
    ),
    "protected_human_decision",
  );
  denied(
    evaluateObservationTransition(
      active,
      request({ operation: "reject", reasonCode: "not-allowlisted" }),
    ),
    "invalid_reason_code",
  );
  allowed(
    evaluateObservationTransition(
      active,
      request({ operation: "reject", reasonCode: "incorrect_extraction" }),
    ),
    { recordStatus: "rejected" },
  );
  denied(
    evaluateObservationTransition(
      active,
      request({ operation: "reject", reasonCode: "incorrect_extraction", isOwner: false }),
    ),
    "foreign_owner",
  );
  denied(
    evaluateObservationTransition(active, EH120_STALE_REQUEST),
    "stale_source_snapshot",
  );
  allowed(
    evaluateObservationTransition(
      active,
      request({
        operation: "supersede",
        actorType: "system",
        isOwner: false,
        isServiceRole: true,
        reasonCode: "document_reprocessed",
      }),
    ),
    { recordStatus: "superseded" },
  );
  denied(
    evaluateObservationTransition(
      EH120_TRANSITION_FIXTURES.userVerified,
      request({
        operation: "supersede",
        actorType: "system",
        isOwner: false,
        isServiceRole: true,
        reasonCode: "document_reprocessed",
        expectedActiveRevisionId: EH120_TRANSITION_FIXTURES.userVerified.activeRevisionId,
      }),
    ),
    "protected_human_decision",
  );
  denied(
    evaluateObservationTransition(
      EH120_TRANSITION_FIXTURES.rejected,
      request({ operation: "reject", reasonCode: "other" }),
    ),
    "terminal_record",
  );
  allowed(
    evaluateObservationTransition(
      EH120_TRANSITION_FIXTURES.autoVerified,
      request({
        operation: "reverse",
        reasonCode: "Owner requested a second review",
        expectedActiveRevisionId: EH120_TRANSITION_FIXTURES.autoVerified.activeRevisionId,
      }),
    ),
    { resolutionStatus: "resolved", verificationStatus: "pending", recordStatus: "active" },
  );

  // --- Review projection and action exclusion -------------------------------
  const activeRevision = {
    id: "eh120-revision-pending",
    extracted_biomarker_id: "eh120-extracted-1",
    measurement_definition_key: "glucose_serum",
    analyte_key: "glucose",
    resolver_result: "resolved",
    mapping_confidence: 0.98,
    mapping_confidence_band: "high",
    verification_status: "pending",
    is_active: true,
    catalog_manifest_version: "eh120-test-catalog",
    resolver_version: "eh120-test-resolver",
    normalization_version: "eh120-test-normalization",
    resolver_decision_trace: null,
    resolver_trace_schema_version: null,
    measurement_override: null,
    created_at: "2026-08-13T10:00:00.000Z",
  } as const;
  const activeActions = buildNormalizationActionAvailability({
    recordStatus: "active",
    sourceIsCurrent: true,
    reviewable: true,
    outcome: "resolved",
    registryBindingReady: true,
    activeRevision: activeRevision as never,
    verificationStatus: "pending",
  });
  assert.equal(activeActions.verifyUser.available, true);
  assert.equal(activeActions.verifyAuto.available, false);
  assert.equal(activeActions.verifyAuto.exclusionReason, "system_only");
  assert.equal(activeActions.reject.available, true);

  const incompleteActions = buildNormalizationActionAvailability({
    recordStatus: "active",
    sourceIsCurrent: true,
    reviewable: true,
    outcome: "partial",
    registryBindingReady: false,
    activeRevision: null,
    verificationStatus: "pending",
  });
  assert.equal(incompleteActions.acceptRaw.available, true);
  assert.equal(incompleteActions.verifyUser.available, false);
  assert.equal(incompleteActions.verifyUser.exclusionReason, "incomplete_outcome");
  assert.equal(incompleteActions.batchVerify.available, false);

  const activeRow = buildExtractedReviewRow({
    id: "eh120-extracted-1",
    biomarker_name: "Glucose",
    raw_name: "GLU",
    value_numeric: 90,
    value_text: null,
    value_kind: "numeric",
    unit: "mg/dL",
    raw_unit: "mg/dL",
    raw_value_text: "90",
    reference_range: "70 - 99",
    raw_reference_range: "70 - 99",
    specimen: "serum",
    modifier: "none",
    method: null,
    confidence: 0.98,
    source_page: 1,
    source_text: "GLU 90 mg/dL",
    status: "needs_review",
    normalization: {
      result: "resolved",
      mappingConfidenceBand: "high",
      registryBindingReady: true,
      resolutionDetails: resolutionDetails("resolved", "pending"),
      recordStatus: "active",
      sourceIsCurrent: true,
      actionAvailability: activeActions,
      activeRevision: { verification_status: "pending" },
    },
  });
  assert.equal(activeRow.mapping.label, "Matched measurement");
  assert.equal(activeRow.mapping.verificationLabel, "Not verified yet");
  assert.equal(activeRow.mapping.recordStatusLabel, "Active");
  assert.equal(activeRow.reviewable, true);

  const supersededActions = buildNormalizationActionAvailability({
    recordStatus: "superseded",
    sourceIsCurrent: false,
    reviewable: false,
    outcome: "resolved",
    registryBindingReady: true,
    activeRevision: activeRevision as never,
    verificationStatus: "pending",
  });
  const supersededRow = buildExtractedReviewRow({
    id: "eh120-extracted-old",
    biomarker_name: "Glucose",
    raw_name: "GLU (old extraction)",
    value_numeric: 89,
    value_text: null,
    value_kind: "numeric",
    unit: "mg/dL",
    raw_unit: "mg/dL",
    raw_value_text: "89",
    reference_range: "70 - 99",
    raw_reference_range: "70 - 99",
    specimen: "serum",
    modifier: "none",
    method: null,
    confidence: 0.9,
    source_page: 1,
    source_text: "GLU 89 mg/dL",
    status: "accepted",
    record_status: "superseded",
    is_current: false,
    superseded_at: "2026-08-13T10:05:00.000Z",
    superseded_by_processing_attempt_id: "eh120-processing-2",
    normalization: {
      result: "resolved",
      mappingConfidenceBand: "high",
      registryBindingReady: true,
      resolutionDetails: resolutionDetails("resolved", "pending"),
      recordStatus: "superseded",
      sourceIsCurrent: false,
      lifecycleReasonCode: "document_reprocessed",
      supersededAt: "2026-08-13T10:05:00.000Z",
      supersededByProcessingAttemptId: "eh120-processing-2",
      actionAvailability: supersededActions,
      activeRevision: { verification_status: "pending" },
    },
  });
  assert.equal(supersededRow.reviewable, false);
  assert.equal(supersededRow.sourceIsCurrent, false);
  assert.equal(supersededRow.mapping.recordStatusLabel, "Superseded");
  assert.equal(supersededRow.mapping.verificationLabel, "Not verified yet");
  assert.equal(supersededRow.actionAvailability?.reject.available, false);
  assert.equal(supersededRow.actionAvailability?.batchVerify.available, false);

  const rejectedObservation = buildObservationReviewRow({
    id: "eh120-observation-rejected",
    name: "Glucose",
    raw_name: "GLU",
    value: 90,
    value_kind: "numeric",
    value_text: null,
    unit: "mg/dL",
    raw_unit: "mg/dL",
    raw_value_text: "90",
    raw_reference_text: "70 - 99",
    ref_low: 70,
    ref_high: 99,
    source_page: 1,
    source_text: "GLU 90 mg/dL",
    resolver_result: "resolved",
    verification_status: "user_verified",
    record_status: "rejected",
    is_current: true,
    registry_binding_ready: true,
    resolution_details: resolutionDetails("resolved", "user_verified"),
  });
  assert.equal(rejectedObservation.mapping.recordStatusLabel, "Rejected");
  assert.equal(rejectedObservation.mapping.verificationLabel, "Verified by you");
  assert.equal(rejectedObservation.sourceIsCurrent, false);

  const legacySupersededReview = buildNormalizationReview(
    {
      id: "eh120-legacy-superseded",
      biomarker_key: null,
      biomarker_name: "Unknown result",
      raw_name: "Unknown result",
      value_numeric: 1,
      value_text: null,
      value_kind: "numeric",
      unit: "unit",
      raw_unit: "unit",
      reference_range: null,
      raw_reference_range: null,
      raw_value_text: "1",
      source_text: "Unknown result 1 unit",
      confidence: 0.4,
      specimen: null,
      modifier: null,
      method: null,
      status: "accepted",
      record_status: "superseded",
      is_current: false,
      lifecycle_reason_code: "document_reprocessed",
      superseded_at: "2026-08-13T10:05:00.000Z",
      superseded_by_processing_attempt_id: "eh120-processing-2",
      measurement_definition_key: null,
      resolver_result: "unmapped",
    },
    [],
  );
  assert.equal(legacySupersededReview.recordStatus, "superseded");
  assert.equal(legacySupersededReview.sourceIsCurrent, false);
  assert.equal(legacySupersededReview.actionAvailability.acceptRaw.available, false);
  assert.equal(legacySupersededReview.actionAvailability.reject.available, false);

  // --- EH-121 lifecycle read model ------------------------------------------
  const rejectedEvent = buildObservationChangeEntry(auditEvent(), {
    viewerProfileId: "eh120-owner-1",
  });
  assert.ok(rejectedEvent);
  assert.equal(rejectedEvent?.headline, "Source record rejected");
  assert.equal(rejectedEvent?.reasonCode, "incorrect_extraction");
  assert.equal(rejectedEvent?.priorRecordStatus, "active");
  assert.equal(rejectedEvent?.nextRecordStatus, "rejected");
  assert.deepEqual(
    rejectedEvent?.fields.find((field) => field.field === "record_status"),
    {
      field: "record_status",
      label: "Record lifecycle",
      from: "active",
      to: "rejected",
    },
  );
  const supersededEvent = buildObservationChangeEntry(
    auditEvent({
      id: "eh120-event-2",
      event_kind: "record_superseded",
      actor_type: "system",
      actor_id: null,
      next_record_status: "superseded",
      reason_code: "document_reprocessed",
    }),
  );
  assert.equal(supersededEvent?.actorLabel, "Automatic");
  assert.equal(supersededEvent?.reasonCode, "document_reprocessed");
  assert.equal(supersededEvent?.nextRecordStatus, "superseded");

  // --- API/service boundaries -----------------------------------------------
  const rejectionRoute = readFileSync(
    path.join(ROOT, "src/app/api/documents/[id]/biomarkers/reject/route.ts"),
    "utf8",
  );
  assert.match(rejectionRoute, /assertDocumentOwner/);
  assert.match(rejectionRoute, /isRejectionReasonCode/);
  assert.match(rejectionRoute, /confirm\?\.confirm|body\?\.confirm|confirm: true/);
  assert.match(rejectionRoute, /expectedSourceSnapshot/);
  assert.match(rejectionRoute, /expectedActiveRevisionId/);
  assert.match(rejectionRoute, /stale_source_snapshot/);
  assert.match(rejectionRoute, /ObservationLifecycleError/);
  const acceptanceRoute = readFileSync(
    path.join(ROOT, "src/app/api/documents/[id]/biomarkers/accept/route.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    acceptanceRoute,
    /body\.verification_status|body\.record_status|body\.actor_type/,
  );
  assert.match(acceptanceRoute, /acceptExtractedBiomarkers/);

  const reviewRow = readFileSync(
    path.join(ROOT, "src/components/documents/review/observation-review-row.tsx"),
    "utf8",
  );
  assert.match(reviewRow, /data-review-row-read-only/);
  assert.match(reviewRow, /mapping\.recordStatus !== "active"/);
  assert.match(reviewRow, /Historical evidence/);
  const viewer = readFileSync(
    path.join(ROOT, "src/components/documents/document-viewer.tsx"),
    "utf8",
  );
  assert.match(viewer, /row\.actionAvailability\?\.reject\.available/);
  assert.match(viewer, /row\.sourceIsCurrent/);
  assert.match(viewer, /rejectionErrorMessage/);
  assert.match(viewer, /was marked Rejected/);
  const writer = readFileSync(
    path.join(ROOT, "src/lib/documents/observation-normalization-writer.ts"),
    "utf8",
  );
  assert.match(writer, /writeAutomaticBiomarkerVerification/);
  assert.match(writer, /decideAutomaticPromotion/);
  assert.match(writer, /p_resolution:\s*buildResolutionPayload/);
  assert.match(writer, /p_quality_gate_approved/);
  const workerPipeline = readFileSync(
    path.join(ROOT, "worker/src/pipeline.ts"),
    "utf8",
  );
  assert.match(workerPipeline, /writeAutomaticBiomarkerVerification/);
  assert.match(workerPipeline, /isAutomaticVerificationReleaseApproved/);
  const lifecycleService = readFileSync(
    path.join(ROOT, "src/lib/documents/observation-lifecycle.ts"),
    "utf8",
  );
  assert.match(lifecycleService, /eh120_reject_document_extracted_biomarker/);
  assert.match(lifecycleService, /buildLifecycleRequestHash/);
  const transitionMigration = readFileSync(
    path.join(ROOT, "supabase/migrations/060_eh120_verification_transitions.sql"),
    "utf8",
  );
  assert.match(transitionMigration, /eh120_reject_document_extracted_biomarker/);
  assert.match(transitionMigration, /record_status/);
  assert.match(transitionMigration, /transition_request_hash/);
  assert.match(transitionMigration, /auto_verified/);
  assert.match(transitionMigration, /verification_actor_type/);
  assert.match(transitionMigration, /to service_role/);
  assert.match(transitionMigration, /eh120_hide_incomplete_attempt_sources/);
  assert.match(transitionMigration, /retryable_failure/);

  console.log("verify-eh120-verification-transitions: all checks passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
