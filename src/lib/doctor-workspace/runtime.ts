import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DOCTOR_WORKSPACE_SCOPES,
  DoctorWorkspaceError,
  type DoctorWorkspaceOperation,
  type DoctorWorkspaceScope,
} from "@/lib/doctor-workspace/access";
import { sanitizeDoctorNoteCandidate } from "@/lib/doctor-workspace/lifecycle";
export { sanitizeDoctorNoteCandidate };

const Uuid = z.string().uuid();
const ScopeSchema = z.enum(DOCTOR_WORKSPACE_SCOPES);
const NullableIsoDate = z.string().nullable();

const ClinicSchema = z.object({
  clinic_id: Uuid,
  membership_id: Uuid,
  name: z.string(),
  role: z.enum(["owner", "admin", "clinician"]),
  membership_status: z.enum(["invited", "active", "suspended", "revoked"]),
});

const MembershipTransitionSchema = z.object({
  membership_id: Uuid,
  clinic_id: Uuid,
  clinician_profile_id: Uuid,
  role: z.enum(["owner", "admin", "clinician"]),
  status: z.enum(["invited", "active", "suspended", "revoked"]),
});

const AcceptedMembershipSchema = MembershipTransitionSchema.extend({
  accepted_at: z.string().nullable(),
});

const RevokedMembershipSchema = z.object({
  membership_id: Uuid,
  clinic_id: Uuid,
  clinician_profile_id: Uuid,
  status: z.literal("revoked"),
  revoked_at: z.string().nullable(),
});

const MembershipRowSchema = z.object({
  membership_id: Uuid,
  clinic_id: Uuid,
  clinic_name: z.string(),
  clinician_profile_id: Uuid,
  clinician_name: z.string(),
  role: z.enum(["owner", "admin", "clinician"]),
  status: z.enum(["invited", "active", "suspended", "revoked"]),
  invited_at: z.string(),
  accepted_at: NullableIsoDate,
  revoked_at: NullableIsoDate,
});

const WorkspaceAccessSchema = z.object({
  perspective: z.enum(["patient", "clinician"]),
  grant_id: Uuid,
  clinic_id: Uuid,
  clinic_name: z.string(),
  patient_profile_id: Uuid,
  patient_name: z.string(),
  clinician_profile_id: Uuid,
  clinician_name: z.string(),
  state: z.enum(["pending", "active", "expired", "revoked", "declined"]),
  scopes: z.array(ScopeSchema),
  requested_scopes: z.array(ScopeSchema),
  expires_at: NullableIsoDate,
  created_at: z.string(),
});

const ConsultationSchema = z.object({
  consultation_id: Uuid,
  clinic_id: Uuid,
  patient_profile_id: Uuid,
  patient_name: z.string(),
  clinician_profile_id: Uuid,
  clinician_name: z.string(),
  title: z.string(),
  status: z.enum(["draft", "in_progress", "reviewed", "closed", "cancelled"]),
  started_at: NullableIsoDate,
  ended_at: NullableIsoDate,
  created_at: z.string(),
  sources: z.array(z.record(z.string(), z.unknown())),
  latest_note: z.record(z.string(), z.unknown()).nullable(),
  recording_consent_id: Uuid.nullable(),
  recording_consent_state: z.enum(["active", "revoked", "expired"]).nullable(),
  recording_consent_expires_at: NullableIsoDate,
});

const CreatedConsultationSchema = z.object({
  consultation_id: Uuid,
  clinic_id: Uuid,
  patient_profile_id: Uuid,
  clinician_profile_id: Uuid,
  title: z.string(),
  status: z.string(),
  created_at: z.string(),
});

const ConsentSchema = z.object({
  consent_id: Uuid,
  consultation_id: Uuid,
  state: z.enum(["active", "revoked", "expired"]),
  expires_at: NullableIsoDate,
});

const RevokedConsentSchema = z.object({
  consent_id: Uuid,
  consultation_id: Uuid,
  state: z.literal("revoked"),
  revoked_at: z.string().nullable(),
});

