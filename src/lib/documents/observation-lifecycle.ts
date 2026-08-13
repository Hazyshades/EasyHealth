import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isRejectionReasonCode,
  type RejectionReasonCode,
} from "./observation-verification-workflow";

export type RejectExtractedBiomarkerOptions = Readonly<{
  profileId: string;
  extractedBiomarkerId: string;
  expectedSourceSnapshot: string;
  expectedActiveRevisionId: string | null;
  reasonCode: RejectionReasonCode;
  requestHash?: string;
}>;

export type RejectExtractedBiomarkerResult = Readonly<{
  extractedBiomarkerId: string;
  priorRecordStatus: "active";
  nextRecordStatus: "rejected";
  activeRevisionId: string | null;
  wasReused: boolean;
  reasonCode: RejectionReasonCode;
}>;

export class ObservationLifecycleError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ObservationLifecycleError";
  }
}

const LIFECYCLE_ERROR_CODES: Record<string, true> = {
  authorization_required: true,
  invalid_lifecycle_request_hash: true,
  invalid_lifecycle_reason_code: true,
  stale_source_snapshot: true,
  stale_revision_snapshot: true,
  foreign_owner: true,
  extracted_biomarker_not_found: true,
  terminal_record: true,
  record_not_current: true,
  lifecycle_idempotency_conflict: true,
  eh120_lifecycle_transition_required: true,
  eh120_record_lineage_mismatch: true,
};

const LIFECYCLE_HTTP_STATUS: Readonly<Record<string, number>> = {
  authorization_required: 401,
  foreign_owner: 403,
  extracted_biomarker_not_found: 404,
  stale_source_snapshot: 409,
  stale_revision_snapshot: 409,
  lifecycle_idempotency_conflict: 409,
  terminal_record: 409,
  record_not_current: 409,
  invalid_lifecycle_reason_code: 400,
  invalid_lifecycle_request_hash: 400,
};

export function buildLifecycleRequestHash(options: {
  profileId: string;
  extractedBiomarkerId: string;
  expectedSourceSnapshot: string;
  expectedActiveRevisionId: string | null;
  reasonCode: RejectionReasonCode;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operation: "reject",
        profileId: options.profileId,
        extractedBiomarkerId: options.extractedBiomarkerId,
        expectedSourceSnapshot: options.expectedSourceSnapshot,
        expectedActiveRevisionId: options.expectedActiveRevisionId,
        reasonCode: options.reasonCode,
      }),
    )
    .digest("hex");
}

function lifecycleError(error: unknown): ObservationLifecycleError | null {
  if (!error || typeof error !== "object" || !("message" in error)) return null;
  const message = typeof error.message === "string" ? error.message : "";
  const code = Object.keys(LIFECYCLE_ERROR_CODES).find(
    (candidate) => message === candidate || message.includes(candidate),
  );
  if (!code) return null;
  return new ObservationLifecycleError(
    code,
    LIFECYCLE_HTTP_STATUS[code] ?? 422,
    code,
  );
}

export async function rejectExtractedBiomarker(
  options: RejectExtractedBiomarkerOptions,
): Promise<RejectExtractedBiomarkerResult> {
  if (!options.profileId || !options.extractedBiomarkerId) {
    throw new ObservationLifecycleError("authorization_required", 401, "authorization_required");
  }
  if (!options.expectedSourceSnapshot || !isRejectionReasonCode(options.reasonCode)) {
    throw new ObservationLifecycleError(
      "invalid_lifecycle_reason_code",
      400,
      "invalid_lifecycle_reason_code",
    );
  }

  const requestHash =
    options.requestHash ??
    buildLifecycleRequestHash({
      profileId: options.profileId,
      extractedBiomarkerId: options.extractedBiomarkerId,
      expectedSourceSnapshot: options.expectedSourceSnapshot,
      expectedActiveRevisionId: options.expectedActiveRevisionId,
      reasonCode: options.reasonCode,
    });
  const { data, error } = await createAdminClient().rpc(
    "eh120_reject_document_extracted_biomarker",
    {
      p_extracted_biomarker_id: options.extractedBiomarkerId,
      p_profile_id: options.profileId,
      p_expected_source_snapshot: options.expectedSourceSnapshot,
      p_expected_active_revision_id: options.expectedActiveRevisionId,
      p_reason_code: options.reasonCode,
      p_request_hash: requestHash,
    },
  );
  if (error) throw lifecycleError(error) ?? error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        extracted_biomarker_id?: string;
        prior_record_status?: string;
        next_record_status?: string;
        active_revision_id?: string | null;
        was_reused?: boolean;
      }
    | null
    | undefined;
  if (
    !row?.extracted_biomarker_id ||
    row.prior_record_status !== "active" ||
    row.next_record_status !== "rejected"
  ) {
    throw new ObservationLifecycleError(
      "lifecycle_transition_projection_missing",
      500,
      "lifecycle_transition_projection_missing",
    );
  }
  return {
    extractedBiomarkerId: row.extracted_biomarker_id,
    priorRecordStatus: "active",
    nextRecordStatus: "rejected",
    activeRevisionId: row.active_revision_id ?? null,
    wasReused: Boolean(row.was_reused),
    reasonCode: options.reasonCode,
  };
}
