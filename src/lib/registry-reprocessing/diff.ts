import {
  MEASUREMENT_CATALOG_MANIFEST_RELEASE,
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  RESOLVER_DECISION_TRACE_SCHEMA_VERSION,
  buildPersistedResolverDecisionTrace,
  resolveMeasurementDefinition,
} from "@/lib/biomarkers";
import type { MappingChangeClassification } from "@/lib/biomarkers";
import {
  buildInputEvidenceHash,
  type NormalizationRevision,
} from "@/lib/documents/normalization-revisions";
import {
  measurementInputFromWriterRow,
  type ExtractedBiomarkerWriterRow,
} from "@/lib/documents/observation-normalization-writer";
import type {
  ReprocessBatchRowDiff,
  ReprocessDiffClassification,
  ReprocessNextSnapshot,
  ReprocessPriorSnapshot,
} from "./types";

/**
 * Rows the batch service will actually apply through the writer. Every
 * other classification is recorded but never materialized.
 *
 * `regressed_resolution` is deliberately *not* apply-eligible: EH-116 v1
 * refuses to auto-write a regression. Operators can rerun as a targeted
 * acceptance if they truly want to accept a worse mapping.
 */
export const APPLY_ELIGIBLE_CLASSIFICATIONS: Readonly<Partial<Record<ReprocessDiffClassification, true>>> = {
  improved_resolution: true,
  identity_changed: true,
  manual_selection_lost: true,
};

/**
 * Deterministic per-row diff between the currently active normalization
 * revision (`prior`) and the resolution the runtime would produce right now
 * (`next`) for the same extracted evidence.
 *
 * The output is byte-identical for identical inputs: identical extracted
 * row + identical prior revision + identical deployed release ⇒ identical
 * `next.inputEvidenceHash`, identical `next.decisionTrace`, and identical
 * `diffClassification`.
 */
export function computeReprocessBatchDiff(options: {
  extractedRow: ExtractedBiomarkerWriterRow & {
    id: string;
    profile_id: string;
    document_id: string;
    observation_kind: "lab" | "instrumental";
  };
  activeRevision: NormalizationRevision | null;
  includeManualDecisions: boolean;
}): ReprocessBatchRowDiff {
  const { extractedRow, activeRevision, includeManualDecisions } = options;

  if (extractedRow.observation_kind !== "lab") {
    throw new Error("registry-reprocessing.diff: only lab observations are eligible");
  }

  const input = measurementInputFromWriterRow(extractedRow);
  const inputEvidenceHash = buildInputEvidenceHash(input);
  const nextResolution = resolveMeasurementDefinition(input);
  const nextTrace = buildPersistedResolverDecisionTrace(nextResolution, {
    inputEvidenceHash,
    catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
    catalogManifestDigest: MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
    resolverVersion: MEASUREMENT_RESOLVER_VERSION,
  });

  const prior: ReprocessPriorSnapshot = {
    revisionId: activeRevision?.id ?? null,
    resolverResult: activeRevision?.resolver_result ?? null,
    measurementDefinitionKey: activeRevision?.measurement_definition_key ?? null,
    analyteKey: activeRevision?.analyte_key ?? null,
    verificationStatus: activeRevision?.verification_status ?? null,
    mappingConfidenceBand: activeRevision?.mapping_confidence_band ?? null,
    // Extraction-row provenance carries the hash the prior writer built,
    // which is the same identity contract we use for `next`. If the
    // extraction was never accepted, this is null.
    inputEvidenceHash: activeRevision ? inputEvidenceHash : null,
  };

  const priorKey = prior.measurementDefinitionKey;
  const nextKey = nextResolution.measurementDefinitionKey;
  const mappingChangeClassification: MappingChangeClassification =
    priorKey && nextKey && priorKey === nextKey
      ? "compatibility_preserving"
      : "review_required";

  const next: ReprocessNextSnapshot = {
    resolverResult: nextResolution.result,
    measurementDefinitionKey: nextKey,
    analyteKey: nextResolution.analyteKey,
    mappingConfidenceBand: nextResolution.mappingConfidenceBand,
    inputEvidenceHash,
    mappingChangeClassification,
    decisionTrace: nextTrace,
    decisionTraceSchemaVersion: RESOLVER_DECISION_TRACE_SCHEMA_VERSION,
  };

  const priorVerification = prior.verificationStatus;

  if (
    !includeManualDecisions &&
    (priorVerification === "user_verified" ||
      priorVerification === "manually_corrected")
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "skipped_manual_decision",
      `default_protection_${priorVerification}`
    );
  }

  if (
    includeManualDecisions &&
    priorVerification === "manually_corrected" &&
    (next.resolverResult !== "resolved" || next.measurementDefinitionKey !== priorKey)
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "manual_selection_lost",
      "manually_corrected_identity_would_change"
    );
  }

  if (
    includeManualDecisions &&
    priorVerification === "user_verified" &&
    prior.resolverResult === "resolved" &&
    (next.resolverResult !== "resolved" || next.measurementDefinitionKey !== priorKey)
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "manual_selection_lost",
      "user_verified_identity_would_change"
    );
  }

  if (!prior.revisionId) {
    if (next.resolverResult === "resolved" && next.measurementDefinitionKey) {
      return finish(extractedRow, prior, next, "improved_resolution", "new_resolved");
    }
    return finish(extractedRow, prior, next, "needs_review", "no_prior_no_resolved");
  }

  if (
    prior.resolverResult === next.resolverResult &&
    prior.measurementDefinitionKey === next.measurementDefinitionKey &&
    prior.analyteKey === next.analyteKey &&
    prior.mappingConfidenceBand === next.mappingConfidenceBand
  ) {
    return finish(extractedRow, prior, next, "unchanged", "identical_outcome");
  }

  if (next.resolverResult === "resolved" && prior.resolverResult !== "resolved") {
    return finish(
      extractedRow,
      prior,
      next,
      "improved_resolution",
      "partial_or_worse_to_resolved"
    );
  }

  if (prior.resolverResult === "resolved" && next.resolverResult !== "resolved") {
    return finish(
      extractedRow,
      prior,
      next,
      "regressed_resolution",
      "resolved_to_incomplete"
    );
  }

  if (
    next.resolverResult === "resolved" &&
    prior.resolverResult === "resolved" &&
    prior.measurementDefinitionKey !== next.measurementDefinitionKey
  ) {
    return finish(extractedRow, prior, next, "identity_changed", "resolved_definition_changed");
  }

  if (
    mappingChangeClassification === "review_required" ||
    (mappingChangeClassification as MappingChangeClassification) === "breaking"
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "needs_review",
      `mapping_${mappingChangeClassification}`
    );
  }

  return finish(extractedRow, prior, next, "unchanged", "equivalent_outcome");
}

/**
 * Local constructor that pins the row identity onto every classification
 * branch. Not exported: the diff surface is `computeReprocessBatchDiff`
 * and `APPLY_ELIGIBLE_CLASSIFICATIONS`.
 */
function finish(
  extractedRow: {
    id: string;
    profile_id: string;
    document_id: string;
  },
  prior: ReprocessPriorSnapshot,
  next: ReprocessNextSnapshot,
  diffClassification: ReprocessDiffClassification,
  diffReasonCode: string
): ReprocessBatchRowDiff {
  return {
    extractedBiomarkerId: extractedRow.id,
    profileId: extractedRow.profile_id,
    documentId: extractedRow.document_id,
    prior,
    next,
    diffClassification,
    diffReasonCode,
  };
}
