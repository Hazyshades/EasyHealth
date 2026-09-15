import {
  MEASUREMENT_CATALOG_MANIFEST_VERSION,
  MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
  MEASUREMENT_NORMALIZATION_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  RESOLVER_DECISION_TRACE_SCHEMA_VERSION,
  buildPersistedResolverDecisionTrace,
  resolveMeasurementDefinition,
} from "@/lib/biomarkers";
import { MEASUREMENT_CATALOG_MANIFEST_RELEASE } from "@/lib/biomarkers/measurement-registry-release";
import type { MappingChangeClassification } from "@/lib/biomarkers";
import {
  preparedEvidenceFromWriterRow,
  type ExtractedBiomarkerWriterRow,
} from "@/lib/documents/observation-normalization-writer";
import {
  buildInputEvidenceHash,
  type NormalizationRevision,
} from "@/lib/documents/normalization-revisions";
import type {
  DeployedRegistryRelease,
  ReprocessBatchRowDiff,
  ReprocessChangeFacts,
  ReprocessDiffClassification,
  ReprocessNextSnapshot,
  ReprocessPriorRelease,
  ReprocessPriorSnapshot,
} from "./types";

/**
 * Rows the batch service will actually apply through the writer. Every
 * other classification is recorded but never materialized, except for the
 * explicit release-refresh path, which keeps the `unchanged` classification
 * and is admitted by its persisted create/activate facts.
 *
 * `regressed_resolution` is deliberately *not* apply-eligible: EH-116 v1
 * refuses to auto-write a regression. Operators can rerun as a targeted
 * acceptance if they truly want to accept a worse mapping.
 */
export const APPLY_ELIGIBLE_CLASSIFICATIONS: Readonly<
  Partial<Record<ReprocessDiffClassification, true>>
