import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildHealthProfile, type HealthProfileSource } from "@/lib/health-systems";

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [{ data: observations, error: obsError }, { data: documents, error: docError }] =
    await Promise.all([
      supabase
        .from("observations")
        .select(
          "biomarker_key, name, value, unit, ref_low, ref_high, observed_at, document_id"
        )
        .eq("profile_id", profileId),
      supabase
        .from("documents")
        .select("id, original_filename, observed_at, lab_name")
        .eq("profile_id", profileId)
        .eq("status", "completed")
        .order("observed_at", { ascending: false }),
    ]);

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }
  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  const sources: HealthProfileSource[] = (documents ?? []).map((doc) => ({
    id: doc.id,
    original_filename: doc.original_filename,
    observed_at: doc.observed_at,
    lab_name: doc.lab_name,
  }));

  const completedDocumentIds = new Set(sources.map((source) => source.id));
  const scopedObservations = (observations ?? []).filter(
    (observation) =>
      observation.document_id == null || completedDocumentIds.has(observation.document_id)
  );

  const profile = buildHealthProfile(
    scopedObservations.map((o) => ({
      biomarker_key: o.biomarker_key,
      name: o.name,
      value: Number(o.value),
      unit: o.unit,
      ref_low: o.ref_low != null ? Number(o.ref_low) : null,
      ref_high: o.ref_high != null ? Number(o.ref_high) : null,
      observed_at: o.observed_at,
      document_id: o.document_id,
    })),
    sources
  );

  return NextResponse.json(profile);
}
