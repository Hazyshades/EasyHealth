export {
  APPLY_ELIGIBLE_CLASSIFICATIONS,
  computeReprocessBatchDiff,
} from "./diff";

export { captureDeployedRelease } from "./release";

export {
  selectExtractedRowsForReprocessBatch,
  type ReprocessCandidateRow,
} from "./selection";

export {
  applyReprocessBatch,
  runReprocessBatchDryRun,
  type ReprocessBatchDryRunOutput,
} from "./service";

export {
  DEFAULT_RESOLVER_RESULT_FILTER,
  RegistryReprocessError,
  type DeployedRegistryRelease,
  type ReprocessBatchCounters,
  type ReprocessBatchFilters,
  type ReprocessBatchHeader,
  type ReprocessBatchInputs,
  type ReprocessBatchRowDiff,
  type ReprocessBatchRowRecord,
  type ReprocessBatchScope,
  type ReprocessBatchScopeKind,
  type ReprocessBatchState,
  type ReprocessBatchSummary,
  type ReprocessDiffClassification,
  type ReprocessNextSnapshot,
  type ReprocessPriorSnapshot,
  type ReprocessResolverResultFilter,
  type ReprocessRowApplyState,
} from "./types";
