import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: report, error } = await supabase
    .from("reports")
    .select(
      "id, title, report_type, detail_level, document_ids, actual_source_document_ids, abnormal_only, content, summary_preview, created_at",
    )
    .eq("id", id)
    .eq("profile_id", profileId)
    .is("invalidated_at", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ report });
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
