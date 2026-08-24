import {
  compareSnapshotRows,
  hashHealthProfileSnapshotInput,
} from "@/lib/health-profile-snapshot-canonical";
import {
  getReviewedAssessmentBinding,
  type BodySystemId,
} from "@/lib/biomarkers";
import {
  getRegistryV2System,
} from "@/lib/biomarkers/registry-v2-runtime";
import {
  getActiveRegistryV2NormalizationRevision,
  isLaboratoryObservation,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "@/lib/documents/observation-read-boundaries";
import { projectLaboratoryOutcome } from "@/lib/documents/incomplete-laboratory-outcomes";
import {
  parseSourceRegion,
  sourceRegionMatchesPage,
} from "@/lib/documents/source-region";
import {
  buildHealthProfile,
  getMarkerStatus,
  type HealthProfileResult,
  type HealthProfileSource,
  type ScoreExclusion,
} from "@/lib/health-systems";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectHealthProfileLaboratoryInput } from "@/lib/health-profile-input";

type SnapshotLaboratorySource = {
  record_status?: string | null;
  is_current?: boolean | null;
  is_published?: boolean | null;
};

type SnapshotObservationRow = {
  id: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: "resolved" | "partial" | "ambiguous" | "unmapped" | null;
  name: string;
  value: number | string | null;
  unit: string | null;
  ref_low: number | string | null;
  ref_high: number | string | null;
  observed_at: string;
  document_id: string | null;
  observation_kind: "lab";
  value_kind: string | null;
  value_text: string | null;
  ordinal: number | string | null;
  specimen: string | null;
  modifier: string | null;
  source_page: number | null;
  source_text: string | null;
  bounding_box: unknown;
  source_extracted_biomarker?: SnapshotLaboratorySource | SnapshotLaboratorySource[] | null;
  normalization_revision:
    | RegistryV2NormalizationRevisionReadBoundary
    | RegistryV2NormalizationRevisionReadBoundary[]
    | null;
};
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
        "id, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, document_id, observation_kind, value_kind, value_text, ordinal, specimen, modifier, source_page, source_text, bounding_box, source_extracted_biomarker:document_extracted_biomarkers!observations_source_extracted_biomarker_fkey(record_status, is_current, is_published), normalization_revision:observation_normalization_revisions!observations_normalization_revision_same_source_fk(resolver_result, verification_status, measurement_definition_key, mapping_confidence, mapping_confidence_band, catalog_manifest_version, resolver_version, normalization_version, is_active, resolver_evidence)",
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
  const snapshotObservations = (observations ?? []) as SnapshotObservationRow[];
  const sourceIds = new Set(sources.map((source) => source.id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const excludedObservations: ScoreExclusion[] = [];
  const inputs = snapshotObservations
    .filter(
      (observation) =>
        isLaboratoryObservation(observation) &&
        (observation.document_id == null || sourceIds.has(observation.document_id)),
    )
    .sort(compareSnapshotRows)
    .flatMap((observation) => {
      const region = parseSourceRegion(observation.bounding_box);
      const sourceRegion = sourceRegionMatchesPage(region, observation.source_page)
        ? region
        : null;
      const relation = observation.normalization_revision;
      const input = projectHealthProfileLaboratoryInput({
        observation,
        relation,
        labUnitSystem: options.labUnitSystem,
      });

      if (input) {
        return [{
          ...input,
          observation_id: observation.id,
          source_page: observation.source_page,
          source_text: observation.source_text,
          source_region: sourceRegion,
        }];
      }

      const outcome = projectLaboratoryOutcome({ observation, relation });
      const activeRevision = getActiveRegistryV2NormalizationRevision(relation);
      const definitionKey =
        activeRevision?.measurement_definition_key ??
        observation.measurement_definition_key;
      const reviewedBinding = definitionKey
        ? getReviewedAssessmentBinding(definitionKey)
        : null;
      const systemId: BodySystemId = reviewedBinding?.binding.system ??
        (definitionKey ? getRegistryV2System(definitionKey) : "general");
      const assessmentExclusion = outcome.resolutionDetails.eligibility.exclusions.assessment;
      const reason: ScoreExclusion["reason"] =
        assessmentExclusion === "no_active_revision" ||
        assessmentExclusion === "incomplete_resolution" ||
        assessmentExclusion === "candidate_only_identity" ||
        assessmentExclusion === "assessment_binding_ineligible"
          ? assessmentExclusion
          : "assessment_binding_ineligible";
      const value = observation.value == null ? null : Number(observation.value);
      const refLow = observation.ref_low == null ? null : Number(observation.ref_low);
      const refHigh = observation.ref_high == null ? null : Number(observation.ref_high);
      const valueKind =
        observation.value_kind === "qualitative" ||
        observation.value_kind === "ordinal" ||
        observation.value_kind === "text" ||
        observation.value_kind === "numeric"
          ? observation.value_kind
          : "numeric";

      excludedObservations.push({
        observation_id: observation.id,
        system_id: systemId,
        key: reviewedBinding?.binding.assessmentInputKey ??
          observation.analyte_key ??
          definitionKey ??
          observation.name,
        measurement_definition_key: definitionKey,
        name: observation.name,
        value: Number.isFinite(value) ? value : null,
        value_text: observation.value_text,
        unit: observation.unit ?? "",
        ref_low: Number.isFinite(refLow) ? refLow : null,
        ref_high: Number.isFinite(refHigh) ? refHigh : null,
        status: getMarkerStatus(
          Number.isFinite(value) ? value : null,
          Number.isFinite(refLow) ? refLow : null,
          Number.isFinite(refHigh) ? refHigh : null,
          valueKind,
        ),
        observed_at: observation.observed_at,
        document_id: observation.document_id,
        source: observation.document_id ? sourceById.get(observation.document_id) ?? null : null,
        source_page: observation.source_page,
        source_text: observation.source_text,
        source_region: sourceRegion,
        reason,
        reason_detail: outcome.resolutionDetails.incompleteReason ?? outcome.outcome,
        contribution_group: null,
      });
      return [];
    });
  const profile = buildHealthProfile(inputs, sources, {
    excludedObservations,
  });
  const inputHash = hashHealthProfileSnapshotInput({
    inputs,
    sources,
    excludedObservations,
  });
  return { inputHash, profile, sourceDocumentIds: sources.map((source) => source.id) };
}