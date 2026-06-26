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
      "id, title, report_type, detail_level, document_ids, content, summary_preview, created_at"
    )
    .eq("id", id)
    .eq("profile_id", profileId)
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
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("id", id)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const { error } = await supabase.from("reports").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
