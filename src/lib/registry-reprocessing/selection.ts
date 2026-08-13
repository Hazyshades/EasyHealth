import { createAdminClient } from "@/lib/supabase/admin";
import type { ExtractedBiomarkerWriterRow } from "@/lib/documents/observation-normalization-writer";
import type { NormalizationRevision } from "@/lib/documents/normalization-revisions";
import type { ResolverResult } from "@/lib/biomarkers";
import type { ReprocessBatchInputs } from "./types";

export type ReprocessCandidateRow = ExtractedBiomarkerWriterRow & {
  profile_id: string;
  document_id: string;
  record_status: "active";
  is_current: true;
  observation_kind: "lab" | "instrumental";
  active_revision: NormalizationRevision | null;
};

/**
 * Column list used by the batch reader. Kept in one place so callers do not
 * drift from what the writer needs. `raw_value_text` and provenance columns
 * are pulled because the writer reads them; they never leave the CLI JSON.
 */
const EXTRACTED_COLUMNS =
  "id, document_id, profile_id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, confidence, specimen, modifier, source_page, source_text, bounding_box, reported_alt_value, reported_alt_unit, raw_value_text, method, processing_version, record_status, is_current";

const REVISION_COLUMNS =
  "id, extracted_biomarker_id, observation_id, measurement_definition_key, analyte_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, verification_decided_at, verification_actor_type, verification_actor_id, is_active, mapping_change_classification, resolver_evidence, measurement_override";

/**
 * Selects laboratory extracted rows that should participate in a batch. The
 * caller receives extracted rows plus their currently active normalization
 * revision (if any).
 *
 * Instrumental rows are excluded structurally rather than by a filter:
 * `document_extracted_biomarkers` is the laboratory extraction table, and
 * `observations_instrumental_lineage_check` (migration 032) guarantees that
 * an `observation_kind = 'instrumental'` observation always has
 * `source_extracted_biomarker_id IS NULL`. No instrumental measure can
 * therefore be backed by a row in this table; instrumental measures live in
 * `document_extracted_instrumental_measures`. We stamp `observation_kind`
 * as `'lab'` so the diff service keeps its defensive guard for callers that
 * build a candidate row by hand.
 *
 * The active-revision filter on `verification_status` and
 * `resolver_result` is applied after we know the revision, because PostgREST
 * cannot express "active revision resolver result matches this filter" in a
 * single filter clause without an embed hint that would collide with the
 * alias-bridge work in `fix-postgrest-normalization-revision-embeds`. We do
 * two queries instead: extracted rows first, then their revisions by
 * extracted-row id.
 *
 * Protected manual rows remain in the returned candidate set. The diff layer
 * records them as `skipped_manual_correction` so a dry run reports the row and
 * the batch counter instead of silently dropping a user decision.
 */
export async function selectExtractedRowsForReprocessBatch(
  inputs: ReprocessBatchInputs
): Promise<ReprocessCandidateRow[]> {
  const supabase = createAdminClient();

  let extractedQuery = supabase
    .from("document_extracted_biomarkers")
    .select(EXTRACTED_COLUMNS)
    .eq("record_status", "active")
    .eq("is_current", true)
    .order("id", { ascending: true })
    .limit(inputs.batchLimit);
  if (inputs.scope.kind === "document") {
    extractedQuery = extractedQuery.eq("document_id", inputs.scope.documentId);
  } else if (inputs.scope.kind === "profile") {
    extractedQuery = extractedQuery.eq("profile_id", inputs.scope.profileId);
  }
  const { data: extractedData, error: extractedError } = await extractedQuery;
  if (extractedError) throw extractedError;
  const extractedRows = (extractedData ?? []) as unknown as Array<
    ExtractedBiomarkerWriterRow & {
      profile_id: string;
      document_id: string;
      record_status: "active";
      is_current: true;
    }
  >;

  if (extractedRows.length === 0) return [];

  const extractedIds = extractedRows.map((r) => r.id);
  const { data: revisionData, error: revisionError } = await supabase
    .from("observation_normalization_revisions")
    .select(REVISION_COLUMNS)
    .in("extracted_biomarker_id", extractedIds)
    .eq("is_active", true);
  if (revisionError) throw revisionError;

  const activeByExtractedId = new Map<string, NormalizationRevision>();
  // Same PostgREST-boundary reason as above: REVISION_COLUMNS is the runtime contract.
  for (const r of (revisionData ?? []) as unknown as NormalizationRevision[]) {
    activeByExtractedId.set(r.extracted_biomarker_id, r);
  }

  const wantedResults = new Set<ResolverResult>(inputs.filters.resolverResults);
  const candidates: ReprocessCandidateRow[] = [];

  for (const raw of extractedRows) {
    const active = activeByExtractedId.get(raw.id) ?? null;
    const activeResult: ResolverResult = active?.resolver_result ?? "unmapped";
    if (!wantedResults.has(activeResult)) continue;


    candidates.push({
      ...raw,
      observation_kind: "lab",
      active_revision: active,
    });
  }

  return candidates;
}
