import { createHash } from "node:crypto";
import type {
  MappingChangeClassification,
  MeasurementResolution,
  MeasurementResolutionInput,
  VerificationActorType,
  ResolverDecisionTrace,
  VerificationStatus,
} from "@/lib/biomarkers";
import {
  buildDirectResolverInputIdentity,
  buildPreparedEvidenceIdentity,
  MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
} from "./measurement-evidence-identity";
import type { PreparedEvidence } from "./measurement-evidence-admission";
import type { MeasurementOverride } from "./observation-measurement-correction";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compatibleManualDefinitions,
  decideAutomaticPromotion,
  type PromotionDecision,
} from "./normalization-policy";

export {
  compatibleManualDefinitions,
  decideAutomaticPromotion,
  type PromotionDecision,
};

export type NormalizationRevision = {
  id: string;
  extracted_biomarker_id: string;
  input_evidence_hash?: string | null;
  observation_id: string | null;
  measurement_definition_key: string | null;
  analyte_key: string | null;
  resolver_result: MeasurementResolution["result"];
  mapping_confidence: number;
  mapping_confidence_band: MeasurementResolution["mappingConfidenceBand"] | null;
  verification_status: VerificationStatus;
  verification_decided_at: string | null;
  verification_actor_type: VerificationActorType | null;
  verification_actor_id: string | null;
  is_active: boolean;
  mapping_change_classification: MappingChangeClassification | null;
  resolver_evidence: ResolverDecisionTrace;
  input_identity_format_version?: string | null;
  catalog_manifest_version?: string | null;
  catalog_manifest_digest?: string | null;
  resolver_version?: string | null;
  normalization_version?: string | null;
  /**
   * EH-119: the reviewer's restatement of the reported measurement, or null
   * when the revision reports the extraction as read. Its presence is what
   * marks a row as user-corrected; verification status stays EH-120's.
   */
  measurement_override: MeasurementOverride | null;
};

/**
 * The raw-resolution input identity used by the service-only atomic writer.
 * Prepared source rows use the versioned canonical identity. Direct Resolver
 * fixtures retain a deterministic compatibility path until every fixture is
 * adapted to the source-row seam.
 */
export function buildInputEvidenceHash(
  evidence: MeasurementResolutionInput | PreparedEvidence,
): string {
  return "input" in evidence
    ? buildPreparedEvidenceIdentity(evidence).hash
    : buildDirectResolverInputIdentity(evidence).hash;
}

export function inputIdentityFormatVersion(
  evidence: MeasurementResolutionInput | PreparedEvidence,
): string {
  return "input" in evidence
    ? buildPreparedEvidenceIdentity(evidence).formatVersion
    : MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION;
}

export async function getActiveNormalizationRevision(
  extractedBiomarkerId: string
): Promise<NormalizationRevision | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("observation_normalization_revisions")
    .select(
      "id, extracted_biomarker_id, observation_id, input_evidence_hash, measurement_definition_key, analyte_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, verification_decided_at, verification_actor_type, verification_actor_id, is_active, mapping_change_classification, resolver_evidence, input_identity_format_version, catalog_manifest_version, catalog_manifest_digest, resolver_version, normalization_version, measurement_override"
    )
    .eq("extracted_biomarker_id", extractedBiomarkerId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as NormalizationRevision | null) ?? null;
}
export type HistoricalNormalizationRestoreResult = Readonly<{
  observationId: string;
  revisionId: string;
  verificationStatus: VerificationStatus;
  resolverResult: MeasurementResolution["result"];
  wasReused: boolean;
}>;

export class HistoricalNormalizationRestoreError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
    public readonly code = "historical_restore_failed",
  ) {
    super(message);
    this.name = "HistoricalNormalizationRestoreError";
  }
}

