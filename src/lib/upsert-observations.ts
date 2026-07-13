import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBiomarkerDefinition,
  inferModifier,
  inferSpecimen,
  resolveCanonicalKey,
} from "@/lib/biomarkers";
import type { ExtractionResult } from "@/lib/schemas/biomarkers";

export async function upsertObservations(
  profileId: string,
  documentId: string,
  extraction: ExtractionResult
) {
  const supabase = createAdminClient();
  const observedAt = extraction.observed_at ?? new Date().toISOString().slice(0, 10);

  for (const biomarker of extraction.biomarkers) {
    const key = resolveCanonicalKey(biomarker.key, biomarker.name);
    const def = getBiomarkerDefinition(key);
    const specimen = inferSpecimen(key, biomarker.name, def?.specimen ?? null);
    const modifier = inferModifier(key, biomarker.name, null);

    const { error } = await supabase.from("observations").upsert(
      {
        profile_id: profileId,
        document_id: documentId,
        biomarker_key: key,
        name: biomarker.name,
        value: biomarker.value,
        value_kind: "numeric",
        value_text: String(biomarker.value),
        unit: biomarker.unit,
        ref_low: biomarker.ref_low ?? null,
        ref_high: biomarker.ref_high ?? null,
        observed_at: observedAt,
        specimen,
        modifier,
      },
      { onConflict: "profile_id,biomarker_key,observed_at,specimen,modifier" }
    );
    if (error) throw error;
  }

  return observedAt;
}
