import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDocumentType } from "@/lib/health-systems";

export async function GET(req: NextRequest) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeParam = req.nextUrl.searchParams.get("type");
  const supabase = createAdminClient();

  let query = supabase
    .from("documents")
    .select(
      "id, original_filename, status, document_type, lab_name, observed_at, created_at, error_message"
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (typeParam) {
    if (!isDocumentType(typeParam)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }
    query = query.eq("document_type", typeParam);
  }

  const { data: documents, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: documents ?? [] });
}
