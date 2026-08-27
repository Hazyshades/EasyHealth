import { createHash } from "node:crypto";
import { resolveMeasurementDefinition } from "@/lib/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateBatchVerificationEligibility,
  type BatchVerificationExclusionCode,
} from "./batch-verification-eligibility";
import {
  measurementInputFromWriterRow,
  type ExtractedBiomarkerWriterRow,
  writeExtractedBiomarkerNormalization,
} from "./observation-normalization-writer";
import { getActiveNormalizationRevision } from "./normalization-revisions";
import {
  batchVerificationAggregateStatus,
  prepareBatchVerificationSnapshots,
  type BatchVerificationAggregateStatus,
  type BatchVerificationOutcome,
  type BatchVerificationSnapshot,
  type PreparedBatchVerificationSnapshots,
} from "./batch-verification-request";
export type { BatchVerificationSnapshot } from "./batch-verification-request";

export type BatchVerificationRowOutcome = Readonly<{
  extractedBiomarkerId: string;
  outcome: BatchVerificationOutcome;
  exclusionCodes?: readonly BatchVerificationExclusionCode[];
  error?: string;
  resultingRevisionId?: string;
}>;

export type BatchVerificationResult = Readonly<{
  operationId: string;
  aggregateStatus: BatchVerificationAggregateStatus;
  outcomes: readonly BatchVerificationRowOutcome[];
  replayed: boolean;
}>;

type BatchExtractedRow = ExtractedBiomarkerWriterRow & {
  status: string | null;
  record_status: "active" | "rejected" | "superseded" | null;
  created_at: string | null;
  is_current: boolean;
};

const BATCH_EXTRACTED_BIOMARKER_SELECT =
  "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, status, record_status, source_page, source_text, bounding_box, confidence, specimen, modifier, method, reported_alt_value, reported_alt_unit, raw_value_text, processing_version, collected_at, created_at, is_current";

export class BatchVerificationError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function asOutcomes(value: unknown): BatchVerificationRowOutcome[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        return typeof row.extracted_biomarker_id === "string" &&
          typeof row.outcome_code === "string"
          ? [{
              extractedBiomarkerId: row.extracted_biomarker_id,
              outcome: row.outcome_code as BatchVerificationRowOutcome["outcome"],
              ...(typeof row.resulting_revision_id === "string"
                ? { resultingRevisionId: row.resulting_revision_id }
                : {}),
            }]
          : [];
      })
    : [];
}

