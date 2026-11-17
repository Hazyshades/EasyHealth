import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionIdentity } from "@/lib/auth/identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { DoctorWorkspaceError } from "@/lib/doctor-workspace/access";
import { isDictaphoneEnabled } from "@/lib/doctor-workspace/policy";
import {
  cancelDoctorRecording,
  completeDoctorRecordingUpload,
  prepareDoctorRecordingUpload,
  readDoctorRecording,
} from "@/lib/doctor-workspace/runtime";
import {
  buildDoctorRecordingStoragePath,
  DOCTOR_RECORDINGS_BUCKET,
} from "@/lib/doctor-workspace/storage";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const SourceLanguage = z.string().trim().max(16).nullable().optional();

function errorResponse(error: unknown): NextResponse {
  if (error instanceof DoctorWorkspaceError) {
    const status =
      error.kind === "access_denied"
        ? 403
        : error.kind === "invalid_input"
          ? 400
          : error.kind === "conflict"
            ? 409
            : 503;
    return NextResponse.json({ error: error.kind }, { status });
  }
  console.error("[doctor-workspace/recordings/upload] request failed", error);
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const identity = await getSessionIdentity();
  if (!identity)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (identity.isGuest)
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  const actor = identity.profileId;
  if (!isDictaphoneEnabled(actor))
    return NextResponse.json({ error: "unavailable" }, { status: 503 });

  let preparedPath: string | null = null;
  let recordingId: string | null = null;
  try {
    const form = await request.formData();
    const parsedRecordingId = z.string().uuid().parse(form.get("recordingId"));
    recordingId = parsedRecordingId;
    const sourceLanguage = SourceLanguage.parse(form.get("sourceLanguage"));
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > MAX_AUDIO_BYTES
    ) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const recording = await readDoctorRecording({
      actorProfileId: actor,
      recordingId: parsedRecordingId,
    });
    if (!recording)
      return NextResponse.json({ error: "access_denied" }, { status: 403 });
    const storagePath = buildDoctorRecordingStoragePath(
      recording.consultation_id,
      recording.recording_id,
      file.type,
    );
    const prepared = await prepareDoctorRecordingUpload({
      actorProfileId: actor,
      recordingId: parsedRecordingId,
      storagePath,
    });
    preparedPath = prepared.storage_path;

    const { error: uploadError } = await createAdminClient()
      .storage.from(DOCTOR_RECORDINGS_BUCKET)
      .upload(prepared.storage_path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) throw new DoctorWorkspaceError("unavailable");

    const completed = await completeDoctorRecordingUpload({
      actorProfileId: actor,
      recordingId: parsedRecordingId,
      sourceLanguage,
    });
    return NextResponse.json({ data: completed }, { status: 201 });
  } catch (error) {
    if (preparedPath) {
      const { error: cleanupError } = await createAdminClient()
        .storage.from(DOCTOR_RECORDINGS_BUCKET)
        .remove([preparedPath]);
      if (cleanupError) {
        console.error(
          "[doctor-workspace/recordings/upload] cleanup failed",
          cleanupError,
        );
      }
    }
    if (preparedPath && recordingId) {
      try {
        await cancelDoctorRecording({
          actorProfileId: actor,
          recordingId,
        });
      } catch (cancelError) {
        console.error(
          "[doctor-workspace/recordings/upload] state cleanup failed",
          cancelError,
        );
      }
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    return errorResponse(error);
  }
}
