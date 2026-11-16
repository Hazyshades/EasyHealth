import { createAdminClient } from "@/lib/supabase/admin";
import { DoctorWorkspaceError } from "@/lib/doctor-workspace/access";
import { readDoctorRecording } from "@/lib/doctor-workspace/runtime";

export const DOCTOR_RECORDINGS_BUCKET = "doctor-recordings";
export const DOCTOR_RECORDING_SIGNED_URL_TTL_SECONDS = 300;

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

export function recordingExtensionForMime(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? null;
}

export function buildDoctorRecordingStoragePath(
  consultationId: string,
  recordingId: string,
  mimeType: string,
): string {
  const extension = recordingExtensionForMime(mimeType);
  if (!extension) throw new DoctorWorkspaceError("invalid_input");
  return `consultations/${consultationId}/recordings/${recordingId}.${extension}`;
}

export async function createDoctorRecordingSignedUrl(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
  }>,
): Promise<string> {
  const recording = await readDoctorRecording(input);
  if (
    !recording ||
    !recording.storage_path ||
    recording.source_audio_deleted_at
  ) {
    throw new DoctorWorkspaceError("access_denied");
  }

  const { data, error } = await createAdminClient()
    .storage.from(DOCTOR_RECORDINGS_BUCKET)
    .createSignedUrl(
      recording.storage_path,
      DOCTOR_RECORDING_SIGNED_URL_TTL_SECONDS,
    );
  if (error || !data?.signedUrl) throw new DoctorWorkspaceError("unavailable");
  return data.signedUrl;
}

export async function deleteDoctorRecordingObject(
  input: Readonly<{
    actorProfileId: string;
    recordingId: string;
  }>,
): Promise<void> {
  const recording = await readDoctorRecording(input);
  if (!recording?.storage_path) return;
  const { error } = await createAdminClient()
    .storage.from(DOCTOR_RECORDINGS_BUCKET)
    .remove([recording.storage_path]);
  if (error) throw new DoctorWorkspaceError("unavailable");
}
