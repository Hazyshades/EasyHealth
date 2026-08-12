/**
 * EH-121: the server-side reader for `observation_change_events`.
 *
 * The ledger is service-role only, so every read goes through the admin client
 * after the caller's ownership of the document has been asserted. The reader
 * never selects a column that could carry document text — the ledger has none —
 * and the column list is written out so a future column cannot leak in by
 * being added to the table.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ObservationChangeEventRow } from "./observation-change-history";

export const OBSERVATION_CHANGE_EVENT_SELECT =
  "id, event_kind, origin, observation_id, extracted_biomarker_id, " +
  "source_revision_id, source_prior_revision_id, source_reprocess_row_id, " +
  "actor_type, actor_id, correction_reason, " +
  "prior_measurement_definition_key, prior_analyte_key, prior_resolver_result, " +
  "prior_verification_status, prior_mapping_confidence_band, " +
  "prior_input_evidence_hash, " +
  "next_measurement_definition_key, next_analyte_key, next_resolver_result, " +
  "next_verification_status, next_mapping_confidence_band, " +
  "next_input_evidence_hash, " +
  "next_mapping_change_classification, catalog_manifest_version, " +
  "catalog_manifest_digest, resolver_version, normalization_version, " +
  "extraction_version, occurred_at, created_at";

export const OBSERVATION_CHANGE_HISTORY_DEFAULT_LIMIT = 200;
export const OBSERVATION_CHANGE_HISTORY_MAX_LIMIT = 500;

export type ObservationChangeEventQuery = Readonly<{
  profileId: string;
  documentId: string;
  observationId?: string | null;
  extractedBiomarkerId?: string | null;
  limit?: number;
}>;

export type ObservationChangeEventQueryResult =
  | { ok: true; rows: readonly ObservationChangeEventRow[] }
  | { ok: false; error: string };

export async function readObservationChangeEvents(
  query: ObservationChangeEventQuery,
): Promise<ObservationChangeEventQueryResult> {
  const supabase = createAdminClient();
  let request = supabase
    .from("observation_change_events")
    .select(OBSERVATION_CHANGE_EVENT_SELECT)
    .eq("profile_id", query.profileId)
    .eq("document_id", query.documentId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(query.limit ?? OBSERVATION_CHANGE_HISTORY_DEFAULT_LIMIT);

  if (query.observationId) {
    request = request.eq("observation_id", query.observationId);
  }
  if (query.extractedBiomarkerId) {
    request = request.eq("extracted_biomarker_id", query.extractedBiomarkerId);
  }

  const { data, error } = await request;
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as unknown as ObservationChangeEventRow[] };
}