> = {
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
  release?: DeployedRegistryRelease;
  releaseRefresh?: boolean;
}): ReprocessBatchRowDiff {
  const {
    extractedRow,
    activeRevision,
    includeManualDecisions,
    releaseRefresh = false,
    release = {
      catalogManifestVersion: MEASUREMENT_CATALOG_MANIFEST_VERSION,
      catalogManifestDigest:
        MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest,
      resolverVersion: MEASUREMENT_RESOLVER_VERSION,
      normalizationVersion: MEASUREMENT_NORMALIZATION_VERSION,
      compatibilityPolicyVersion: MEASUREMENT_COMPATIBILITY_POLICY_VERSION,
    },
  } = options;

  if (extractedRow.observation_kind !== "lab") {
    throw new Error(
      "registry-reprocessing.diff: only lab observations are eligible",
    );
  }

  const preparedEvidence = preparedEvidenceFromWriterRow(
    extractedRow,
    activeRevision?.measurement_override ?? null,
  );
  const inputEvidenceHash = buildInputEvidenceHash(preparedEvidence);
  const nextResolution = resolveMeasurementDefinition(preparedEvidence.input);
  const nextTrace = buildPersistedResolverDecisionTrace(nextResolution, {
    inputEvidenceHash,
    catalogManifestVersion: release.catalogManifestVersion,
    catalogManifestDigest: release.catalogManifestDigest,
    resolverVersion: release.resolverVersion,
  });

  const priorRelease: ReprocessPriorRelease | null = activeRevision
    ? {
        catalogManifestVersion: activeRevision.catalog_manifest_version ?? null,
        catalogManifestDigest: activeRevision.catalog_manifest_digest ?? null,
        resolverVersion: activeRevision.resolver_version ?? null,
        normalizationVersion: activeRevision.normalization_version ?? null,
        compatibilityPolicyVersion:
          activeRevision.resolver_evidence?.compatibilityPolicyVersion ?? null,
      }
    : null;
  const prior: ReprocessPriorSnapshot = {
    revisionId: activeRevision?.id ?? null,
    resolverResult: activeRevision?.resolver_result ?? null,
    measurementDefinitionKey:
      activeRevision?.measurement_definition_key ?? null,
    analyteKey: activeRevision?.analyte_key ?? null,
    verificationStatus: activeRevision?.verification_status ?? null,
    mappingConfidenceBand: activeRevision?.mapping_confidence_band ?? null,
    inputEvidenceHash: activeRevision?.input_evidence_hash ?? null,
    inputIdentityFormatVersion:
      activeRevision?.input_identity_format_version ?? null,
    release: priorRelease,
  };

  const hasValidV1InputIdentity =
    activeRevision?.input_identity_format_version === "1" &&
    typeof activeRevision.input_evidence_hash === "string" &&
    /^[0-9a-f]{64}$/.test(activeRevision.input_evidence_hash);
  const inputChange = !activeRevision
    ? "changed"
    : !hasValidV1InputIdentity
      ? "unavailable"
      : activeRevision.input_evidence_hash === inputEvidenceHash
        ? "unchanged"
        : "changed";
  const outcomeChange =
    !activeRevision ||
    activeRevision.resolver_result !== nextResolution.result ||
    activeRevision.measurement_definition_key !==
      nextResolution.measurementDefinitionKey ||
    activeRevision.analyte_key !== nextResolution.analyteKey ||
    activeRevision.mapping_confidence_band !==
      nextResolution.mappingConfidenceBand
      ? "changed"
      : "unchanged";
  const releaseChange =
    !activeRevision ||
    !priorRelease ||
    [
      priorRelease.catalogManifestVersion,
      priorRelease.catalogManifestDigest,
      priorRelease.resolverVersion,
      priorRelease.normalizationVersion,
      priorRelease.compatibilityPolicyVersion,
    ].some((value) => value === null)
      ? "unavailable"
      : priorRelease.catalogManifestVersion !==
            release.catalogManifestVersion ||
          priorRelease.catalogManifestDigest !==
            release.catalogManifestDigest ||
          priorRelease.resolverVersion !== release.resolverVersion ||
          priorRelease.normalizationVersion !== release.normalizationVersion ||
          priorRelease.compatibilityPolicyVersion !==
            release.compatibilityPolicyVersion
        ? "changed"
        : "unchanged";
  const releaseRefreshRequested =
    releaseRefresh &&
    inputChange === "unchanged" &&
    outcomeChange === "unchanged" &&
    releaseChange === "changed";
  const createRevision =
    inputChange === "changed" ||
    outcomeChange === "changed" ||
    releaseRefreshRequested;

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
    inputIdentityFormatVersion: "1",
    release,
    changeFacts: {
      inputChange,
      outcomeChange,
      releaseChange,
      createRevision,
      activateRevision: false,
    },
    createRevision,
    activateRevision: false,
  };

  const priorVerification = prior.verificationStatus;
  if (
    !includeManualDecisions &&
    activeRevision?.measurement_override !== null &&
    activeRevision?.measurement_override !== undefined
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "skipped_manual_correction",
      "default_protection_measurement_correction",
    );
  }

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
      `default_protection_${priorVerification}`,
    );
  }

  if (
    includeManualDecisions &&
    priorVerification === "manually_corrected" &&
    (next.resolverResult !== "resolved" ||
      next.measurementDefinitionKey !== priorKey)
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "manual_selection_lost",
      "manually_corrected_identity_would_change",
    );
  }

  if (
    includeManualDecisions &&
    priorVerification === "user_verified" &&
    prior.resolverResult === "resolved" &&
    (next.resolverResult !== "resolved" ||
      next.measurementDefinitionKey !== priorKey)
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "manual_selection_lost",
      "user_verified_identity_would_change",
    );
  }

  if (!prior.revisionId) {
    if (next.resolverResult === "resolved" && next.measurementDefinitionKey) {
      return finish(
        extractedRow,
        prior,
        next,
        "improved_resolution",
        "new_resolved",
      );
    }
    return finish(
      extractedRow,
      prior,
      next,
      "needs_review",
      "no_prior_no_resolved",
    );
  }

  if (
    prior.resolverResult === next.resolverResult &&
    prior.measurementDefinitionKey === next.measurementDefinitionKey &&
    prior.analyteKey === next.analyteKey &&
    prior.mappingConfidenceBand === next.mappingConfidenceBand
  ) {
    if (next.changeFacts.inputChange === "changed") {
      return finish(
        extractedRow,
        prior,
        next,
        "identity_changed",
        "input_identity_changed",
      );
    }
    if (next.changeFacts.inputChange === "unavailable") {
      return finish(
        extractedRow,
        prior,
        next,
        "needs_review",
        "input_identity_unavailable",
      );
    }
    if (next.changeFacts.releaseChange !== "unchanged") {
      return finish(
        extractedRow,
        prior,
        next,
        "unchanged",
        next.createRevision
          ? "release_refresh_requested"
          : "release_change_audit_only",
      );
    }
    return finish(extractedRow, prior, next, "unchanged", "identical_outcome");
  }

  if (
    next.resolverResult === "resolved" &&
    prior.resolverResult !== "resolved"
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "improved_resolution",
      "partial_or_worse_to_resolved",
    );
  }

  if (
    prior.resolverResult === "resolved" &&
    next.resolverResult !== "resolved"
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "regressed_resolution",
      "resolved_to_incomplete",
    );
  }

  if (
    next.resolverResult === "resolved" &&
    prior.resolverResult === "resolved" &&
    prior.measurementDefinitionKey !== next.measurementDefinitionKey
  ) {
    return finish(
      extractedRow,
      prior,
      next,
      "identity_changed",
      "resolved_definition_changed",
    );
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
      `mapping_${mappingChangeClassification}`,
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
  diffReasonCode: string,
): ReprocessBatchRowDiff {
  const protectedClassification =
    diffClassification === "skipped_manual_decision" ||
    diffClassification === "skipped_manual_correction";
  const createRevision = next.createRevision && !protectedClassification;
  const releaseRefreshEligible =
    diffClassification === "unchanged" &&
    next.changeFacts.inputChange === "unchanged" &&
    next.changeFacts.outcomeChange === "unchanged" &&
    next.changeFacts.releaseChange === "changed" &&
    createRevision;
  const activateRevision =
    createRevision &&
    next.changeFacts.inputChange !== "unavailable" &&
    (APPLY_ELIGIBLE_CLASSIFICATIONS[diffClassification] === true ||
      releaseRefreshEligible);
  const changeFacts: ReprocessChangeFacts = {
    ...next.changeFacts,
    createRevision,
    activateRevision,
  };
  const finalizedNext: ReprocessNextSnapshot = {
    ...next,
    changeFacts,
    createRevision,
    activateRevision,
  };
  return {
    extractedBiomarkerId: extractedRow.id,
    profileId: extractedRow.profile_id,
    documentId: extractedRow.document_id,
    prior,
    next: finalizedNext,
    diffClassification,
    diffReasonCode,
  };
}
