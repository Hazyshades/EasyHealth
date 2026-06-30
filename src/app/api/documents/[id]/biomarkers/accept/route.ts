import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDocumentOwner } from "@/lib/documents/access";
import { normalizeBiomarkerKey } from "@/lib/schemas/biomarkers";

type RouteContext = { params: Promise<{ id: string }> };

function parseReferenceRange(range: string | null): {
  ref_low: number | null;
  ref_high: number | null;
} {
  if (!range?.trim()) return { ref_low: null, ref_high: null };
  const match = range.match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return { ref_low: null, ref_high: null };
  return {
    ref_low: Number.parseFloat(match[1]),
    ref_high: Number.parseFloat(match[2]),
  };
}

export async function POST(req: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const body = (await req.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((v) => typeof v === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No biomarker ids provided" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: rows, error: fetchError } = await supabase
    .from("document_extracted_biomarkers")
    .select("*")
    .eq("document_id", id)
    .eq("profile_id", profileId)
    .in("id", ids);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!rows?.length) {
    return NextResponse.json({ error: "No matching biomarkers" }, { status: 404 });
  }

  const observedAt =
    doc!.observed_at ?? new Date().toISOString().slice(0, 10);

  const accepted: string[] = [];

  for (const row of rows) {
    if (row.status === "accepted") continue;
    const value = row.value_numeric != null ? Number(row.value_numeric) : null;
    if (value == null || !Number.isFinite(value)) continue;

    const key = normalizeBiomarkerKey(row.biomarker_key ?? "", row.biomarker_name);
    const { ref_low, ref_high } = parseReferenceRange(row.reference_range);

    const { error: upsertError } = await supabase.from("observations").upsert(
      {
        profile_id: profileId,
        document_id: id,
        biomarker_key: key,
        name: row.biomarker_name,
        value,
        unit: row.unit ?? "",
        ref_low,
        ref_high,
        observed_at: observedAt,
        source_extracted_biomarker_id: row.id,
      },
      { onConflict: "profile_id,biomarker_key,observed_at" }
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    await supabase
      .from("document_extracted_biomarkers")
      .update({ status: "accepted" })
      .eq("id", row.id);

    accepted.push(row.id);
  }

  const { count: pendingCount } = await supabase
    .from("document_extracted_biomarkers")
    .select("id", { count: "exact", head: true })
    .eq("document_id", id)
    .in("status", ["needs_review", "pending_review"]);

  if ((pendingCount ?? 0) === 0) {
    await supabase
      .from("documents")
      .update({ processing_status: "ready", status: "completed" })
      .eq("id", id);
  }

  return NextResponse.json({ acceptedIds: accepted });
}