export async function restoreHistoricalNormalizationRevision(options: {
  extractedBiomarkerId: string;
  targetRevisionId: string;
  expectedActiveRevisionId: string;
  actorId: string;
  correctionReason: string;
  observationPayload: Record<string, unknown>;
}): Promise<HistoricalNormalizationRestoreResult> {
  if (!options.correctionReason.trim()) {
    throw new Error("A reason is required to restore a historical revision");
  }
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        actorId: options.actorId,
        extractedBiomarkerId: options.extractedBiomarkerId,
        targetRevisionId: options.targetRevisionId,
        expectedActiveRevisionId: options.expectedActiveRevisionId,
        correctionReason: options.correctionReason,
      }),
    )
    .digest("hex");
  const { data, error } = await createAdminClient().rpc(
    "restore_observation_normalization_revision_v1",
    {
      p_extracted_biomarker_id: options.extractedBiomarkerId,
      p_target_revision_id: options.targetRevisionId,
      p_expected_active_revision_id: options.expectedActiveRevisionId,
      p_actor_id: options.actorId,
      p_correction_reason: options.correctionReason,
      p_request_hash: requestHash,
      p_observation_payload: options.observationPayload,
    },
  );
  if (error) {
    const message =
      error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "Historical normalization restore failed";
    const code =
      [
        "historical_restore_revision_source_mismatch",
        "historical_restore_target_active",
        "historical_restore_missing_decision",
        "stale_revision_conflict",
        "historical_restore_request_conflict",
        "observation_not_found",
        "observation_source_owner_mismatch",
        "revision_observation_binding_conflict",
      ].find((candidate) => message.includes(candidate)) ?? "historical_restore_failed";
    throw new HistoricalNormalizationRestoreError(
      message,
      code === "historical_restore_request_conflict" || code === "stale_revision_conflict"
        ? 409
        : code === "observation_not_found"
          ? 404
          : 422,
      code,
    );
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (
    !row ||
    typeof row.observation_id !== "string" ||
    typeof row.revision_id !== "string" ||
    typeof row.verification_status !== "string" ||
    typeof row.resolver_result !== "string"
  ) {
    throw new HistoricalNormalizationRestoreError(
      "Historical normalization restore returned no revision",
    );
  }
  return {
    observationId: row.observation_id,
    revisionId: row.revision_id,
    verificationStatus: row.verification_status as VerificationStatus,
    resolverResult: row.resolver_result as MeasurementResolution["result"],
    wasReused: row.was_reused === true,
  };
}

export type BatchVerificationRestoreResult = Readonly<{
  observationId: string | null;
  revisionId: string;
  wasReused: boolean;
}>;

/**
 * EH-122 batch undo preserves its pending-verification transition while the
 * SQL function copies the saved resolution, trace, identity, and release.
 * Unlike the regular writer, this path never prepares or evaluates current
 * evidence.
 */
type BatchVerificationRestoreRpc = (params: {
  p_batch_revision_id: string;
  p_actor_id: string;
  p_correction_reason: string;
  p_request_hash: string;
}) => Promise<{ data: unknown; error: unknown }>;

export async function restoreBatchVerificationRevision(
  options: {
    batchRevisionId: string;
    actorId: string;
    correctionReason: string;
  },
  rpc: BatchVerificationRestoreRpc = async (params) =>
    createAdminClient().rpc(
      "eh122_reverse_observation_normalization_verification",
      params,
    ),
): Promise<BatchVerificationRestoreResult> {
  if (!options.correctionReason.trim()) {
    throw new Error("A reason is required to restore a batch verification");
  }
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        actorId: options.actorId,
        batchRevisionId: options.batchRevisionId,
        correctionReason: options.correctionReason,
      }),
    )
    .digest("hex");
  const { data, error } = await rpc({
    p_batch_revision_id: options.batchRevisionId,
    p_actor_id: options.actorId,
    p_correction_reason: options.correctionReason,
    p_request_hash: requestHash,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<
    string,
    unknown
  > | null;
  if (!row || typeof row.revision_id !== "string") {
    throw new Error("Batch verification restore returned no revision");
  }
  return {
    observationId:
      typeof row.observation_id === "string" ? row.observation_id : null,
    revisionId: row.revision_id,
    wasReused: row.was_reused === true,
  };
}

export type NormalizationSourceState = Readonly<{
  id: string;
  profile_id: string;
  document_id: string;
  record_status: "active" | "rejected" | "superseded";
  is_current: boolean;
  is_published: boolean;
}>;

export async function getNormalizationSourceState(
  extractedBiomarkerId: string,
): Promise<NormalizationSourceState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("document_extracted_biomarkers")
    .select("id, profile_id, document_id, record_status, is_current, is_published")
    .eq("id", extractedBiomarkerId)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data as NormalizationSourceState | null) ?? null;
}
