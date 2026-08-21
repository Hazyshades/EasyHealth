import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDocumentOwner, noStoreJson } from "@/lib/documents/access";
import {
  getActiveRegistryV2NormalizationRevision,
  isCurrentDocumentObservation,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "@/lib/documents/observation-read-boundaries";
import { serializeLaboratoryOutcome } from "@/lib/documents/incomplete-laboratory-outcomes";
import {
  parseSourceRegion,
  sourceRegionMatchesPage,
} from "@/lib/documents/source-region";

type RouteContext = { params: Promise<{ id: string }> };

type InstrumentalMeasureSource = {
  id: string;
  key_hint: string | null;
  raw_name: string;
  raw_value_text: string;
  raw_unit: string;
  source_page: number | null;
  source_text: string | null;
  source_locator: string;
  occurrence_index: number;
  snapshot_hash: string;
  is_current: boolean;
};

type LaboratoryMeasureSource = {
  id: string;
  record_status: "active" | "rejected" | "superseded" | null;
  lifecycle_reason_code?: string | null;
  superseded_at?: string | null;
  superseded_by_processing_attempt_id?: string | null;
  is_current: boolean | null;
  is_published?: boolean | null;
  created_at: string;
};

type ObservationWithRevision = {
  id: string;
  observation_kind: "lab" | "instrumental";
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  name: string;
  value: number | string | null;
  unit: string;
  ref_low: number | string | null;
  ref_high: number | string | null;
  observed_at: string;
  source_page: number | null;
  source_text: string | null;
  bounding_box: unknown;
  source_extracted_biomarker_id: string | null;
  source_extracted_biomarker: LaboratoryMeasureSource | LaboratoryMeasureSource[] | null;
  source_instrumental_measure_id: string | null;
  source_instrumental_measure:
    | InstrumentalMeasureSource
    | InstrumentalMeasureSource[]
    | null;
  normalization_revision:
    | RegistryV2NormalizationRevisionReadBoundary
    | RegistryV2NormalizationRevisionReadBoundary[]
    | null;
  raw_name: string | null;
  raw_value_text: string | null;
  raw_unit: string | null;
  raw_reference_text: string | null;
  confidence: number | null;
  value_kind: string | null;
  value_text: string | null;
  ordinal: number | null;
  specimen: string | null;
  modifier: string | null;
};

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
    .select(
      "id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, confidence, raw_name, raw_value_text, raw_unit, raw_reference_text, source_page, source_text, bounding_box, value_kind, value_text, ordinal, specimen, modifier, ref_low, ref_high, observed_at, source_extracted_biomarker_id, source_extracted_biomarker:document_extracted_biomarkers!observations_source_extracted_biomarker_fkey(id, record_status, lifecycle_reason_code, superseded_at, superseded_by_processing_attempt_id, is_current, is_published, created_at), source_instrumental_measure_id, source_instrumental_measure:document_extracted_instrumental_measures!observations_instrumental_source_owner_fk(id, key_hint, raw_name, raw_value_text, raw_unit, source_page, source_text, source_locator, occurrence_index, snapshot_hash, is_current), normalization_revision:observation_normalization_revisions!observations_normalization_revision_same_source_fk(id, resolver_result, verification_status, measurement_definition_key, mapping_confidence, mapping_confidence_band, catalog_manifest_version, catalog_manifest_digest, resolver_version, normalization_version, is_active, resolver_evidence, measurement_override)"
    )
    .eq("profile_id", profileId)
    .eq("document_id", id)
    .order("name", { ascending: true });

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }
  const projectedObservations = ((observations ?? []) as ObservationWithRevision[]).flatMap(
    ({
      normalization_revision,
      source_extracted_biomarker,
      source_instrumental_measure,
      ...observation
    }) => {
      const laboratorySource = Array.isArray(source_extracted_biomarker)
        ? source_extracted_biomarker[0] ?? null
        : source_extracted_biomarker;
      const instrumentalSource = Array.isArray(source_instrumental_measure)
        ? source_instrumental_measure[0] ?? null
        : source_instrumental_measure;
      if (
        !isCurrentDocumentObservation({
          observation_kind: observation.observation_kind,
          source_extracted_biomarker: laboratorySource,
          source_instrumental_measure: instrumentalSource,
        })
      ) {
        return [];
      }
      const activeRevision =
        getActiveRegistryV2NormalizationRevision(normalization_revision);
      const serialized = serializeLaboratoryOutcome({
        observation: {
          ...observation,
          source_extracted_biomarker: laboratorySource,
        },
        relation: normalization_revision,
      });
      // EH-118: a region only renders on the page it was measured against.
      const region = parseSourceRegion(observation.bounding_box);
      return [{
        ...serialized,
        record_status: laboratorySource?.record_status ?? null,
        lifecycle_reason_code: laboratorySource?.lifecycle_reason_code ?? null,
        superseded_at: laboratorySource?.superseded_at ?? null,
        superseded_by_processing_attempt_id:
          laboratorySource?.superseded_by_processing_attempt_id ?? null,
        source_is_current: laboratorySource?.is_current ?? null,
        userCorrected: activeRevision?.measurement_override != null,
        bounding_box: sourceRegionMatchesPage(region, observation.source_page) ? region : null,
        source_instrumental_measure: instrumentalSource,
      }];
    }
  );

  return noStoreJson({ observations: projectedObservations });
}
