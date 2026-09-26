import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveReportRead } from "@/lib/report-read";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const result = await resolveReportRead({
      profileId,
      reportId: id,
      mode: "owner",
    });
    if (result.status === "unavailable") {
      return NextResponse.json(
        {
          error:
            result.reason === "not_found"
              ? "Report not found"
              : "Report unavailable",
        },
        { status: result.reason === "not_found" ? 404 : 410 },
      );
    }
    return NextResponse.json({
      status: result.status,
      can_share: result.can_share,
      can_export: result.can_export,
      report: result.report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Report unavailable",
        message: error instanceof Error ? error.message : "Read failed",
      },
      { status: 500 },
    );
  }
}
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { error } = await createAdminClient().rpc("delete_owner_report", {
    p_profile_id: profileId,
    p_report_id: id,
  });

  if (error) {
    const notFound = error.message.includes("report_not_found");
    return NextResponse.json(
      { error: notFound ? "Report not found" : "Report deletion unavailable" },
      { status: notFound ? 404 : 409 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
