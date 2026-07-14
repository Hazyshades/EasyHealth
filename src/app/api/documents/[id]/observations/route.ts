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
  const { data: observations, error: obsError } = await supabase
    .from("observations")
    .select("id, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, source_extracted_biomarker_id")
    .eq("profile_id", profileId)
    .eq("document_id", id)
    .order("name", { ascending: true });

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }

  return NextResponse.json({ observations: observations ?? [] });
}
