import { HEALTH_PROFILE_FRESHNESS_POLICY } from "@/lib/health-profile-freshness";
import {
  resolveAssessmentDisplayState,
  type HealthProfileAssessmentDisplayState,
  type HealthProfileAssessmentJobStatus,
} from "@/lib/health-profile-assessment-state";
import type {
  HealthProfileAssessment,
  HealthProfileSnapshot,
} from "@/lib/health-profile-snapshot";
import type { HealthProfileReportedResults } from "@/lib/health-profile-reported-results";

const REPORTED_RESULT_COUNT_KEYS: readonly (keyof HealthProfileReportedResults)[] =
  [
    "reported_count",
    "ready_for_scoring_count",
    "needs_document_details_count",
    "awaiting_catalog_review_count",
    "awaiting_verification_count",
    "source_document_count",
  ];

export type HealthProfileAssessmentVersionRead = Readonly<{
  id: string;
  payload: unknown;
  generated_at?: string | null;
  input_hash?: string | null;
  freshness_policy_version?: string | null;
}>;

export type HealthProfileAssessmentJobRead = Readonly<{
  status?: string | null;
  attempts?: number | null;
  max_attempts?: number | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
}>;

/** Assessment metadata projected beside the selected Health Profile payload. */
export type HealthProfileAssessmentRead = Readonly<{
  status: HealthProfileAssessmentJobStatus;
  display_state: HealthProfileAssessmentDisplayState;
  has_current_version: boolean;
  version_id: string | null;
  input_hash: string | null;
  generated_at: string | null;
  freshness_policy_version: string | null;
  freshness_evaluated_at: string | null;
  attempts: number;
  max_attempts: number;
  error_code: string | null;
  error_message: string | null;
  fallback: boolean;
}>;

export type HealthProfileAssessmentReadProjection = Readonly<{
  profile: HealthProfileAssessment | null;
  assessment: HealthProfileAssessmentRead;
}>;

export function hasCanonicalReportedResults(
  value: unknown,
): value is HealthProfileReportedResults {
  if (!value || typeof value !== "object") return false;
  const summary = value as Record<string, unknown>;
  return REPORTED_RESULT_COUNT_KEYS.every(
    (key) =>
      typeof summary[key] === "number" &&
      Number.isInteger(summary[key]) &&
      summary[key] >= 0,
  );
}

/**
 * Returns true only for the current persisted readiness/read-results shape.
 * Retired or incomplete payloads must use the request-time fallback instead.
 */
export function hasCanonicalReadinessContract(
  value: unknown,
): value is HealthProfileAssessment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (
    !("assessment_freshness" in candidate) ||
    !("systems" in candidate) ||
    !("freshness_policy_version" in candidate) ||
    !("reported_results" in candidate) ||
    !hasCanonicalReportedResults(candidate.reported_results)
  ) {
    return false;
  }
  if (
    candidate.freshness_policy_version !==
    HEALTH_PROFILE_FRESHNESS_POLICY.version
  ) {
    return false;
  }
  if (
    candidate.assessment_freshness !== "current" &&
    candidate.assessment_freshness !== "outdated"
  ) {
    return false;
  }
  if (!Array.isArray(candidate.systems)) return false;

  return candidate.systems.every((system) => {
    if (!system || typeof system !== "object") return false;
    const candidateSystem = system as Record<string, unknown>;
    const scoreReadiness = candidateSystem.score_readiness;
    if (!scoreReadiness || typeof scoreReadiness !== "object") return false;
    const readiness = scoreReadiness as Record<string, unknown>;
    return (
      "required_groups" in readiness &&
      "reasons" in readiness &&
      Array.isArray(readiness.required_groups) &&
      Array.isArray(readiness.reasons)
    );
  });
}

function normalizeAssessmentJobStatus(
  status: string | null | undefined,
  hasCurrentVersion: boolean,
): HealthProfileAssessmentJobStatus {
  switch (status) {
    case "queued":
    case "processing":
    case "retryable_failed":
    case "failed":
    case "succeeded":
      return status;
    default:
      return hasCurrentVersion ? "succeeded" : "queued";
  }
}

/**
 * Selects the durable or request-time profile and assembles one lifecycle read
 * contract. It performs no authentication, database access, or fallback I/O.
 */
export function projectHealthProfileAssessmentRead(input: {
  version?: HealthProfileAssessmentVersionRead | null;
  job?: HealthProfileAssessmentJobRead | null;
  fallback?: HealthProfileSnapshot | null;
}): HealthProfileAssessmentReadProjection {
  const version = input.version ?? null;
  const fallback = input.fallback ?? null;
  const persistedProfile = hasCanonicalReadinessContract(version?.payload)
    ? version.payload
    : null;
  const profile = persistedProfile ?? fallback?.profile ?? null;
  const hasCurrentVersion = persistedProfile !== null;
  const status = normalizeAssessmentJobStatus(
    input.job?.status,
    hasCurrentVersion,
  );
  const persistedVersion = persistedProfile ? version : null;

  return {
    profile,
    assessment: {
      version_id: persistedVersion?.id ?? null,
      input_hash: persistedVersion?.input_hash ?? fallback?.inputHash ?? null,
      generated_at:
        persistedVersion?.generated_at ??
        fallback?.freshnessEvaluatedAt ??
        null,
      freshness_policy_version:
        persistedVersion?.freshness_policy_version ??
        fallback?.freshnessPolicyVersion ??
        profile?.freshness_policy_version ??
        null,
      freshness_evaluated_at:
        profile?.freshness_evaluated_at ??
        fallback?.freshnessEvaluatedAt ??
        null,
      status,
      display_state: resolveAssessmentDisplayState(status, hasCurrentVersion),
      has_current_version: hasCurrentVersion,
      attempts: input.job?.attempts ?? 0,
      max_attempts: input.job?.max_attempts ?? 0,
      error_code: input.job?.last_error_code ?? null,
      error_message: input.job?.last_error_message ?? null,
      fallback: !hasCurrentVersion && fallback !== null,
    },
  };
}
