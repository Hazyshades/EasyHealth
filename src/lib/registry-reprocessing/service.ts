import { createAdminClient } from "@/lib/supabase/admin";
import { writeExtractedBiomarkerNormalization } from "@/lib/documents/observation-normalization-writer";
import type { ExtractedBiomarkerWriterRow } from "@/lib/documents/observation-normalization-writer";
import { getActiveNormalizationRevision } from "@/lib/documents/normalization-revisions";
import {
  APPLY_ELIGIBLE_CLASSIFICATIONS,
  computeReprocessBatchDiff,
} from "./diff";
import { captureDeployedRelease } from "./release";
import { selectExtractedRowsForReprocessBatch } from "./selection";
import {
  RegistryReprocessError,
  type DeployedRegistryRelease,
  type ReprocessBatchCounters,
  type ReprocessBatchFilters,
  type ReprocessBatchHeader,
  type ReprocessBatchInputs,
  type ReprocessBatchRowDiff,
  type ReprocessBatchScope,
  type ReprocessBatchScopeKind,
  type ReprocessBatchState,
  type ReprocessBatchSummary,
} from "./types";
import type { ResolverResult } from "@/lib/biomarkers";

type BatchHeaderRow = {
  id: string;
  scope_kind: ReprocessBatchScopeKind;
  scope_document_id: string | null;
  scope_profile_id: string | null;
  resolver_result_filter: string[];
  include_manual_decisions: boolean;
  manual_decision_reason: string | null;
  batch_limit: number;
  max_documents: number | null;
  actor_id: string | null;
  actor_note: string | null;
  catalog_manifest_version: string;
  catalog_manifest_digest: string;
  resolver_version: string;
  normalization_version: string;
  compatibility_policy_version: string;
  state: ReprocessBatchState;
  abort_reason: string | null;
  candidates_total: number;
  candidates_unchanged: number;
  candidates_improved: number;
  candidates_regressed: number;
  candidates_identity_changed: number;
  candidates_manual_selection_lost: number;
  candidates_skipped_manual_decision: number;
  candidates_skipped_manual_correction: number;
  candidates_needs_review: number;
  candidates_writer_error: number;
  applied_revisions: number;
  writer_errors: number;
  requested_at: string;
  dry_run_at: string;
  applied_at: string | null;
  aborted_at: string | null;
};

type ApplyBatchPendingRow = {
  row_id: string;
  extracted_biomarker_id: string;
  diff_classification: string;
  diff_reason_code: string;
};

type ApplyBatchResult = {
  status: "ok" | "catalog_manifest_drift" | ReprocessBatchState;
  rows: ApplyBatchPendingRow[];
};

export type ReprocessBatchDryRunOutput = {
  batch: ReprocessBatchHeader;
  rows: ReprocessBatchRowDiff[];
  candidateCount: number;
};

/**
 * Open a new batch, record every candidate row's dry-run diff, and
 * return the resulting summary. The batch is left in state `dry_run`
 * — apply is a separate call.
 */
