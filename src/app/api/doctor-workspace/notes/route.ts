import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileId } from "@/lib/auth/session";
import { DoctorWorkspaceError } from "@/lib/doctor-workspace/access";
import { isDictaphoneEnabled } from "@/lib/doctor-workspace/policy";
import {
  createDoctorNoteDraft,
  deleteDoctorNoteRevision,
  saveDoctorNoteRevision,
} from "@/lib/doctor-workspace/runtime";

const ContentSchema = z.record(z.string(), z.unknown());
const SourceReferenceSchema = z.union([
  z.object({
    field: z.string().min(1),
    kind: z.literal("transcript"),
    recording_id: z.string().uuid(),
  }),
  z.object({
    field: z.string().min(1),
    kind: z.literal("unavailable"),
    reason: z.string().min(1),
  }),
]);
const SourceReferencesSchema = z.array(SourceReferenceSchema).min(1);
const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draft"),
    recordingId: z.string().uuid(),
    content: ContentSchema,
    sourceReferences: SourceReferencesSchema,
  }),
  z.object({
    action: z.literal("save"),
    consultationId: z.string().uuid(),
    recordingId: z.string().uuid(),
    transcriptDraftId: z.string().uuid().nullable().optional(),
    content: ContentSchema,
    sourceReferences: SourceReferencesSchema,
    reviewed: z.boolean(),
  }),
  z.object({ action: z.literal("delete"), revisionId: z.string().uuid() }),
]);

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
  console.error("[doctor-workspace/notes] request failed", error);
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
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
      case "draft":
        return NextResponse.json(
          {
            data: await createDoctorNoteDraft({
              actorProfileId: actor,
              recordingId: input.recordingId,
              content: input.content,
              sourceReferences: input.sourceReferences,
            }),
          },
          { status: 201 },
        );
      case "save":
        return NextResponse.json(
          {
            data: await saveDoctorNoteRevision({
              actorProfileId: actor,
              consultationId: input.consultationId,
              recordingId: input.recordingId,
              transcriptDraftId: input.transcriptDraftId,
              content: input.content,
              sourceReferences: input.sourceReferences,
              reviewed: input.reviewed,
            }),
          },
          { status: 201 },
        );
      case "delete":
        return NextResponse.json({
          data: await deleteDoctorNoteRevision({
            actorProfileId: actor,
            revisionId: input.revisionId,
          }),
        });
    }
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return errorResponse(error);
  }
}
