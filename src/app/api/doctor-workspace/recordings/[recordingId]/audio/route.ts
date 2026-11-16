import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileId } from "@/lib/auth/session";
import { DoctorWorkspaceError } from "@/lib/doctor-workspace/access";
import { isDictaphoneEnabled } from "@/lib/doctor-workspace/policy";
import { createDoctorRecordingSignedUrl } from "@/lib/doctor-workspace/storage";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ recordingId: string }> };

function errorResponse(error: unknown): NextResponse {
  if (error instanceof DoctorWorkspaceError) {
    const status =
      error.kind === "access_denied"
        ? 403
        : error.kind === "invalid_input"
          ? 400
          : 503;
    return NextResponse.json({ error: error.kind }, { status });
  }
  console.error(
    "[doctor-workspace/recordings/:id/audio] request failed",
    error,
  );
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const actor = await getSessionProfileId();
  if (!actor)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isDictaphoneEnabled(actor))
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  try {
    const { recordingId } = await params;
    const id = z.string().uuid().parse(recordingId);
    const signedUrl = await createDoctorRecordingSignedUrl({
      actorProfileId: actor,
      recordingId: id,
    });
    return NextResponse.json({ data: { signedUrl } });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return errorResponse(error);
  }
}
