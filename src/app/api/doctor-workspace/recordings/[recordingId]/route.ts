import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionIdentity } from "@/lib/auth/identity";
import { DoctorWorkspaceError } from "@/lib/doctor-workspace/access";
import { isDictaphoneEnabled } from "@/lib/doctor-workspace/policy";
import { readDoctorRecording } from "@/lib/doctor-workspace/runtime";

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
  console.error("[doctor-workspace/recordings/:id] request failed", error);
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ recordingId: string }> },
): Promise<NextResponse> {
  const identity = await getSessionIdentity();
  if (!identity)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (identity.isGuest)
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  const actor = identity.profileId;
  if (!isDictaphoneEnabled(actor))
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  try {
    const { recordingId } = await context.params;
    const id = z.string().uuid().parse(recordingId);
    const detail = await readDoctorRecording({
      actorProfileId: actor,
      recordingId: id,
    });
    if (!detail)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { storage_path: _storagePath, ...safeDetail } = detail;
    return NextResponse.json({ data: safeDetail });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return errorResponse(error);
  }
}