export async function executeBatchVerification(options: {
  profileId: string;
  documentId: string;
  observedAt: string | null;
  operationId: string;
  snapshots: readonly BatchVerificationSnapshot[];
}): Promise<BatchVerificationResult> {
  let prepared: PreparedBatchVerificationSnapshots;
  try {
    prepared = prepareBatchVerificationSnapshots(options.snapshots);
  } catch (caught) {
    throw new BatchVerificationError(
      caught instanceof Error ? caught.message : "Invalid batch verification request",
      400,
    );
  }
  const byId = new Map(
    prepared.snapshots.map((snapshot) => [snapshot.extractedBiomarkerId, snapshot]),
  );
  const hash = prepared.requestHash;
  const supabase = createAdminClient();
  const existing = await supabase
    .from("batch_verification_operations")
    .select("id, request_hash, aggregate_status")
    .eq("profile_id", options.profileId)
    .eq("operation_id", options.operationId)
    .maybeSingle();
  if (existing.error) throw new BatchVerificationError(existing.error.message, 500);
  if (existing.data) {
    if (existing.data.request_hash !== hash) {
      throw new BatchVerificationError("This operation id was already used for a different selection", 409);
    }
    const rows = await supabase
      .from("batch_verification_operation_rows")
      .select("extracted_biomarker_id, outcome_code, resulting_revision_id")
      .eq("operation_id", existing.data.id);
    if (rows.error) throw new BatchVerificationError(rows.error.message, 500);
    return {
      operationId: options.operationId,
      aggregateStatus: existing.data.aggregate_status as BatchVerificationResult["aggregateStatus"],
      outcomes: asOutcomes(rows.data),
      replayed: true,
    };
  }

  const created = await supabase
    .from("batch_verification_operations")
    .insert({
      profile_id: options.profileId,
      document_id: options.documentId,
      operation_id: options.operationId,
      request_hash: hash,
      aggregate_status: "executing",
    })
    .select("id")
    .single();
  if (created.error || !created.data) {
    throw new BatchVerificationError(created.error?.message ?? "Could not start batch verification", 500);
  }

  const rowResult = await supabase
    .from("document_extracted_biomarkers")
    .select(BATCH_EXTRACTED_BIOMARKER_SELECT)
    .eq("profile_id", options.profileId)
    .eq("document_id", options.documentId)
    .eq("is_published", true)
    .in("id", [...byId.keys()]);
  if (rowResult.error) throw new BatchVerificationError(rowResult.error.message, 500);
  const rowsById = new Map(
    ((rowResult.data ?? []) as unknown as BatchExtractedRow[]).map((row) => [row.id, row]),
  );
  const outcomes: BatchVerificationRowOutcome[] = [];

  for (const [id, snapshot] of byId) {
    const row = rowsById.get(id);
    if (!row) {
      outcomes.push({ extractedBiomarkerId: id, outcome: "missing" });
      continue;
    }
    const activeRevision = await getActiveNormalizationRevision(row.id);
    const resolution = resolveMeasurementDefinition(
      measurementInputFromWriterRow(row, activeRevision?.measurement_override),
    );
    const eligibility = evaluateBatchVerificationEligibility({
      status: row.status,
      recordStatus: row.record_status,
      isCurrent: row.is_current,
      sourceSnapshot: row.created_at,
      expectedSourceSnapshot: snapshot.sourceSnapshot,
      expectedActiveRevisionId: snapshot.activeRevisionId,
      resolution,
      activeRevision,
    });
    if (!eligibility.eligible) {
      outcomes.push({
        extractedBiomarkerId: id,
        outcome: "excluded",
        exclusionCodes: eligibility.exclusionCodes,
      });
      await supabase.from("batch_verification_operation_rows").insert({
        operation_id: created.data.id,
        extracted_biomarker_id: id,
        expected_source_snapshot: snapshot.sourceSnapshot,
        expected_active_revision_id: snapshot.activeRevisionId,
        prior_revision_id: activeRevision?.id ?? null,
        request_hash: createHash("sha256").update(`${hash}:${id}`).digest("hex"),
        outcome_code: "excluded",
      });
      continue;
    }
    try {
      const result = await writeExtractedBiomarkerNormalization({
        profileId: options.profileId,
        documentId: options.documentId,
        observedAt: options.observedAt,
        row,
        actorId: options.profileId,
        writeKind: "acceptance",
        resolution,
        expectedActiveRevision: activeRevision,
      });
      outcomes.push({
        extractedBiomarkerId: id,
        outcome: "verified",
        resultingRevisionId: result.revisionId,
      });
      await supabase.from("batch_verification_operation_rows").insert({
        operation_id: created.data.id,
        extracted_biomarker_id: id,
        expected_source_snapshot: snapshot.sourceSnapshot,
        expected_active_revision_id: snapshot.activeRevisionId,
        prior_revision_id: activeRevision?.id ?? null,
        resulting_revision_id: result.revisionId,
        request_hash: createHash("sha256").update(`${hash}:${id}`).digest("hex"),
        outcome_code: "verified",
      });
    } catch (error) {
      outcomes.push({
        extractedBiomarkerId: id,
        outcome: "failed",
        error: error instanceof Error ? error.message : "Verification failed",
      });
      await supabase.from("batch_verification_operation_rows").insert({
        operation_id: created.data.id,
        extracted_biomarker_id: id,
        expected_source_snapshot: snapshot.sourceSnapshot,
        expected_active_revision_id: snapshot.activeRevisionId,
        prior_revision_id: activeRevision?.id ?? null,
        request_hash: createHash("sha256").update(`${hash}:${id}`).digest("hex"),
        outcome_code: "failed",
      });
    }
  }

  const aggregateStatus = batchVerificationAggregateStatus(outcomes);
  const updated = await supabase
    .from("batch_verification_operations")
    .update({ aggregate_status: aggregateStatus, completed_at: new Date().toISOString() })
    .eq("id", created.data.id);
  if (updated.error) throw new BatchVerificationError(updated.error.message, 500);

  return { operationId: options.operationId, aggregateStatus, outcomes, replayed: false };
}