export async function runReprocessBatchDryRun(
  inputs: ReprocessBatchInputs
): Promise<ReprocessBatchDryRunOutput> {
  validateInputs(inputs);
  const release = captureDeployedRelease();

  const supabase = createAdminClient();

  const { data: openedRaw, error: openError } = await supabase.rpc(
    "registry_reprocess_open_batch",
    {
      p_scope_kind: inputs.scope.kind,
      p_scope_document_id: inputs.scope.kind === "document" ? inputs.scope.documentId : null,
      p_scope_profile_id: inputs.scope.kind === "profile" ? inputs.scope.profileId : null,
      p_resolver_result_filter: [...inputs.filters.resolverResults],
      p_include_manual_decisions: inputs.filters.includeManualDecisions,
      p_manual_decision_reason: inputs.filters.manualDecisionReason ?? null,
      p_batch_limit: inputs.batchLimit,
      p_max_documents: inputs.maxDocuments ?? null,
      p_actor_id: inputs.actorId ?? null,
      p_actor_note: inputs.actorNote ?? null,
      p_catalog_manifest_version: release.catalogManifestVersion,
      p_catalog_manifest_digest: release.catalogManifestDigest,
      p_resolver_version: release.resolverVersion,
      p_normalization_version: release.normalizationVersion,
      p_compatibility_policy_version: release.compatibilityPolicyVersion,
    }
  );
  if (openError) throw openError;

  const opened = normalizeHeader(openedRaw as BatchHeaderRow | BatchHeaderRow[]);

  const candidates = await selectExtractedRowsForReprocessBatch(inputs);
  const rows: ReprocessBatchRowDiff[] = [];
  const distinctDocuments = new Set<string>();

  for (const candidate of candidates) {
    if (
      inputs.scope.kind === "global" &&
      inputs.maxDocuments &&
      !distinctDocuments.has(candidate.document_id) &&
      distinctDocuments.size >= inputs.maxDocuments
    ) {
      break;
    }
    distinctDocuments.add(candidate.document_id);

    const diff = computeReprocessBatchDiff({
      extractedRow: candidate,
      activeRevision: candidate.active_revision,
      includeManualDecisions: inputs.filters.includeManualDecisions,
    });
    rows.push(diff);

    const { error: recordError } = await supabase.rpc("registry_reprocess_record_row", {
      p_batch_id: opened.id,
      p_extracted_biomarker_id: diff.extractedBiomarkerId,
      p_profile_id: diff.profileId,
      p_document_id: diff.documentId,
      p_prior_revision_id: diff.prior.revisionId,
      p_prior_resolver_result: diff.prior.resolverResult,
      p_prior_measurement_definition_key: diff.prior.measurementDefinitionKey,
      p_prior_analyte_key: diff.prior.analyteKey,
      p_prior_verification_status: diff.prior.verificationStatus,
      p_prior_mapping_confidence_band: diff.prior.mappingConfidenceBand,
      p_prior_input_evidence_hash: diff.prior.inputEvidenceHash,
      p_next_resolver_result: diff.next.resolverResult,
      p_next_measurement_definition_key: diff.next.measurementDefinitionKey,
      p_next_analyte_key: diff.next.analyteKey,
      p_next_mapping_confidence_band: diff.next.mappingConfidenceBand,
      p_next_input_evidence_hash: diff.next.inputEvidenceHash,
      p_next_mapping_change_classification: diff.next.mappingChangeClassification,
      p_next_resolver_decision_trace: diff.next.decisionTrace,
      p_next_resolver_trace_schema_version: diff.next.decisionTraceSchemaVersion,
      p_diff_classification: diff.diffClassification,
      p_diff_reason_code: diff.diffReasonCode,
    });
    if (recordError) throw recordError;
  }

  const refreshed = await readBatchHeader(opened.id);
  return { batch: refreshed, rows, candidateCount: candidates.length };
}

/**
 * Re-check the deployed release digest against the batch, then materialize
 * every apply-eligible row through the existing EH-106 writer. Returns
 * the final batch summary.
 */
