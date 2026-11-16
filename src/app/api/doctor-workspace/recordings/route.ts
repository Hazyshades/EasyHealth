import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileId } from "@/lib/auth/session";
import { DoctorWorkspaceError } from "@/lib/doctor-workspace/access";
import { isDictaphoneEnabled } from "@/lib/doctor-workspace/policy";
import {
  cancelDoctorRecording,
  deleteDoctorTranscript,
  listDoctorRecordings,
  markDoctorRecordingAudioDeleted,
  prepareDoctorRecordingAudioDeletion,
  retryDoctorRecordingTranscription,
  startDoctorRecording,
} from "@/lib/doctor-workspace/runtime";
import { deleteDoctorRecordingObject } from "@/lib/doctor-workspace/storage";
const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    consultationId: z.string().uuid(),
    sourceLanguage: z.string().trim().max(16).nullable().optional(),
  }),
  z.object({ action: z.literal("cancel"), recordingId: z.string().uuid() }),
  z.object({ action: z.literal("retry"), recordingId: z.string().uuid() }),
  z.object({
    action: z.literal("delete_audio"),
    recordingId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("delete_transcript"),
    recordingId: z.string().uuid(),
  }),
]);

function response(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

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
  console.error("[doctor-workspace/recordings] request failed", error);
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const actor = await getSessionProfileId();
  if (!actor)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isDictaphoneEnabled(actor))
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const consultationId = request.nextUrl.searchParams.get("consultationId");
  if (consultationId && !z.string().uuid().safeParse(consultationId).success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    return response(
      await listDoctorRecordings({ actorProfileId: actor, consultationId }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const actor = await getSessionProfileId();
  if (!actor)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isDictaphoneEnabled(actor))
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  try {
    const input = ActionSchema.parse(await request.json());
    switch (input.action) {
      case "start":
        return response(
          await startDoctorRecording({
            actorProfileId: actor,
            consultationId: input.consultationId,
            sourceLanguage: input.sourceLanguage,
          }),
          201,
        );
      case "cancel":
        return response(
          await cancelDoctorRecording({
            actorProfileId: actor,
            recordingId: input.recordingId,
          }),
        );
      case "retry":
        return response(
          await retryDoctorRecordingTranscription({
            actorProfileId: actor,
            recordingId: input.recordingId,
          }),
        );
      case "delete_audio": {
        const deletion = await prepareDoctorRecordingAudioDeletion({
          actorProfileId: actor,
          recordingId: input.recordingId,
        });
        if (deletion.source_audio_deleted_at || !deletion.storage_path) {
          return response(deletion);
        }
        await deleteDoctorRecordingObject(deletion.storage_path);
        return response(
          await markDoctorRecordingAudioDeleted({
            actorProfileId: actor,
            recordingId: input.recordingId,
          }),
        );
      }
      case "delete_transcript":
        return response(
          await deleteDoctorTranscript({
            actorProfileId: actor,
            recordingId: input.recordingId,
          }),
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return errorResponse(error);
  }
}
