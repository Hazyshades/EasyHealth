import type {
  MappingChangeClassification,
  MeasurementResolution,
  PersistedResolverDecisionTrace,
  ResolverResult,
  VerificationStatus,
} from "@/lib/biomarkers";

/**
 * Deployed Registry 2.0 release captured at dry-run and re-checked at apply.
 * All five identifiers are compile-time constants at runtime; the digest is
 * the content-addressed identity of the catalog manifest.
 */
export type DeployedRegistryRelease = {
  catalogManifestVersion: string;
  catalogManifestDigest: string;
  resolverVersion: string;
  normalizationVersion: string;
  compatibilityPolicyVersion: string;
};

export type ReprocessBatchState =
  | "dry_run"
  | "apply_in_progress"
  | "applied"
  | "applied_with_errors"
  | "aborted";

export type ReprocessBatchScopeKind = "document" | "profile" | "global";

export type ReprocessBatchScope =
  | { kind: "document"; documentId: string }
  | { kind: "profile"; profileId: string }
  | { kind: "global" };

export type ReprocessResolverResultFilter = ReadonlyArray<ResolverResult>;

export const DEFAULT_RESOLVER_RESULT_FILTER: ReprocessResolverResultFilter = [
  "resolved",
  "partial",
  "ambiguous",
  "unmapped",
];

export type ReprocessBatchFilters = {
  resolverResults: ReprocessResolverResultFilter;
  includeManualDecisions: boolean;
  manualDecisionReason?: string | null;
};

export type ReprocessBatchInputs = {
  scope: ReprocessBatchScope;
  filters: ReprocessBatchFilters;
  batchLimit: number;
  maxDocuments?: number | null;
  actorId?: string | null;
  actorNote?: string | null;
};

/** Nine explicit outcomes for the per-row dry-run diff. */
export type ReprocessDiffClassification =
  | "unchanged"
  | "improved_resolution"
  | "regressed_resolution"
  | "identity_changed"
  | "manual_selection_lost"
  | "skipped_manual_decision"
  | "skipped_manual_correction"
  | "needs_review"
  | "writer_error";

export type ReprocessRowApplyState = "pending" | "skipped" | "applied" | "failed";

/**
 * Snapshot of the active normalization revision at the moment of dry-run.
 * Only identifiers, resolver state, and evidence hash are captured — never
 * raw values, raw labels, source text, or patient content.
 */
export type ReprocessPriorSnapshot = {
  revisionId: string | null;
  resolverResult: ResolverResult | null;
  measurementDefinitionKey: string | null;
  analyteKey: string | null;
  verificationStatus: VerificationStatus | null;
  mappingConfidenceBand: MeasurementResolution["mappingConfidenceBand"] | null;
  inputEvidenceHash: string | null;
};

/**
 * Snapshot of the resolution the currently deployed runtime would produce
 * for the same extracted row. Byte-identical to what EH-106's writer would
 * persist if this row were accepted right now.
 */
export type ReprocessNextSnapshot = {
  resolverResult: ResolverResult;
  measurementDefinitionKey: string | null;
  analyteKey: string | null;
  mappingConfidenceBand: MeasurementResolution["mappingConfidenceBand"];
  inputEvidenceHash: string;
  mappingChangeClassification: MappingChangeClassification;
  decisionTrace: PersistedResolverDecisionTrace;
  decisionTraceSchemaVersion: string;
};

export type ReprocessBatchRowDiff = {
  extractedBiomarkerId: string;
  profileId: string;
  documentId: string;
  prior: ReprocessPriorSnapshot;
  next: ReprocessNextSnapshot;
  diffClassification: ReprocessDiffClassification;
  diffReasonCode: string;
};

export type ReprocessBatchRowRecord = ReprocessBatchRowDiff & {
  id: string;
  batchId: string;
  applyState: ReprocessRowApplyState;
  appliedRevisionId: string | null;
  writerErrorCode: string | null;
  createdAt: string;
};

export type ReprocessBatchHeader = {
  id: string;
  scope: ReprocessBatchScope;
  filters: ReprocessBatchFilters;
  batchLimit: number;
  maxDocuments: number | null;
  actorId: string | null;
  actorNote: string | null;
  release: DeployedRegistryRelease;
  state: ReprocessBatchState;
  abortReason: string | null;
  counters: ReprocessBatchCounters;
  requestedAt: string;
  dryRunAt: string;
  appliedAt: string | null;
  abortedAt: string | null;
};

export type ReprocessBatchCounters = {
  total: number;
  unchanged: number;
  improved: number;
  regressed: number;
  identityChanged: number;
  manualSelectionLost: number;
  skippedManualDecision: number;
  skippedManualCorrection: number;
  needsReview: number;
  writerError: number;
  appliedRevisions: number;
  writerErrors: number;
};

export type ReprocessBatchSummary = {
  batch: ReprocessBatchHeader;
  rowCount: number;
};

/** Errors thrown by the batch service surface. */
export class RegistryReprocessError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "RegistryReprocessError";
  }
}