export async function applyReprocessBatch(options: {
  batchId: string;
  actorId: string;
}): Promise<ReprocessBatchSummary> {
  const release = captureDeployedRelease();
  const supabase = createAdminClient();

  const { data: applyRaw, error: applyError } = await supabase.rpc(
    "registry_reprocess_apply_batch",
    {
      p_batch_id: options.batchId,
      p_current_catalog_manifest_digest: release.catalogManifestDigest,
      p_actor_id: options.actorId,
    }
  );
  if (applyError) throw applyError;

  const applyResult = applyRaw as ApplyBatchResult | null;
  if (!applyResult) {
    throw new RegistryReprocessError(
      "registry_reprocess_apply_batch returned no result",
      "empty_apply_result"
    );
  }

  // Drift is reported as data, not as an exception, so the database can
  // durably record the aborted batch before we surface the failure.
  if (applyResult.status === "catalog_manifest_drift") {
    throw new RegistryReprocessError(
      "The runtime Registry 2.0 release digest does not match the batch. Apply aborted.",
      "catalog_manifest_drift"
    );
  }

  const pendingRows = applyResult.rows ?? [];

  for (const pending of pendingRows) {
    if (
      !APPLY_ELIGIBLE_CLASSIFICATIONS[
        pending.diff_classification as keyof typeof APPLY_ELIGIBLE_CLASSIFICATIONS
      ]
    ) {
      // Defensive: the DB filters pending rows already, but if a
      // classification is not writer-eligible we mark it skipped instead
      // of invoking the writer.
      const { error: recordSkipError } = await supabase.rpc("registry_reprocess_finish_row", {
        p_row_id: pending.row_id,
        p_applied_revision_id: null,
        p_writer_error_code: `skipped_by_batch_service_${pending.diff_classification}`,
      });
      if (recordSkipError) throw recordSkipError;
      continue;
    }

    const outcome = await materializeRow({
      batchId: options.batchId,
      actorId: options.actorId,
      pendingRow: pending,
    });

    const { error: finishError } = await supabase.rpc("registry_reprocess_finish_row", {
      p_row_id: pending.row_id,
      p_applied_revision_id: outcome.revisionId,
      p_writer_error_code: outcome.errorCode,
    });
    if (finishError) throw finishError;
  }

  const { data: finalRaw, error: finalError } = await supabase.rpc(
    "registry_reprocess_finish_batch",
    { p_batch_id: options.batchId }
  );
  if (finalError) throw finalError;

  const batch = normalizeHeader(finalRaw as BatchHeaderRow | BatchHeaderRow[]);
  return { batch, rowCount: pendingRows.length };
}

type MaterializeRowOutcome = {
  revisionId: string | null;
  errorCode: string | null;
};

async function materializeRow(options: {
  batchId: string;
  actorId: string;
  pendingRow: {
    row_id: string;
    extracted_biomarker_id: string;
    diff_classification: string;
    diff_reason_code: string;
  };
}): Promise<MaterializeRowOutcome> {
  const supabase = createAdminClient();

  const { data: rowRaw, error: readError } = await supabase
    .from("registry_reprocess_batch_rows")
    .select(
      "batch_id, prior_verification_status, prior_measurement_definition_key, next_measurement_definition_key, next_resolver_result"
    )
    .eq("id", options.pendingRow.row_id)
    .single();
  if (readError) throw readError;

  const rowMeta = rowRaw as {
    batch_id: string;
    prior_verification_status: string | null;
    prior_measurement_definition_key: string | null;
    next_measurement_definition_key: string | null;
    next_resolver_result: ResolverResult;
  };

  const { data: batchRaw, error: batchReadError } = await supabase
    .from("registry_reprocess_batches")
    .select("manual_decision_reason, include_manual_decisions")
    .eq("id", rowMeta.batch_id)
    .single();
  if (batchReadError) throw batchReadError;

  const batchMeta = batchRaw as {
    manual_decision_reason: string | null;
    include_manual_decisions: boolean;
  };

  const { data: extractedRaw, error: extractedError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, document_id, profile_id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, confidence, specimen, modifier, source_page, source_text, bounding_box, reported_alt_value, reported_alt_unit, raw_value_text, method, processing_version"
    )
    .eq("id", options.pendingRow.extracted_biomarker_id)
    .single();
  if (extractedError) throw extractedError;

  const row = extractedRaw as ExtractedBiomarkerWriterRow & {
    profile_id: string;
    document_id: string;
  };
  const { data: documentRaw, error: documentError } = await supabase
    .from("documents")
    .select("observed_at")
    .eq("id", row.document_id)
    .eq("profile_id", row.profile_id)
    .single();
  if (documentError) throw documentError;


  const activeRevision = await getActiveNormalizationRevision(row.id);
  const useCorrectionPath =
    batchMeta.include_manual_decisions &&
    (rowMeta.prior_verification_status === "user_verified" ||
      rowMeta.prior_verification_status === "manually_corrected");

  try {
    const result = await writeExtractedBiomarkerNormalization({
      profileId: row.profile_id,
      documentId: row.document_id,
      observedAt: documentRaw.observed_at,
      row,
      actorId: options.actorId,
      writeKind: useCorrectionPath ? "correction" : "acceptance",
      expectedActiveRevision: activeRevision,
      correctionReason: useCorrectionPath
        ? batchMeta.manual_decision_reason ?? "eh116_manual_decision_override"
        : null,
      mappingClassification: useCorrectionPath ? "review_required" : undefined,
    });
    return { revisionId: result.revisionId, errorCode: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const trimmed = message.trim();
    const truncated = trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
    return { revisionId: null, errorCode: truncated };
  }
}

function validateInputs(inputs: ReprocessBatchInputs): void {
  if (inputs.batchLimit <= 0 || inputs.batchLimit > 100000) {
    throw new RegistryReprocessError(
      "batch_limit must be between 1 and 100000",
      "invalid_batch_limit"
    );
  }
  if (
    inputs.filters.includeManualDecisions &&
    (!inputs.filters.manualDecisionReason ||
      inputs.filters.manualDecisionReason.trim().length === 0)
  ) {
    throw new RegistryReprocessError(
      "--include-manual-decisions requires a non-empty --reason",
      "manual_decision_reason_required"
    );
  }
  if (inputs.filters.resolverResults.length === 0) {
    throw new RegistryReprocessError(
      "resolver_result filter must include at least one outcome",
      "empty_resolver_result_filter"
    );
  }
}

async function readBatchHeader(batchId: string): Promise<ReprocessBatchHeader> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("registry_reprocess_batches")
    .select("*")
    .eq("id", batchId)
    .single();
  if (error) throw error;
  return normalizeHeader(data as BatchHeaderRow | BatchHeaderRow[]);
}

