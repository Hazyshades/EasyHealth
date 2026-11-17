import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionIdentity } from "@/lib/auth/identity";
import { DoctorWorkspaceError } from "@/lib/doctor-workspace/access";
import { isDoctorWorkspaceEnabled } from "@/lib/doctor-workspace/policy";
import {
  readClinicianDocument,
  readClinicianHealthProfile,
  readClinicianReport,
} from "@/lib/doctor-workspace/projection";

const QuerySchema = z.object({
  kind: z.enum(["health_profile", "report", "document"]),
  clinicId: z.string().uuid(),
  patientProfileId: z.string().uuid(),
  resourceId: z.string().uuid().optional(),
  labUnitSystem: z.enum(["us", "si"]).default("us"),
});

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
  console.error("[doctor-workspace/projection] request failed", error);
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await getSessionIdentity();
  if (!identity)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (identity.isGuest)
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  const actor = identity.profileId;
  if (!isDoctorWorkspaceEnabled(actor))
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  try {
    const query = QuerySchema.parse({
      kind: request.nextUrl.searchParams.get("kind"),
      clinicId: request.nextUrl.searchParams.get("clinicId"),
      patientProfileId: request.nextUrl.searchParams.get("patientProfileId"),
      resourceId: request.nextUrl.searchParams.get("resourceId") ?? undefined,
      labUnitSystem: request.nextUrl.searchParams.get("labUnitSystem") ?? "us",
    });
    if (!query.resourceId && query.kind !== "health_profile") {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    if (query.kind === "health_profile") {
      return NextResponse.json({
        data: await readClinicianHealthProfile({
          actorProfileId: actor,
          clinicId: query.clinicId,
          patientProfileId: query.patientProfileId,
          labUnitSystem: query.labUnitSystem,
        }),
      });
    }
    if (query.kind === "report") {
      const result = await readClinicianReport({
        actorProfileId: actor,
        clinicId: query.clinicId,
        patientProfileId: query.patientProfileId,
        reportId: query.resourceId!,
      });
      if (result.report.status === "unavailable") {
        return NextResponse.json(
          { data: result },
          { status: result.report.reason === "not_found" ? 404 : 410 },
        );
      }
      return NextResponse.json({ data: result });
    }
    const result = await readClinicianDocument({
      actorProfileId: actor,
      clinicId: query.clinicId,
      patientProfileId: query.patientProfileId,
      documentId: query.resourceId!,
    });
    if (!result.document)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return errorResponse(error);
  }
}
