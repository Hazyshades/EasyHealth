import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HEALTH_PROFILE_FRESHNESS_POLICY } from "../src/lib/health-profile-freshness";
import {
  hasCanonicalReadinessContract,
  projectHealthProfileAssessmentRead,
  type HealthProfileAssessmentJobRead,
  type HealthProfileAssessmentVersionRead,
} from "../src/lib/health-profile-assessment-read";
import type {
  HealthProfileAssessment,
  HealthProfileSnapshot,
} from "../src/lib/health-profile-snapshot";
import { buildHealthProfile } from "../src/lib/health-systems";

const EVALUATED_AT = "2026-09-12T12:00:00.000Z";
const REPORTED_RESULTS = {
  reported_count: 2,
  ready_for_scoring_count: 1,
  needs_document_details_count: 0,
  awaiting_catalog_review_count: 1,
  awaiting_verification_count: 0,
  source_document_count: 1,
};

const scoreableSource = {
  id: "document-scoreable",
  original_filename: "scoreable.pdf",
  observed_at: "2026-09-12",
  lab_name: "Synthetic Lab",
  document_type: "lab_result",
};
const scoreableObservations = [
  {
    observation_id: "observation-ldl",
    biomarker_key: "ldl",
    measurement_definition_key: "ldl_serum",
    resolution_status: "resolved" as const,
    name: "LDL",
    value: 90,
    unit: "mg/dL",
    ref_low: 0,
    ref_high: 200,
    observed_at: "2026-09-12",
    document_id: scoreableSource.id,
    observation_kind: "lab" as const,
    value_kind: "numeric" as const,
    specimen: "serum",
  },
  {
    observation_id: "observation-hdl",
    biomarker_key: "hdl",
    measurement_definition_key: "hdl_serum",
    resolution_status: "resolved" as const,
    name: "HDL",
    value: 55,
    unit: "mg/dL",
    ref_low: 0,
    ref_high: 200,
    observed_at: "2026-09-12",
    document_id: scoreableSource.id,
    observation_kind: "lab" as const,
    value_kind: "numeric" as const,
    specimen: "serum",
  },
  {
    observation_id: "observation-triglycerides",
    biomarker_key: "triglycerides",
    measurement_definition_key: "triglycerides_serum",
    resolution_status: "resolved" as const,
    name: "Triglycerides",
    value: 100,
    unit: "mg/dL",
    ref_low: 0,
    ref_high: 200,
    observed_at: "2026-09-12",
    document_id: scoreableSource.id,
    observation_kind: "lab" as const,
    value_kind: "numeric" as const,
    specimen: "serum",
  },
];

const canonicalProfile: HealthProfileAssessment = {
  ...buildHealthProfile(scoreableObservations, [scoreableSource], {
    freshnessAsOf: "2026-09-12",
    freshnessEvaluatedAt: EVALUATED_AT,
    freshnessPolicy: HEALTH_PROFILE_FRESHNESS_POLICY,
    reportedResults: REPORTED_RESULTS,
  }),
  assessment_freshness: "current",
  freshness_policy_version: HEALTH_PROFILE_FRESHNESS_POLICY.version,
  freshness_evaluated_at: EVALUATED_AT,
};
const canonicalCardiovascular = canonicalProfile.systems.find(
  (system) => system.id === "cardiovascular",
);
assert.ok(canonicalCardiovascular);
assert.equal(canonicalCardiovascular.state_score !== null, true);

const fallbackProfile: HealthProfileAssessment = {
  ...canonicalProfile,
  overall_state_score: 42,
  freshness_evaluated_at: "2026-09-12T12:01:00.000Z",
};

const fallbackSnapshot: HealthProfileSnapshot = {
  inputHash: "fallback-input-hash",
  profile: fallbackProfile,
  sourceDocumentIds: ["document-fallback"],
  freshnessPolicyVersion: HEALTH_PROFILE_FRESHNESS_POLICY.version,
  freshnessEvaluatedAt: "2026-09-12T12:01:00.000Z",
};

const canonicalVersion: HealthProfileAssessmentVersionRead = {
  id: "version-canonical",
  payload: canonicalProfile,
  generated_at: "2026-09-12T12:00:00.000Z",
  input_hash: "persisted-input-hash",
  freshness_policy_version: HEALTH_PROFILE_FRESHNESS_POLICY.version,
};

function job(status: string): HealthProfileAssessmentJobRead {
  const failed = status === "failed" || status === "retryable_failed";
  const result: HealthProfileAssessmentJobRead = {
    status,
    attempts: 2,
    max_attempts: 4,
    last_error_code: failed ? "assessment_failed" : null,
    last_error_message: failed ? "Synthetic recalculation failure" : null,
  };
  return result;
}

assert.equal(hasCanonicalReadinessContract(canonicalProfile), true);
assert.equal(
  hasCanonicalReadinessContract({
    ...canonicalProfile,
    freshness_policy_version: "retired-policy",
  }),
  false,
);
assert.equal(
  hasCanonicalReadinessContract({
    ...canonicalProfile,
    systems: [{ score_readiness: null }],
  }),
  false,
);
const legacyPayload = { ...canonicalProfile } as Record<string, unknown>;
delete legacyPayload.freshness_policy_version;
assert.equal(hasCanonicalReadinessContract(legacyPayload), false);
assert.equal(hasCanonicalReadinessContract(null), false);

