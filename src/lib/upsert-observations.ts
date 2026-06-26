import { createAdminClient } from "@/lib/supabase/admin";
import type { ExtractionResult } from "@/lib/schemas/biomarkers";

export async function upsertObservations(
  profileId: string,
  documentId: string,
  extraction: ExtractionResult
) {
  const supabase = createAdminClient();
  const observedAt =
    extraction.observed_at ?? new Date().toISOString().slice(0, 10);

  for (const biomarker of extraction.biomarkers) {
    const { error } = await supabase.from("observations").upsert(
      {
        profile_id: profileId,
        document_id: documentId,
        biomarker_key: biomarker.key,
        name: biomarker.name,
        value: biomarker.value,
        unit: biomarker.unit,
        ref_low: biomarker.ref_low ?? null,
        ref_high: biomarker.ref_high ?? null,
        observed_at: observedAt,
      },
      { onConflict: "profile_id,biomarker_key,observed_at" }
    );
    if (error) throw error;
  }

  return observedAt;
}
