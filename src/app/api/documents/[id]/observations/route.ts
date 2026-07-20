import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDocumentOwner } from "@/lib/documents/access";
import { isCurrentDocumentObservation } from "@/lib/documents/observation-read-boundaries";
import { getMeasurementDefinition } from "@/lib/biomarkers";

type RouteContext = { params: Promise<{ id: string }> };

type LinkedRevision = {
  resolver_result: string;
  verification_status: string;
  measurement_definition_key: string | null;
  is_active: boolean;
};

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
  source_extracted_biomarker_id: string | null;
  source_instrumental_measure_id: string | null;
  source_instrumental_measure:
    | InstrumentalMeasureSource
    | InstrumentalMeasureSource[]
    | null;
  normalization_revision: LinkedRevision | LinkedRevision[] | null;
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
      "id, observation_kind, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, source_extracted_biomarker_id, source_instrumental_measure_id, source_instrumental_measure:document_extracted_instrumental_measures!observations_instrumental_source_owner_fk(id, key_hint, raw_name, raw_value_text, raw_unit, source_page, source_text, source_locator, occurrence_index, snapshot_hash, is_current), normalization_revision:observation_normalization_revisions!observations_normalization_revision_fk(resolver_result, verification_status, measurement_definition_key, is_active)"
    )
    .eq("profile_id", profileId)
    .eq("document_id", id)
    .order("name", { ascending: true });

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }

  const projectedObservations = ((observations ?? []) as ObservationWithRevision[]).flatMap(
    ({ normalization_revision, source_instrumental_measure, ...observation }) => {
      const instrumentalSource = Array.isArray(source_instrumental_measure)
        ? source_instrumental_measure[0] ?? null
        : source_instrumental_measure;
      if (
        !isCurrentDocumentObservation({
          observation_kind: observation.observation_kind,
          source_instrumental_measure: instrumentalSource,
        })
      ) {
        return [];
      }
      const revisions = Array.isArray(normalization_revision)
        ? normalization_revision
        : normalization_revision
          ? [normalization_revision]
          : [];
      const activeRevision = revisions.find((revision) => revision.is_active) ?? null;
      const measurementDefinitionKey =
        activeRevision?.measurement_definition_key ??
        observation.measurement_definition_key ??
        null;
      const resolverResult =
        activeRevision?.resolver_result ?? observation.resolution_status ?? null;
      const definition = measurementDefinitionKey
        ? getMeasurementDefinition(measurementDefinitionKey)
        : undefined;
      const registryBindingReady =
        observation.observation_kind === "lab" &&
        activeRevision?.is_active === true &&
        resolverResult === "resolved" &&
        definition?.maturity === "reviewed";
      return [{
        ...observation,
        measurement_definition_key: measurementDefinitionKey,
        resolution_status: resolverResult,
        source_instrumental_measure: instrumentalSource,
        resolver_result: resolverResult,
        verification_status: activeRevision?.verification_status ?? null,
        registry_binding_ready: registryBindingReady,
      }];
    }
  );

  return NextResponse.json({ observations: projectedObservations });
}