const canonicalStates: Array<
  [string | null, "current" | "outdated" | "error"]
> = [
  [null, "current"],
  ["succeeded", "current"],
  ["queued", "outdated"],
  ["processing", "outdated"],
  ["retryable_failed", "error"],
  ["failed", "error"],
];

for (const [status, expectedDisplayState] of canonicalStates) {
  const result = projectHealthProfileAssessmentRead({
    version: canonicalVersion,
    job: status === null ? null : job(status),
    fallback: null,
  });
  const cardiovascular = result.profile?.systems.find(
    (system) => system.id === "cardiovascular",
  );
  assert.equal(
    cardiovascular?.state_score,
    canonicalCardiovascular.state_score,
  );
  assert.equal(
    result.profile?.overall_state_score,
    canonicalProfile.overall_state_score,
  );
  assert.equal(result.profile, canonicalProfile);
  assert.equal(result.assessment.display_state, expectedDisplayState);
  assert.equal(result.assessment.has_current_version, true);
  assert.equal(result.assessment.fallback, false);
  assert.equal(result.assessment.version_id, "version-canonical");
  assert.equal(result.assessment.input_hash, "persisted-input-hash");
  assert.equal(result.assessment.generated_at, "2026-09-12T12:00:00.000Z");
  assert.equal(
    result.assessment.freshness_policy_version,
    HEALTH_PROFILE_FRESHNESS_POLICY.version,
  );
  assert.equal(result.assessment.freshness_evaluated_at, EVALUATED_AT);
  assert.equal(result.assessment.attempts, status === null ? 0 : 2);
  assert.equal(result.assessment.max_attempts, status === null ? 0 : 4);
  assert.equal(
    result.assessment.error_code,
    expectedDisplayState === "error" ? "assessment_failed" : null,
  );
}

const fallbackPayloads: unknown[] = [
  undefined,
  legacyPayload,
  { ...canonicalProfile, systems: [{ score_readiness: null }] },
  { ...canonicalProfile, freshness_policy_version: "retired-policy" },
];

for (const payload of fallbackPayloads) {
  const result = projectHealthProfileAssessmentRead({
    version: payload === undefined ? null : { ...canonicalVersion, payload },
    job: null,
    fallback: fallbackSnapshot,
  });
  assert.equal(result.profile, fallbackProfile);
  assert.equal(result.assessment.display_state, "processing");
  assert.equal(result.assessment.has_current_version, false);
  assert.equal(result.assessment.fallback, true);
  assert.equal(result.assessment.version_id, null);
  assert.equal(result.assessment.input_hash, "fallback-input-hash");
  assert.equal(result.assessment.generated_at, "2026-09-12T12:01:00.000Z");
  assert.equal(
    result.assessment.freshness_policy_version,
    HEALTH_PROFILE_FRESHNESS_POLICY.version,
  );
  assert.equal(
    result.assessment.freshness_evaluated_at,
    fallbackSnapshot.freshnessEvaluatedAt,
  );
}

const fallbackStates: Array<[string | null, "processing" | "error"]> = [
  [null, "processing"],
  ["queued", "processing"],
  ["processing", "processing"],
  ["succeeded", "processing"],
  ["retryable_failed", "error"],
  ["failed", "error"],
];

for (const [status, expectedDisplayState] of fallbackStates) {
  const result = projectHealthProfileAssessmentRead({
    version: null,
    job: status === null ? null : job(status),
    fallback: fallbackSnapshot,
  });
  assert.equal(result.profile, fallbackProfile);
  assert.equal(result.assessment.display_state, expectedDisplayState);
  assert.equal(result.assessment.has_current_version, false);
  assert.equal(result.assessment.fallback, true);
  assert.equal(
    result.assessment.error_code,
    expectedDisplayState === "error" ? "assessment_failed" : null,
  );
  assert.equal(
    result.assessment.error_message,
    expectedDisplayState === "error" ? "Synthetic recalculation failure" : null,
  );
}

const routeSource = readFileSync(
  resolve(process.cwd(), "src/app/api/health-profile/route.ts"),
  "utf8",
);
const profilePageSource = readFileSync(
  resolve(process.cwd(), "src/app/app/profile/page.tsx"),
  "utf8",
);
const dashboardSource = readFileSync(
  resolve(process.cwd(), "src/app/app/page.tsx"),
  "utf8",
);
assert.match(routeSource, /projectHealthProfileAssessmentRead/);
assert.match(routeSource, /buildHealthProfileSnapshot/);
assert.doesNotMatch(
  profilePageSource,
  /assessment\?: HealthProfileAssessmentRead/,
);
assert.match(profilePageSource, /assessment: HealthProfileAssessmentRead/);
assert.doesNotMatch(
  dashboardSource,
  /assessment\?: HealthProfileAssessmentRead/,
);
assert.match(dashboardSource, /assessment: HealthProfileAssessmentRead/);
assert.match(dashboardSource, /if \(!response\.ok\)/);
assert.match(dashboardSource, /healthProfileData\.assessment\.display_state/);
assert.doesNotMatch(dashboardSource, /assessment\?\.display_state/);
assert.doesNotMatch(
  dashboardSource,
  /assessment\?\.display_state \?\? "current"/,
);

console.log("verify-health-profile-assessment-read: all checks passed");
