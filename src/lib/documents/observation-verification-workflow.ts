import type { ResolverResult, VerificationStatus } from "@/lib/biomarkers";
export type { ResolverResult, VerificationStatus } from "@/lib/biomarkers";

/** The resolver axis is deliberately independent from trust and lifecycle. */
export type ResolutionStatus = ResolverResult;

/** The source-record lifecycle owned by document extraction. */
export type RecordStatus = "active" | "rejected" | "superseded";

export type WorkflowActorType = "user" | "system";

export type ObservationTransitionOperation =
  | "retain_raw"
  | "verify_user"
  | "verify_auto"
  | "correct"
  | "reverse"
  | "reject"
  | "supersede";

/** Stable, non-PII reasons accepted by lifecycle transitions. */
export type RejectionReasonCode =
  | "incorrect_extraction"
  | "duplicate_source"
  | "wrong_document"
  | "privacy_request"
  | "other";

export type LifecycleReasonCode =
  | RejectionReasonCode
  | "document_reprocessed"
  | "catalog_reprocessed"
  | "verification_reversed"
  | "protected_human_decision"
  | "retryable_failure"
  | "automatic_quality_gate";

export type TransitionErrorCode =
  | "authorization_required"
  | "foreign_owner"
  | "service_role_required"
  | "stale_source_snapshot"
  | "stale_revision_snapshot"
  | "protected_human_decision"
  | "incomplete_outcome"
  | "quality_gate_not_approved"
  | "invalid_reason_code"
  | "reason_required"
  | "record_not_current"
  | "terminal_record"
  | "invalid_transition"
  | "idempotency_conflict";

export type ObservationTransitionSnapshot = Readonly<{
  resolutionStatus: ResolutionStatus;
  verificationStatus: VerificationStatus;
  recordStatus: RecordStatus;
  sourceIsCurrent: boolean;
  hasConcreteDefinition: boolean;
  hasActiveRevision: boolean;
  hasProtectedHumanDecision: boolean;
  qualityGateApproved: boolean;
  sourceSnapshot?: string | null;
  activeRevisionId?: string | null;
}>;

export type ObservationTransitionRequest = Readonly<{
  operation: ObservationTransitionOperation;
  actorType: WorkflowActorType;
  isOwner: boolean;
  isServiceRole: boolean;
  reasonCode?: string | null;
  expectedSourceSnapshot?: string | null;
  expectedActiveRevisionId?: string | null;
}>;

export type ObservationTransitionDecision =
  | Readonly<{
      allowed: true;
      operation: ObservationTransitionOperation;
      prior: ObservationTransitionSnapshot;
      next: Pick<ObservationTransitionSnapshot, "resolutionStatus" | "verificationStatus" | "recordStatus">;
      reasonCode: LifecycleReasonCode | null;
    }>
  | Readonly<{
      allowed: false;
      operation: ObservationTransitionOperation;
      errorCode: TransitionErrorCode;
      prior: ObservationTransitionSnapshot;
    }>;

type TransitionRule = Readonly<{
  operation: ObservationTransitionOperation;
  name: string;
  matches: (snapshot: ObservationTransitionSnapshot, request: ObservationTransitionRequest) => boolean;
  next: (
    snapshot: ObservationTransitionSnapshot,
  ) => Pick<ObservationTransitionSnapshot, "resolutionStatus" | "verificationStatus" | "recordStatus">;
  reasonCode: LifecycleReasonCode | null;
}>;

const INCOMPLETE_RESULTS: Readonly<Record<ResolutionStatus, boolean>> = {
  resolved: false,
  partial: true,
  ambiguous: true,
  unmapped: true,
};

const VERIFIED_STATUSES: Readonly<Record<VerificationStatus, boolean>> = {
  pending: false,
  auto_verified: true,
  user_verified: true,
  manually_corrected: true,
};

const REJECTION_REASONS: Readonly<Record<RejectionReasonCode, true>> = {
  incorrect_extraction: true,
  duplicate_source: true,
  wrong_document: true,
  privacy_request: true,
  other: true,
};

export const REJECTION_REASON_LABELS: Readonly<
  Record<RejectionReasonCode, string>
> = {
  incorrect_extraction: "The result was extracted incorrectly",
  duplicate_source: "The result is a duplicate source",
  wrong_document: "The result belongs to another document",
  privacy_request: "Remove this result at my request",
  other: "Other allowed reason",
};

const LIFECYCLE_REASONS: Readonly<Record<LifecycleReasonCode, true>> = {
  ...REJECTION_REASONS,
  document_reprocessed: true,
  catalog_reprocessed: true,
  verification_reversed: true,
  protected_human_decision: true,
  retryable_failure: true,
  automatic_quality_gate: true,
};

function isRejectionReason(value: string | null | undefined): value is RejectionReasonCode {
  return typeof value === "string" && Object.hasOwn(REJECTION_REASONS, value);
}

function isLifecycleReason(value: string | null | undefined): value is LifecycleReasonCode {
  return typeof value === "string" && Object.hasOwn(LIFECYCLE_REASONS, value);
}

