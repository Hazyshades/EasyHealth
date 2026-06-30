import { normalizeBiomarkerKey, parseReferenceRange } from "@/lib/schemas/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";

type ExtractedBiomarkerRow = {
  id: string;
  biomarker_key: string | null;
  biomarker_name: string;
  value_numeric: number | string | null;
  unit: string | null;
  reference_range: string | null;
  status: string | null;
};

export class BiomarkerAcceptanceError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
  }
}

function toFiniteNumber(value: number | string | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function acceptExtractedBiomarkers(options: {
  profileId: string;
  documentId: string;
  observedAt: string;
  ids: string[];
}): Promise<{ acceptedIds: string[] }> {
  const supabase = createAdminClient();
  const { profileId, documentId, observedAt, ids } = options;

  const { data: rows, error: fetchError } = await supabase
    .from("document_extracted_biomarkers")
    .select("id, biomarker_key, biomarker_name, value_numeric, unit, reference_range, status")
    .eq("document_id", documentId)
    .eq("profile_id", profileId)
    .in("id", ids);

  if (fetchError) {
    throw new BiomarkerAcceptanceError(fetchError.message);
  }
  if (!rows?.length) {
    throw new BiomarkerAcceptanceError("No matching biomarkers", 404);
  }

  const observations = (rows as ExtractedBiomarkerRow[])
    .filter((row) => row.status !== "accepted")
    .map((row) => {
      const value = toFiniteNumber(row.value_numeric);
      if (value == null) return null;

      const { ref_low, ref_high } = parseReferenceRange(row.reference_range);
      return {
        profile_id: profileId,
        document_id: documentId,
        biomarker_key: normalizeBiomarkerKey(row.biomarker_key ?? "", row.biomarker_name),
        name: row.biomarker_name,
        value,
        unit: row.unit ?? "",
        ref_low,
        ref_high,
        observed_at: observedAt,
        source_extracted_biomarker_id: row.id,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const acceptedIds = observations.map((row) => row.source_extracted_biomarker_id);

  if (observations.length > 0) {
    const { error: upsertError } = await supabase
      .from("observations")
      .upsert(observations, { onConflict: "profile_id,biomarker_key,observed_at" });
    if (upsertError) {
      throw new BiomarkerAcceptanceError(upsertError.message);
    }

    const { error: updateError } = await supabase
      .from("document_extracted_biomarkers")
      .update({ status: "accepted" })
      .in("id", acceptedIds);
    if (updateError) {
      throw new BiomarkerAcceptanceError(updateError.message);
    }
  }

  const { count: pendingCount, error: countError } = await supabase
    .from("document_extracted_biomarkers")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId)
    .in("status", ["needs_review", "pending_review"]);

  if (countError) {
    throw new BiomarkerAcceptanceError(countError.message);
  }

  if ((pendingCount ?? 0) === 0) {
    const { error: documentError } = await supabase
      .from("documents")
      .update({ processing_status: "ready", status: "completed" })
      .eq("id", documentId);
    if (documentError) {
      throw new BiomarkerAcceptanceError(documentError.message);
    }
  }

  return { acceptedIds };
}
