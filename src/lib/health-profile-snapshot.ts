import {
  compareSnapshotRows,
  hashHealthProfileSnapshotInput,
} from "@/lib/health-profile-snapshot-canonical";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildHealthProfile,
  type HealthProfileResult,
  type HealthProfileSource,
} from "@/lib/health-systems";
import { projectHealthProfileLaboratoryInput } from "@/lib/health-profile-input";
import { isLaboratoryObservation } from "@/lib/documents/observation-read-boundaries";

export type HealthProfileAssessment = Omit<
  HealthProfileResult,
  "holistic_synthesis"
>;

export type HealthProfileSnapshot = Readonly<{
  inputHash: string;
  profile: HealthProfileAssessment;
  sourceDocumentIds: string[];
}>;

export { compareSnapshotRows, hashHealthProfileSnapshotInput };

/** Builds the same Registry-v2-gated score input for HTTP and queued work. */
export async function buildHealthProfileSnapshot(options: {
  profileId: string;
  labUnitSystem: "us" | "si";
}): Promise<HealthProfileSnapshot> {
  const supabase = createAdminClient();
  const [{ data: observations, error: obsError }, { data: documents, error: docError }] = await Promise.all([
    supabase
      .from("observations")
      .select(
        "id, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, observation_kind, value_kind, value_text, ordinal, specimen, modifier, normalization_revision:observation_normalization_revisions!observations_normalization_revision_same_source_fk(resolver_result, verification_status, measurement_definition_key, mapping_confidence, mapping_confidence_band, catalog_manifest_version, resolver_version, normalization_version, is_active, resolver_evidence)",
      )
      .eq("profile_id", options.profileId)
      .eq("observation_kind", "lab"),
    supabase
      .from("documents")
      .select("id, original_filename, observed_at, lab_name, document_type, processing_status, status")
      .eq("profile_id", options.profileId)
      .is("archived_at", null),
  ]);
  if (obsError) throw new Error(obsError.message);
  if (docError) throw new Error(docError.message);

  const sources: HealthProfileSource[] = (documents ?? [])
    .filter(
      (doc) =>
        doc.status === "completed" ||
        doc.processing_status === "ready" ||
        doc.processing_status === "needs_review",
    )
    .sort(compareSnapshotRows)
    .map((doc) => ({
      id: doc.id,
      original_filename: doc.original_filename,
      observed_at: doc.observed_at,
      lab_name: doc.lab_name,
      document_type: doc.document_type,
    }));
  const sourceIds = new Set(sources.map((source) => source.id));
  const inputs = (observations ?? [])
    .filter(
      (observation) =>
        isLaboratoryObservation(observation) &&
        (observation.document_id == null || sourceIds.has(observation.document_id)),
    )
    .sort(compareSnapshotRows)
    .flatMap((observation) => {
      const input = projectHealthProfileLaboratoryInput({
        observation,
        relation: observation.normalization_revision,
        labUnitSystem: options.labUnitSystem,
      });
      return input ? [input] : [];
    });
  const profile = buildHealthProfile(inputs, sources);
  const inputHash = hashHealthProfileSnapshotInput({ inputs, sources });
  return { inputHash, profile, sourceDocumentIds: sources.map((source) => source.id) };
}