function isExpectedSourceSnapshotStale(
  snapshot: ObservationTransitionSnapshot,
  request: ObservationTransitionRequest,
): boolean {
  return (
    request.expectedSourceSnapshot !== undefined &&
    request.expectedSourceSnapshot !== (snapshot.sourceSnapshot ?? null)
  );
}

function isExpectedRevisionStale(
  snapshot: ObservationTransitionSnapshot,
  request: ObservationTransitionRequest,
): boolean {
  return (
    request.expectedActiveRevisionId !== undefined &&
    request.expectedActiveRevisionId !== (snapshot.activeRevisionId ?? null)
  );
}

function isUserOwner(request: ObservationTransitionRequest): boolean {
  return request.actorType === "user" && request.isOwner;
}

function isServiceActor(request: ObservationTransitionRequest): boolean {
  return request.actorType === "system" && request.isServiceRole;
}

function isProtected(snapshot: ObservationTransitionSnapshot): boolean {
  return (
    snapshot.hasProtectedHumanDecision ||
    snapshot.verificationStatus === "user_verified" ||
    snapshot.verificationStatus === "manually_corrected"
  );
}

const ACTIVE_RULES: readonly TransitionRule[] = [
  {
    operation: "retain_raw",
    name: "active-incomplete-raw-retention",
    matches: (snapshot, request) =>
      snapshot.recordStatus === "active" &&
      snapshot.sourceIsCurrent &&
      INCOMPLETE_RESULTS[snapshot.resolutionStatus] &&
      snapshot.verificationStatus === "pending" &&
      (isUserOwner(request) || isServiceActor(request)),
    next: (snapshot) => ({
      resolutionStatus: snapshot.resolutionStatus,
      verificationStatus: "pending",
      recordStatus: "active",
    }),
    reasonCode: null,
  },
  {
    operation: "verify_user",
    name: "active-resolved-user-verification",
    matches: (snapshot, request) =>
      snapshot.recordStatus === "active" &&
      snapshot.sourceIsCurrent &&
      snapshot.resolutionStatus === "resolved" &&
      snapshot.hasConcreteDefinition &&
      snapshot.hasActiveRevision &&
      snapshot.verificationStatus === "pending" &&
      isUserOwner(request),
    next: () => ({
      resolutionStatus: "resolved",
      verificationStatus: "user_verified",
      recordStatus: "active",
    }),
    reasonCode: null,
  },
  {
    operation: "verify_auto",
    name: "active-resolved-automatic-verification",
    matches: (snapshot, request) =>
      snapshot.recordStatus === "active" &&
      snapshot.sourceIsCurrent &&
      snapshot.resolutionStatus === "resolved" &&
      snapshot.hasConcreteDefinition &&
      snapshot.hasActiveRevision &&
      snapshot.verificationStatus === "pending" &&
      snapshot.qualityGateApproved &&
      !isProtected(snapshot) &&
      isServiceActor(request),
    next: () => ({
      resolutionStatus: "resolved",
      verificationStatus: "auto_verified",
      recordStatus: "active",
    }),
    reasonCode: "automatic_quality_gate",
  },
  {
    operation: "correct",
    name: "active-resolved-manual-correction",
    matches: (snapshot, request) =>
      snapshot.recordStatus === "active" &&
      snapshot.sourceIsCurrent &&
      snapshot.resolutionStatus === "resolved" &&
      snapshot.hasConcreteDefinition &&
      snapshot.hasActiveRevision &&
      isUserOwner(request) &&
      typeof request.reasonCode === "string" &&
      request.reasonCode.trim().length > 0,
    next: () => ({
      resolutionStatus: "resolved",
      verificationStatus: "manually_corrected",
      recordStatus: "active",
    }),
    reasonCode: null,
  },
  {
    operation: "reverse",
    name: "active-verification-reversal",
    matches: (snapshot, request) =>
      snapshot.recordStatus === "active" &&
      snapshot.sourceIsCurrent &&
      snapshot.hasActiveRevision &&
      VERIFIED_STATUSES[snapshot.verificationStatus] &&
      isUserOwner(request) &&
      typeof request.reasonCode === "string" &&
      request.reasonCode.trim().length > 0,
    next: (snapshot) => ({
      resolutionStatus: snapshot.resolutionStatus,
      verificationStatus: "pending",
      recordStatus: "active",
    }),
    reasonCode: "verification_reversed",
  },
  {
    operation: "reject",
    name: "active-owner-rejection",
    matches: (snapshot, request) =>
      snapshot.recordStatus === "active" &&
      snapshot.sourceIsCurrent &&
      isUserOwner(request) &&
      isRejectionReason(request.reasonCode),
    next: (snapshot) => ({
      resolutionStatus: snapshot.resolutionStatus,
      verificationStatus: snapshot.verificationStatus,
      recordStatus: "rejected",
    }),
    reasonCode: null,
  },
  {
    operation: "supersede",
    name: "active-service-supersession",
    matches: (snapshot, request) =>
      snapshot.recordStatus === "active" &&
      snapshot.sourceIsCurrent &&
      !isProtected(snapshot) &&
      isServiceActor(request) &&
      (request.reasonCode === "document_reprocessed" ||
        request.reasonCode === "catalog_reprocessed"),
    next: (snapshot) => ({
      resolutionStatus: snapshot.resolutionStatus,
      verificationStatus: snapshot.verificationStatus,
      recordStatus: "superseded",
    }),
    reasonCode: "document_reprocessed",
  },
];