const RecordingStartedSchema = z.object({
  recording_id: Uuid,
  consultation_id: Uuid,
  patient_profile_id: Uuid,
  clinician_profile_id: Uuid,
  status: z.string(),
  source_language: z.string().nullable(),
  created_at: z.string(),
});

const UploadPreparedSchema = z.object({
  recording_id: Uuid,
  storage_path: z.string().min(1),
  status: z.string(),
});

const UploadCompletedSchema = z.object({
  recording_id: Uuid,
  status: z.string(),
  uploaded_at: z.string(),
});

const RecordingSchema = z.object({
  recording_id: Uuid,
  consultation_id: Uuid,
  clinic_id: Uuid,
  patient_profile_id: Uuid,
  clinician_profile_id: Uuid,
  status: z.string(),
  source_language: z.string().nullable(),
  failure_code: z.string().nullable(),
  transcription_retryable: z.boolean(),
  source_audio_deleted_at: NullableIsoDate,
  transcript_status: z.string().nullable(),
  latest_note_status: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const RecordingDetailSchema = z.object({
  recording_id: Uuid,
  consultation_id: Uuid,
  clinic_id: Uuid,
  patient_profile_id: Uuid,
  clinician_profile_id: Uuid,
  status: z.string(),
  storage_path: z.string().nullable(),
  source_language: z.string().nullable(),
  failure_code: z.string().nullable(),
  transcription_retryable: z.boolean(),
  source_audio_deleted_at: NullableIsoDate,
  transcript_status: z.string().nullable(),
  transcript_text: z.string().nullable(),
  transcript_source_language: z.string().nullable(),
  latest_note: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const NoteRevisionSchema = z.object({
  revision_id: Uuid,
  consultation_id: Uuid,
  status: z.enum(["draft", "reviewed", "superseded", "deleted"]),
  content: z.record(z.string(), z.unknown()),
  source_references: z.array(z.unknown()),
  reviewed_at: NullableIsoDate,
});

export type DoctorWorkspaceClinic = z.infer<typeof ClinicSchema>;
export type DoctorWorkspaceAccessRow = z.infer<typeof WorkspaceAccessSchema>;
export type DoctorWorkspaceConsultation = z.infer<typeof ConsultationSchema>;
export type DoctorWorkspaceRecording = z.infer<typeof RecordingSchema>;
export type DoctorWorkspaceRecordingDetail = z.infer<
  typeof RecordingDetailSchema
>;
export type DoctorWorkspaceNoteRevision = z.infer<typeof NoteRevisionSchema>;
export type DoctorWorkspaceMembership = z.infer<typeof MembershipRowSchema>;

function classifyRuntimeError(message: string): DoctorWorkspaceError {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("access_denied") ||
    normalized.includes("consent_required")
  ) {
    return new DoctorWorkspaceError("access_denied");
  }
  if (
    normalized.includes("input_invalid") ||
    normalized.includes("path_invalid") ||
    normalized.includes("source_references_invalid")
  ) {
    return new DoctorWorkspaceError("invalid_input");
  }
  if (
    normalized.includes("state_invalid") ||
    normalized.includes("lease_invalid") ||
    normalized.includes("membership_exists") ||
    normalized.includes("membership_state_invalid")
  ) {
    return new DoctorWorkspaceError("conflict");
  }
  return new DoctorWorkspaceError("unavailable");
}

function firstRow<T>(schema: z.ZodType<T>, value: unknown): T {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) throw new DoctorWorkspaceError("unavailable");
  return parsed.data;
}

function rows<T>(schema: z.ZodType<T>, value: unknown): T[] {
  const parsed = z.array(schema).safeParse(Array.isArray(value) ? value : []);
  if (!parsed.success) throw new DoctorWorkspaceError("unavailable");
  return parsed.data;
}

async function callRows<T>(
  schema: z.ZodType<T>,
  name: string,
  args: Record<string, unknown>,
): Promise<T[]> {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) throw classifyRuntimeError(error.message);
  return rows(schema, data);
}

async function callOne<T>(
  schema: z.ZodType<T>,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) throw classifyRuntimeError(error.message);
  return firstRow(schema, data);
}