export async function reverseBatchVerification(options: {
  profileId: string;
  documentId: string;
  operationId: string;
  reason: string;
}): Promise<BatchVerificationResult> {
  if (!options.reason.trim()) {
    throw new BatchVerificationError("Explain why this verification is being undone", 400);
  }
  const supabase = createAdminClient();
  const operation = await supabase
    .from("batch_verification_operations")
    .select("id")
    .eq("profile_id", options.profileId)
    .eq("document_id", options.documentId)
    .eq("operation_id", options.operationId)
    .maybeSingle();
  if (operation.error) throw new BatchVerificationError(operation.error.message, 500);
  if (!operation.data) throw new BatchVerificationError("Batch verification operation not found", 404);

  const documentResult = await supabase
    .from("documents")
    .select("observed_at")
    .eq("id", options.documentId)
    .eq("profile_id", options.profileId)
    .maybeSingle();
  if (documentResult.error) {
    throw new BatchVerificationError(documentResult.error.message, 500);
  }
  if (!documentResult.data) {
    throw new BatchVerificationError("Document not found", 404);
  }
  const observedAt = documentResult.data.observed_at;

  const rows = await supabase
    .from("batch_verification_operation_rows")
    .select("id, extracted_biomarker_id, resulting_revision_id, reversal_revision_id")
    .eq("operation_id", operation.data.id);
  if (rows.error) throw new BatchVerificationError(rows.error.message, 500);

  const outcomes: BatchVerificationRowOutcome[] = [];
  for (const row of rows.data ?? []) {
    if (!row.resulting_revision_id) continue;
    if (row.reversal_revision_id) {
      outcomes.push({
        extractedBiomarkerId: row.extracted_biomarker_id,
        outcome: "verified",
        resultingRevisionId: row.reversal_revision_id,
      });
      continue;
    }

    const extractedResult = await supabase
      .from("document_extracted_biomarkers")
      .select(BATCH_EXTRACTED_BIOMARKER_SELECT)
      .eq("profile_id", options.profileId)
      .eq("document_id", options.documentId)
      .eq("id", row.extracted_biomarker_id)
      .eq("is_published", true)
      .maybeSingle();
    const extracted = extractedResult.data as BatchExtractedRow | null;
    const activeRevision = extracted
      ? await getActiveNormalizationRevision(extracted.id)
      : null;
    if (
      extractedResult.error ||
      !extracted ||
      extracted.record_status !== "active" ||
      !extracted.is_current ||
      activeRevision?.id !== row.resulting_revision_id
    ) {
      outcomes.push({
        extractedBiomarkerId: row.extracted_biomarker_id,
        outcome: "excluded",
        error: "This result changed after the batch verification.",
      });
      await supabase
        .from("batch_verification_operation_rows")
        .update({ reversal_outcome_code: "changed_since_batch" })
        .eq("id", row.id);
      continue;
    }

    try {
      const reversal = await writeExtractedBiomarkerNormalization({
        profileId: options.profileId,
        documentId: options.documentId,
        observedAt,
        row: extracted,
        actorId: options.profileId,
        writeKind: "verification_reversal",
        expectedActiveRevision: activeRevision,
        correctionReason: options.reason.trim(),
        reversalOfRevisionId: row.resulting_revision_id,
        supersedesRevisionId: row.resulting_revision_id,
      });
      outcomes.push({
        extractedBiomarkerId: row.extracted_biomarker_id,
        outcome: "verified",
        resultingRevisionId: reversal.revisionId,
      });
      await supabase
        .from("batch_verification_operation_rows")
        .update({
          reversal_revision_id: reversal.revisionId,
          reversal_outcome_code: "reversed",
        })
        .eq("id", row.id);
    } catch (caught) {
      outcomes.push({
        extractedBiomarkerId: row.extracted_biomarker_id,
        outcome: "excluded",
        error:
          caught instanceof Error
            ? caught.message
            : "This result changed after the batch verification.",
      });
      await supabase
        .from("batch_verification_operation_rows")
        .update({ reversal_outcome_code: "changed_since_batch" })
        .eq("id", row.id);
    }
  }

  const aggregateStatus =
    outcomes.length > 0 && outcomes.every((outcome) => outcome.outcome === "verified")
      ? "completed"
      : outcomes.some((outcome) => outcome.outcome === "verified")
        ? "partially_completed"
        : "no_op";
  await supabase
    .from("batch_verification_operations")
    .update({
      aggregate_status:
        aggregateStatus === "completed" ? "reversed" : "partially_reversed",
      reversal_reason: options.reason.trim(),
      reversal_requested_at: new Date().toISOString(),
    })
    .eq("id", operation.data.id);

  return {
    operationId: options.operationId,
    aggregateStatus,
    outcomes,
    replayed: false,
  };
}