function normalizeHeader(raw: BatchHeaderRow | BatchHeaderRow[]): ReprocessBatchHeader {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row) throw new RegistryReprocessError("Empty batch header", "empty_batch_header");
  const scope: ReprocessBatchScope =
    row.scope_kind === "document"
      ? { kind: "document", documentId: row.scope_document_id ?? "" }
      : row.scope_kind === "profile"
        ? { kind: "profile", profileId: row.scope_profile_id ?? "" }
        : { kind: "global" };
  const filters: ReprocessBatchFilters = {
    resolverResults: row.resolver_result_filter.map(
      (r) => r as ReprocessBatchFilters["resolverResults"][number]
    ),
    includeManualDecisions: row.include_manual_decisions,
    manualDecisionReason: row.manual_decision_reason,
  };
  const release: DeployedRegistryRelease = {
    catalogManifestVersion: row.catalog_manifest_version,
    catalogManifestDigest: row.catalog_manifest_digest,
    resolverVersion: row.resolver_version,
    normalizationVersion: row.normalization_version,
    compatibilityPolicyVersion: row.compatibility_policy_version,
  };
  const counters: ReprocessBatchCounters = {
    total: row.candidates_total,
    unchanged: row.candidates_unchanged,
    improved: row.candidates_improved,
    regressed: row.candidates_regressed,
    identityChanged: row.candidates_identity_changed,
    manualSelectionLost: row.candidates_manual_selection_lost,
    skippedManualDecision: row.candidates_skipped_manual_decision,
    skippedManualCorrection: row.candidates_skipped_manual_correction,
    needsReview: row.candidates_needs_review,
    writerError: row.candidates_writer_error,
    appliedRevisions: row.applied_revisions,
    writerErrors: row.writer_errors,
  };
  return {
    id: row.id,
    scope,
    filters,
    batchLimit: row.batch_limit,
    maxDocuments: row.max_documents,
    actorId: row.actor_id,
    actorNote: row.actor_note,
    release,
    state: row.state,
    abortReason: row.abort_reason,
    counters,
    requestedAt: row.requested_at,
    dryRunAt: row.dry_run_at,
    appliedAt: row.applied_at,
    abortedAt: row.aborted_at,
  };
}

/** @internal — exposed for tests only. */
export const __internal = {
  normalizeHeader,
  validateInputs,
};