async function callOptional<T>(
  schema: z.ZodType<T>,
  name: string,
  args: Record<string, unknown>,
): Promise<T | null> {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) throw classifyRuntimeError(error.message);
  const candidate = Array.isArray(data) ? data[0] : data;
  if (candidate === null || candidate === undefined) return null;
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) throw new DoctorWorkspaceError("unavailable");
  return parsed.data;
}
function assertUuid(value: string): void {
  if (!Uuid.safeParse(value).success) {
    throw new DoctorWorkspaceError("invalid_input");
  }
}

function assertScopes(scopes: readonly DoctorWorkspaceScope[]): void {
  if (
    scopes.length === 0 ||
    new Set(scopes).size !== scopes.length ||
    scopes.some((scope) => !ScopeSchema.safeParse(scope).success)
  ) {
    throw new DoctorWorkspaceError("invalid_input");
  }
}

function assertOperation(operation: DoctorWorkspaceOperation): void {
  if (
    ![
      "read",
      "create",
      "update",
      "review",
      "export",
      "approve",
      "revoke",
      "delete",
    ].includes(operation)
  ) {
    throw new DoctorWorkspaceError("invalid_input");
  }
}

export async function listDoctorWorkspaceClinics(
  actorProfileId: string,
): Promise<DoctorWorkspaceClinic[]> {
  assertUuid(actorProfileId);
  return callRows(ClinicSchema, "eh170_list_clinics", {
    p_actor_profile_id: actorProfileId,
  });
}

export async function listDoctorWorkspaceMemberships(
  actorProfileId: string,
): Promise<DoctorWorkspaceMembership[]> {
  assertUuid(actorProfileId);
  return callRows(MembershipRowSchema, "eh170_list_clinician_memberships", {
    p_actor_profile_id: actorProfileId,
  });
}

export async function listDoctorWorkspaceAccess(
  actorProfileId: string,
): Promise<DoctorWorkspaceAccessRow[]> {
  assertUuid(actorProfileId);
  return callRows(WorkspaceAccessSchema, "eh170_list_workspace_access", {
    p_actor_profile_id: actorProfileId,
  });
}

export async function inviteDoctorWorkspaceClinician(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    clinicianProfileId: string;
    role?: "admin" | "clinician";
  }>,
): Promise<z.infer<typeof MembershipTransitionSchema>> {
  assertUuid(input.actorProfileId);
  assertUuid(input.clinicId);
  assertUuid(input.clinicianProfileId);
  return callOne(
    MembershipTransitionSchema,
    "eh170_invite_clinician_membership",
    {
      p_actor_profile_id: input.actorProfileId,
      p_clinic_id: input.clinicId,
      p_clinician_profile_id: input.clinicianProfileId,
      p_role: input.role ?? "clinician",
    },
  );
}

export async function acceptDoctorWorkspaceClinicianMembership(
  input: Readonly<{
    clinicianProfileId: string;
    membershipId: string;
  }>,
): Promise<z.infer<typeof AcceptedMembershipSchema>> {
  assertUuid(input.clinicianProfileId);
  assertUuid(input.membershipId);
  return callOne(
    AcceptedMembershipSchema,
    "eh170_accept_clinician_membership",
    {
      p_clinician_profile_id: input.clinicianProfileId,
      p_membership_id: input.membershipId,
    },
  );
}

export async function revokeDoctorWorkspaceClinicianMembership(
  input: Readonly<{
    actorProfileId: string;
    membershipId: string;
  }>,
): Promise<z.infer<typeof RevokedMembershipSchema>> {
  assertUuid(input.actorProfileId);
  assertUuid(input.membershipId);
  return callOne(RevokedMembershipSchema, "eh170_revoke_clinician_membership", {
    p_actor_profile_id: input.actorProfileId,
    p_membership_id: input.membershipId,
  });
}

export async function listDoctorWorkspaceConsultations(
  input: Readonly<{
    actorProfileId: string;
    clinicId?: string | null;
    patientProfileId?: string | null;
  }>,
): Promise<DoctorWorkspaceConsultation[]> {
  assertUuid(input.actorProfileId);
  if (input.clinicId) assertUuid(input.clinicId);
  if (input.patientProfileId) assertUuid(input.patientProfileId);
  return callRows(ConsultationSchema, "eh170_list_consultations", {
    p_actor_profile_id: input.actorProfileId,
    p_clinic_id: input.clinicId ?? null,
    p_patient_profile_id: input.patientProfileId ?? null,
  });
}

