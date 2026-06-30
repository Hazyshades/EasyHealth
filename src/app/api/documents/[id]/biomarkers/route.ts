import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDocumentOwner } from "@/lib/documents/access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const supabase = createAdminClient();
  const { data: items, error: listError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, unit, reference_range, source_page, source_text, confidence, status, processing_version, extraction_model, created_at"
    )
    .eq("document_id", id)
    .eq("profile_id", profileId)
    .order("biomarker_name", { ascending: true });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json({ items: items ?? [] });
}