/**
 * The authoritative pure transition policy. Rules are evaluated in table order;
 * guards before the table produce stable errors for stale, terminal, and
 * authorization failures rather than relying on route-specific heuristics.
 */
export const OBSERVATION_TRANSITION_POLICY = ACTIVE_RULES;

export function evaluateObservationTransition(
  snapshot: ObservationTransitionSnapshot,
  request: ObservationTransitionRequest,
): ObservationTransitionDecision {
  if (isExpectedSourceSnapshotStale(snapshot, request)) {
    return { allowed: false, operation: request.operation, errorCode: "stale_source_snapshot", prior: snapshot };
  }
  if (isExpectedRevisionStale(snapshot, request)) {
    return { allowed: false, operation: request.operation, errorCode: "stale_revision_snapshot", prior: snapshot };
  }
  if (snapshot.recordStatus !== "active") {
    return {
      allowed: false,
      operation: request.operation,
      errorCode: "terminal_record",
      prior: snapshot,
    };
  }
  if (!snapshot.sourceIsCurrent) {
    return {
      allowed: false,
      operation: request.operation,
      errorCode: "record_not_current",
      prior: snapshot,
    };
  }
  if (request.operation === "reject" && !isRejectionReason(request.reasonCode)) {
    return {
      allowed: false,
      operation: request.operation,
      errorCode: request.reasonCode ? "invalid_reason_code" : "reason_required",
      prior: snapshot,
    };
  }
  if (
    (request.operation === "correct" || request.operation === "reverse") &&
    (!request.reasonCode || request.reasonCode.trim().length === 0)
  ) {
    return { allowed: false, operation: request.operation, errorCode: "reason_required", prior: snapshot };
  }
  if (
    request.operation === "supersede" &&
    request.reasonCode !== "document_reprocessed" &&
    request.reasonCode !== "catalog_reprocessed"
  ) {
    return { allowed: false, operation: request.operation, errorCode: "invalid_reason_code", prior: snapshot };
  }
  if (request.operation === "verify_auto" && !snapshot.qualityGateApproved) {
    return { allowed: false, operation: request.operation, errorCode: "quality_gate_not_approved", prior: snapshot };
  }
  if (
    (request.operation === "verify_auto" || request.operation === "supersede") &&
    isProtected(snapshot)
  ) {
    return { allowed: false, operation: request.operation, errorCode: "protected_human_decision", prior: snapshot };
  }
  if (
    (request.operation === "verify_user" || request.operation === "verify_auto" || request.operation === "correct") &&
    INCOMPLETE_RESULTS[snapshot.resolutionStatus]
  ) {
    return { allowed: false, operation: request.operation, errorCode: "incomplete_outcome", prior: snapshot };
  }
  if (
    (request.operation === "verify_user" || request.operation === "correct" || request.operation === "reverse" || request.operation === "reject") &&
    !isUserOwner(request)
  ) {
    return {
      allowed: false,
      operation: request.operation,
      errorCode: request.isOwner ? "authorization_required" : "foreign_owner",
      prior: snapshot,
    };
  }
  if ((request.operation === "verify_auto" || request.operation === "supersede") && !isServiceActor(request)) {
    return {
      allowed: false,
      operation: request.operation,
      errorCode: request.isServiceRole ? "service_role_required" : "authorization_required",
      prior: snapshot,
    };
  }

  const rule = ACTIVE_RULES.find(
    (candidate) =>
      candidate.operation === request.operation && candidate.matches(snapshot, request),
  );
  if (!rule) {
    return {
      allowed: false,
      operation: request.operation,
      errorCode:
        request.operation === "verify_auto" && !snapshot.qualityGateApproved
          ? "quality_gate_not_approved"
          : request.operation === "verify_auto" && isProtected(snapshot)
            ? "protected_human_decision"
            : request.operation === "verify_user" || request.operation === "correct"
              ? "invalid_transition"
              : "invalid_transition",
      prior: snapshot,
    };
  }

  return {
    allowed: true,
    operation: request.operation,
    prior: snapshot,
    next: rule.next(snapshot),
    reasonCode: isLifecycleReason(request.reasonCode) ? request.reasonCode : rule.reasonCode,
  };
}

export function isRecordStatus(value: unknown): value is RecordStatus {
  return value === "active" || value === "rejected" || value === "superseded";
}

export function isRejectionReasonCode(value: unknown): value is RejectionReasonCode {
  return typeof value === "string" && Object.hasOwn(REJECTION_REASONS, value);
}

export function isLifecycleReasonCode(value: unknown): value is LifecycleReasonCode {
  return typeof value === "string" && Object.hasOwn(LIFECYCLE_REASONS, value);
}