export async function createDoctorWorkspaceConsultation(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    patientProfileId: string;
    title?: string;
  }>,
): Promise<z.infer<typeof CreatedConsultationSchema>> {
  assertUuid(input.actorProfileId);
  assertUuid(input.clinicId);
  assertUuid(input.patientProfileId);
  return callOne(CreatedConsultationSchema, "eh170_create_consultation", {
    p_actor_profile_id: input.actorProfileId,
    p_clinic_id: input.clinicId,
    p_patient_profile_id: input.patientProfileId,
    p_title: input.title ?? "Consultation",
  });
}

export async function grantDoctorRecordingConsent(
  input: Readonly<{
    patientProfileId: string;
    consultationId: string;
    expiresAt?: Date | null;
  }>,
): Promise<z.infer<typeof ConsentSchema>> {
  assertUuid(input.patientProfileId);
  assertUuid(input.consultationId);
  return callOne(ConsentSchema, "eh170_grant_recording_consent", {
    p_patient_profile_id: input.patientProfileId,
    p_consultation_id: input.consultationId,
    p_expires_at: input.expiresAt?.toISOString() ?? null,
  });
}

export async function revokeDoctorRecordingConsent(
  input: Readonly<{
    patientProfileId: string;
    consentId: string;
  }>,
): Promise<z.infer<typeof RevokedConsentSchema>> {
  assertUuid(input.patientProfileId);
  assertUuid(input.consentId);
  return callOne(RevokedConsentSchema, "eh170_revoke_recording_consent", {
    p_patient_profile_id: input.patientProfileId,
    p_consent_id: input.consentId,
  });
}

export async function startDoctorRecording(
  input: Readonly<{
    actorProfileId: string;
    consultationId: string;
    sourceLanguage?: string | null;
  }>,
): Promise<z.infer<typeof RecordingStartedSchema>> {
  assertUuid(input.actorProfileId);
  assertUuid(input.consultationId);
  return callOne(RecordingStartedSchema, "eh170_start_recording", {
    p_actor_profile_id: input.actorProfileId,
    p_consultation_id: input.consultationId,
    p_source_language: input.sourceLanguage ?? null,
  });
}

export async function prepareDoctorRecordingUpload(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
    storagePath: string;
  }>,
): Promise<z.infer<typeof UploadPreparedSchema>> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOne(UploadPreparedSchema, "eh170_prepare_recording_upload", {
    p_actor_profile_id: input.actorProfileId,
    p_recording_id: input.recordingId,
    p_storage_path: input.storagePath,
  });
}

export async function completeDoctorRecordingUpload(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
    sourceLanguage?: string | null;
  }>,
): Promise<z.infer<typeof UploadCompletedSchema>> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOne(UploadCompletedSchema, "eh170_complete_recording_upload", {
    p_actor_profile_id: input.actorProfileId,
    p_recording_id: input.recordingId,
    p_source_language: input.sourceLanguage ?? null,
  });
}

export async function cancelDoctorRecording(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
  }>,
): Promise<{ recording_id: string; status: string }> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOne(
    z.object({ recording_id: Uuid, status: z.string() }),
    "eh170_cancel_recording",
    {
      p_actor_profile_id: input.actorProfileId,
      p_recording_id: input.recordingId,
    },
  );
}

export async function listDoctorRecordings(
  input: Readonly<{
    actorProfileId: string;
    consultationId?: string | null;
  }>,
): Promise<DoctorWorkspaceRecording[]> {
  assertUuid(input.actorProfileId);
  if (input.consultationId) assertUuid(input.consultationId);
  return callRows(RecordingSchema, "eh170_list_recordings", {
    p_actor_profile_id: input.actorProfileId,
    p_consultation_id: input.consultationId ?? null,
  });
}

