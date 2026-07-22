import { createAdminClient } from "@/lib/supabase/admin";
import {
  type ExtractedBiomarkerWriterRow,
  ObservationNormalizationWriterError,
  writeExtractedBiomarkerNormalization,
} from "./observation-normalization-writer";
import {
  acceptExtractedBiomarkerRows,
  type BiomarkerAcceptanceFailure,
} from "./biomarker-acceptance-batch";

type ExtractedBiomarkerRow = ExtractedBiomarkerWriterRow & {
  status: string | null;
};

export class BiomarkerAcceptanceError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

/**
 * Accept each extracted row through its own database transaction. A failed row
 * is reported without rolling back a different selected row that was promoted
 * successfully by the service-only v2 writer.
 */
export async function acceptExtractedBiomarkers(options: {
  profileId: string;
  documentId: string;
  observedAt: string;
  ids: string[];
}): Promise<{ acceptedIds: string[]; failures: BiomarkerAcceptanceFailure[] }> {
  const supabase = createAdminClient();
  const ids = [...new Set(options.ids)];
  const { data: rows, error: fetchError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, status, source_page, source_text, bounding_box, confidence, specimen, modifier, reported_alt_value, reported_alt_unit, raw_value_text, processing_version"
    )
    .eq("document_id", options.documentId)
    .eq("profile_id", options.profileId)
    .eq("is_current", true)
    .in("id", ids);

  if (fetchError) throw new BiomarkerAcceptanceError(fetchError.message);
  if (!rows?.length) throw new BiomarkerAcceptanceError("No matching biomarkers", 404);

  return acceptExtractedBiomarkerRows({
    ids,
    rows: rows as unknown as ExtractedBiomarkerRow[],
    writeRow: (row) =>
      writeExtractedBiomarkerNormalization({
        profileId: options.profileId,
        documentId: options.documentId,
        observedAt: options.observedAt,
        row,
        actorId: options.profileId,
        writeKind: "acceptance",
      }),
  });
}

export { ObservationNormalizationWriterError };
export { acceptExtractedBiomarkerRows, type BiomarkerAcceptanceFailure };
