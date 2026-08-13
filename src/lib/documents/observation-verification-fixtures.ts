import type {
  ObservationTransitionRequest,
  ObservationTransitionSnapshot,
} from "./observation-verification-workflow";

const base: ObservationTransitionSnapshot = {
  resolutionStatus: "resolved",
  verificationStatus: "pending",
  recordStatus: "active",
  sourceIsCurrent: true,
  hasConcreteDefinition: true,
  hasActiveRevision: true,
  hasProtectedHumanDecision: false,
  qualityGateApproved: true,
  sourceSnapshot: "2026-08-13T10:00:00.000Z",
  activeRevisionId: "eh120-revision-pending",
};

/** Stable synthetic states shared by the EH-120 unit and API verifiers. */
export const EH120_TRANSITION_FIXTURES = {
  active: base,
  rejected: {
    ...base,
    recordStatus: "rejected",
  },
  superseded: {
    ...base,
    recordStatus: "superseded",
    sourceIsCurrent: false,
  },
  resolved: base,
  partial: {
    ...base,
    resolutionStatus: "partial",
    hasConcreteDefinition: false,
  },
  ambiguous: {
    ...base,
    resolutionStatus: "ambiguous",
    hasConcreteDefinition: false,
  },
  unmapped: {
    ...base,
    resolutionStatus: "unmapped",
    hasConcreteDefinition: false,
  },
  autoVerified: {
    ...base,
    verificationStatus: "auto_verified",
    activeRevisionId: "eh120-revision-auto",
  },
  userVerified: {
    ...base,
    verificationStatus: "user_verified",
    activeRevisionId: "eh120-revision-user",
    hasProtectedHumanDecision: true,
  },
  corrected: {
    ...base,
    verificationStatus: "manually_corrected",
    activeRevisionId: "eh120-revision-corrected",
    hasProtectedHumanDecision: true,
  },
  reversed: {
    ...base,
    verificationStatus: "pending",
    activeRevisionId: "eh120-revision-reversal",
  },
  stale: {
    ...base,
    sourceSnapshot: "2026-08-13T10:05:00.000Z",
    activeRevisionId: "eh120-revision-newer",
  },
} as const satisfies Record<string, ObservationTransitionSnapshot>;

export const EH120_OWNER_REQUEST: ObservationTransitionRequest = {
  operation: "verify_user",
  actorType: "user",
  isOwner: true,
  isServiceRole: false,
  expectedSourceSnapshot: base.sourceSnapshot,
  expectedActiveRevisionId: base.activeRevisionId,
};

export const EH120_SERVICE_REQUEST: ObservationTransitionRequest = {
  operation: "verify_auto",
  actorType: "system",
  isOwner: false,
  isServiceRole: true,
  expectedSourceSnapshot: base.sourceSnapshot,
  expectedActiveRevisionId: base.activeRevisionId,
};

export const EH120_STALE_REQUEST: ObservationTransitionRequest = {
  ...EH120_OWNER_REQUEST,
  expectedSourceSnapshot: "2026-08-13T09:59:00.000Z",
};