export async function readDoctorRecording(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
  }>,
): Promise<DoctorWorkspaceRecordingDetail | null> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOptional(RecordingDetailSchema, "eh170_read_recording", {
    p_actor_profile_id: input.actorProfileId,
    p_recording_id: input.recordingId,
  });
}

export async function retryDoctorRecordingTranscription(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
  }>,
): Promise<{ recording_id: string; status: string }> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOne(
    z.object({ recording_id: Uuid, status: z.string() }),
    "eh170_retry_recording_transcription",
    {
      p_actor_profile_id: input.actorProfileId,
      p_recording_id: input.recordingId,
    },
  );
}

export async function prepareDoctorRecordingAudioDeletion(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
  }>,
): Promise<{
  recording_id: string;
  storage_path: string | null;
  source_audio_deleted_at: string | null;
}> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOne(
    z.object({
      recording_id: Uuid,
      storage_path: z.string().nullable(),
      source_audio_deleted_at: z.string().nullable(),
    }),
    "eh170_prepare_recording_audio_delete",
    {
      p_actor_profile_id: input.actorProfileId,
      p_recording_id: input.recordingId,
    },
  );
}

export async function markDoctorRecordingAudioDeleted(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
  }>,
): Promise<{ recording_id: string; source_audio_deleted_at: string }> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOne(
    z.object({ recording_id: Uuid, source_audio_deleted_at: z.string() }),
    "eh170_mark_recording_audio_deleted",
    {
      p_actor_profile_id: input.actorProfileId,
      p_recording_id: input.recordingId,
    },
  );
}

export async function deleteDoctorTranscript(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
  }>,
): Promise<{
  recording_id: string;
  transcript_id: string | null;
  status: string;
}> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOne(
    z.object({
      recording_id: Uuid,
      transcript_id: Uuid.nullable(),
      status: z.string(),
    }),
    "eh170_delete_transcript",
    {
      p_actor_profile_id: input.actorProfileId,
      p_recording_id: input.recordingId,
    },
  );
}

export async function createDoctorNoteDraft(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
    content: Record<string, unknown>;
    sourceReferences: unknown[];
  }>,
): Promise<DoctorWorkspaceNoteRevision> {
  assertUuid(input.actorProfileId);
  assertUuid(input.recordingId);
  return callOne(NoteRevisionSchema, "eh170_create_note_draft", {
    p_actor_profile_id: input.actorProfileId,
    p_recording_id: input.recordingId,
    p_content: sanitizeDoctorNoteCandidate(input.content),
    p_source_references: input.sourceReferences,
  });
}

export async function saveDoctorNoteRevision(
  input: Readonly<{
    actorProfileId: string;
    consultationId: string;
    recordingId: string;
    transcriptDraftId?: string | null;
    content: Record<string, unknown>;
    sourceReferences: unknown[];
    reviewed: boolean;
  }>,
): Promise<DoctorWorkspaceNoteRevision> {
  assertUuid(input.actorProfileId);
  assertUuid(input.consultationId);
  assertUuid(input.recordingId);
  if (input.transcriptDraftId) assertUuid(input.transcriptDraftId);
  return callOne(NoteRevisionSchema, "eh170_save_note_revision", {
    p_actor_profile_id: input.actorProfileId,
    p_consultation_id: input.consultationId,
    p_recording_id: input.recordingId,
    p_transcript_draft_id: input.transcriptDraftId ?? null,
    p_content: sanitizeDoctorNoteCandidate(input.content),
    p_source_references: input.sourceReferences,
    p_reviewed: input.reviewed,
  });
}

export async function deleteDoctorNoteRevision(
  input: Readonly<{
    actorProfileId: string;
    revisionId: string;
  }>,
): Promise<{ revision_id: string; status: string }> {
  assertUuid(input.actorProfileId);
  assertUuid(input.revisionId);
  return callOne(
    z.object({ revision_id: Uuid, status: z.string() }),
    "eh170_delete_note_revision",
    {
      p_actor_profile_id: input.actorProfileId,
      p_revision_id: input.revisionId,
    },
  );
}

export function assertDoctorWorkspaceOperation(
  operation: DoctorWorkspaceOperation,
): void {
  assertOperation(operation);
}
