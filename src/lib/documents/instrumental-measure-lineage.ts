/**
 * EH-105 contracts shared by extraction, the document worker, and typed readers.
 * `key_hint` is retained as raw model output only; source_locator +
 * occurrence_index identify the source occurrence within a snapshot.
 * EH-118: `bounding_box` is the normalized source region contract, never a
 * free-form model object.
 */
import type { SourceRegion } from "@/lib/documents/source-region";

export type InstrumentalMeasureMaterializationInput = {
  key_hint: string | null;
  name: string;
  raw_name: string;
  value: number;
  raw_value_text: string;
  unit: string;
  raw_unit: string;
  source_page: number | null;
  source_text: string | null;
  source_locator: string;
  occurrence_index: number;
  bounding_box: SourceRegion | null;
  confidence: number | null;
};

export type DocumentExtractedInstrumentalMeasure =
  InstrumentalMeasureMaterializationInput & {
    id: string;
    document_id: string;
    profile_id: string;
    processing_job_id: string | null;
    observed_at: string;
    modality: string | null;
    body_region: string | null;
    processing_version: string | null;
    extraction_model: string | null;
    snapshot_hash: string;
    is_current: boolean;
    superseded_at: string | null;
    created_at: string;
  };

// PR2: the EH-105 replace_document_instrumental_observations RPC is removed.
// Publication contracts live in ./instrumental-publication.ts.

export type InstrumentalObservationDto = {
  id: string;
  observation_kind: "instrumental";
  source_instrumental_measure_id: string;
  name: string;
  value: number | string | null;
  unit: string;
  observed_at: string;
  source_instrumental_measure: Pick<
    DocumentExtractedInstrumentalMeasure,
    | "id"
    | "key_hint"
    | "raw_name"
    | "raw_value_text"
    | "raw_unit"
    | "source_page"
    | "source_text"
    | "source_locator"
    | "occurrence_index"
    | "snapshot_hash"
    | "is_current"
  >;
};
