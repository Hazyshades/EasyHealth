import {
  DoctorWorkspaceError,
  resolveDoctorWorkspaceAccess,
  type DoctorWorkspaceScope,
} from "@/lib/doctor-workspace/access";
import {
  buildHealthProfileSnapshot,
  type HealthProfileSnapshot,
} from "@/lib/health-profile-snapshot";
import { resolveReportRead, type ReportReadResult } from "@/lib/report-read";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSignedStorageUrl,
  getOriginalPath,
  type DocumentRow,
} from "@/lib/documents/access";

type SignedDocumentUrl = { url: string; expiresIn: number };

export async function readClinicianHealthProfile(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    patientProfileId: string;
    labUnitSystem: "us" | "si";
  }>,
): Promise<{
  grantId: string;
  snapshot: HealthProfileSnapshot;
}> {
  const grantId = await requireProjectionScope({
    ...input,
    scope: "health_profile",
  });
  const snapshot = await buildHealthProfileSnapshot({
    profileId: input.patientProfileId,
    labUnitSystem: input.labUnitSystem,
  });
  return { grantId, snapshot };
}

export async function readClinicianReport(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    patientProfileId: string;
    reportId: string;
  }>,
): Promise<{ grantId: string; report: ReportReadResult }> {
  const grantId = await requireProjectionScope({ ...input, scope: "reports" });
  const report = await resolveReportRead({
    profileId: input.patientProfileId,
    reportId: input.reportId,
    mode: "owner",
  });
  if (report.status === "structured") {
    return {
      grantId,
      report: { ...report, can_share: false, can_export: false },
    };
  }
  return { grantId, report };
}

export async function readClinicianDocument(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    patientProfileId: string;
    documentId: string;
  }>,
): Promise<{
  grantId: string;
  document:
    | (Omit<
        DocumentRow,
        "storage_path" | "original_storage_path" | "thumbnail_storage_path"
      > & {
        signedUrl: SignedDocumentUrl | null;
      })
    | null;
}> {
  const grantId = await requireProjectionScope({
    ...input,
    scope: "documents",
  });
  const { data, error } = await createAdminClient()
    .from("documents")
    .select(
      "id, profile_id, storage_path, original_storage_path, original_filename, status, document_type, review_mode, review_mode_locked_at, lab_name, observed_at, created_at, error_message, mime_type, file_size_bytes, thumbnail_storage_path, page_count, processing_status, processing_error, processing_version, extraction_model, processed_at, file_kind, document_summary, modality, detected_document_type, type_mismatch_warning, type_mismatch_reason, content_sha256, archived_at, archive_reason, lifecycle_state, upload_state",
    )
    .eq("id", input.documentId)
    .eq("profile_id", input.patientProfileId)
    .eq("lifecycle_state", "active")
    .eq("upload_state", "complete")
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { grantId, document: null };
  const document = data as unknown as DocumentRow;
  const signedUrl = await createSignedStorageUrl(getOriginalPath(document));
  const {
    storage_path: _storagePath,
    original_storage_path: _originalStoragePath,
    thumbnail_storage_path: _thumbnailStoragePath,
    ...safeDocument
  } = document;
  return { grantId, document: { ...safeDocument, signedUrl } };
}

async function requireProjectionScope(
  input: Readonly<{
    actorProfileId: string;
    clinicId: string;
    patientProfileId: string;
    scope: DoctorWorkspaceScope;
  }>,
): Promise<string> {
  return resolveDoctorWorkspaceAccess({
    actorProfileId: input.actorProfileId,
    clinicId: input.clinicId,
    patientProfileId: input.patientProfileId,
    scope: input.scope,
    operation: "read",
  }).then((decision) => {
    if (!decision.allowed || !decision.grant_id) {
      throw new DoctorWorkspaceError("access_denied");
    }
    return decision.grant_id;
  });
}
