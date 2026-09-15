import {
  compareSnapshotRows,
  hashHealthProfileSnapshotInput,
} from "@/lib/health-profile-snapshot-canonical";
import {
  getReviewedAssessmentBinding,
  type BodySystemId,
} from "@/lib/biomarkers";
import { getRegistryV2System } from "@/lib/biomarkers/registry-v2-runtime";
import {
  isLaboratoryObservation,
  REGISTRY_V2_NORMALIZATION_REVISION_SELECT,
  type RegistryV2NormalizationRevisionReadBoundary,
} from "@/lib/documents/observation-read-boundaries";
import { projectLaboratoryOutcome } from "@/lib/documents/incomplete-laboratory-outcomes";
import {
  parseSourceRegion,
  sourceRegionMatchesPage,
} from "@/lib/documents/source-region";
import {
  buildHealthProfile,
  type HealthProfileResult,
  type HealthProfileSource,
} from "@/lib/health-systems";
import { getMarkerStatus } from "@/lib/health-profile-marker-status";
import type { ScoreExclusion } from "@/lib/health-systems";
import { createAdminClient } from "@/lib/supabase/admin";
import { HEALTH_PROFILE_FRESHNESS_POLICY } from "@/lib/health-profile-freshness";
import {
  projectHealthProfileLaboratoryAdmission,
  type HealthProfileLaboratoryAdmission,
} from "@/lib/health-profile-input";
import {
  projectHealthProfileReportedResults,
  type ReportedResultProjectionRow,
  type HealthProfileReportedResults,
} from "@/lib/health-profile-reported-results";
import { parseReferenceRange } from "@/lib/schemas/biomarkers";

type SnapshotLaboratorySource = {
  id?: string | null;
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
  raw_reference_text: string | null;
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
  source_extracted_biomarker_id?: string | null;
  source_extracted_biomarker?:
    | SnapshotLaboratorySource
    | SnapshotLaboratorySource[]
    | null;
  normalization_revision:
    | RegistryV2NormalizationRevisionReadBoundary
    | RegistryV2NormalizationRevisionReadBoundary[]
    | null;
};

type SnapshotExtractedRow = {
  id: string;
  document_id: string;
  profile_id: string;
  biomarker_key: string | null;
  biomarker_name: string;
  raw_name: string | null;
  value_numeric: number | string | null;
  value_text: string | null;
  value_kind: string | null;
  ordinal: number | null;
  unit: string | null;
  raw_unit: string | null;
  reference_range: string | null;
  raw_reference_range: string | null;
  section_context: string | null;
  confidence: number | null;
  specimen: string | null;
  modifier: string | null;
  method: string | null;
  source_page: number | null;
  source_text: string | null;
  bounding_box: unknown;
  raw_value_text: string | null;
  record_status: string | null;
  is_current: boolean | null;
  is_published: boolean | null;
  measurement_definition_key: string | null;
};

type SnapshotNormalizationRevisionRow =
  RegistryV2NormalizationRevisionReadBoundary & {
    id: string;
    extracted_biomarker_id: string;
  };
export type HealthProfileAssessment = Omit<
  HealthProfileResult,
  "holistic_synthesis"
>;

export type HealthProfileSnapshot = Readonly<{
  inputHash: string;
  profile: HealthProfileAssessment;
  sourceDocumentIds: string[];
  freshnessPolicyVersion: string;
  freshnessEvaluatedAt: string;
}>;

export { compareSnapshotRows, hashHealthProfileSnapshotInput };

/**
 * PostgREST sends `.in(...)` as a GET query string. A large UUID list
 * (many extracted lab rows) exceeds the request-line limit and comes back
 * as a bare 400 "Bad Request".
 */
const POSTGREST_IN_FILTER_CHUNK = 80;

async function selectByIdChunks<T>(
  ids: readonly string[],
  query: (
    chunk: string[],
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (
    let offset = 0;
    offset < ids.length;
    offset += POSTGREST_IN_FILTER_CHUNK
  ) {
    const chunk = ids.slice(offset, offset + POSTGREST_IN_FILTER_CHUNK);
    const { data, error } = await query(chunk);
    if (error) throw new Error(error.message);
    if (data?.length) rows.push(...data);
  }
  return rows;
}

/** Builds the same Registry-v2-gated score input for HTTP and queued work. */
export async function buildHealthProfileSnapshot(options: {
  profileId: string;
  labUnitSystem: "us" | "si";
}): Promise<HealthProfileSnapshot> {
  const supabase = createAdminClient();
  const [
    { data: observations, error: obsError },
    { data: documents, error: docError },
  ] = await Promise.all([
    supabase
      .from("observations")
      .select(
        `id, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, raw_reference_text, observed_at, document_id, observation_kind, value_kind, value_text, ordinal, specimen, modifier, source_page, source_text, bounding_box, source_extracted_biomarker_id, source_extracted_biomarker:document_extracted_biomarkers!observations_source_extracted_biomarker_fkey(id, record_status, is_current, is_published), normalization_revision:observation_normalization_revisions!observations_normalization_revision_same_source_fk(${REGISTRY_V2_NORMALIZATION_REVISION_SELECT})`,
      )
      .eq("profile_id", options.profileId)
      .eq("observation_kind", "lab"),
    supabase
      .from("documents")
      .select(
        "id, original_filename, observed_at, lab_name, document_type, processing_status, status",
      )
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
  const sourceIds = sources.map((source) => source.id);
  const sourceIdSet = new Set(sourceIds);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const observationByExtractedId = new Map(
    snapshotObservations
      .filter((observation) => observation.source_extracted_biomarker_id)
      .map((observation) => [
        observation.source_extracted_biomarker_id!,
        observation,
      ]),
  );

  let extractedRows: SnapshotExtractedRow[] = [];
  if (sourceIds.length > 0) {
    const extractedData = await selectByIdChunks<SnapshotExtractedRow>(
      sourceIds,
      async (documentIds) =>
        supabase
          .from("document_extracted_biomarkers")
          .select(
            "id, document_id, profile_id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, confidence, specimen, modifier, method, source_page, source_text, bounding_box, raw_value_text, record_status, is_current, is_published, measurement_definition_key",
          )
          .eq("profile_id", options.profileId)
          .in("document_id", documentIds)
          .eq("is_published", true),
    );
    extractedRows = extractedData
      .filter(
        (row) =>
          sourceIdSet.has(row.document_id) &&
          row.record_status !== "rejected" &&
          row.record_status !== "superseded" &&
          row.is_current !== false &&
          (row.value_numeric !== null ||
            (typeof row.value_text === "string" &&
              row.value_text.trim().length > 0) ||
            (typeof row.raw_value_text === "string" &&
              row.raw_value_text.trim().length > 0)),
      )
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  const extractedIds = extractedRows.map((row) => row.id);
  const revisionsByExtractedId = new Map<
    string,
    SnapshotNormalizationRevisionRow[]
  >();
  if (extractedIds.length > 0) {
    const revisionRows =
      await selectByIdChunks<SnapshotNormalizationRevisionRow>(
        extractedIds,
        async (ids) =>
          supabase
            .from("observation_normalization_revisions")
            .select(REGISTRY_V2_NORMALIZATION_REVISION_SELECT)
            .in("extracted_biomarker_id", ids)
            .eq("is_active", true),
      );
    for (const revision of revisionRows) {
      const revisions = revisionsByExtractedId.get(
        revision.extracted_biomarker_id,
      );
      if (revisions) {
        revisions.push(revision);
      } else {
        revisionsByExtractedId.set(revision.extracted_biomarker_id, [revision]);
      }
    }
  }
  const admissionsByObservationId = new Map<
    string,
    HealthProfileLaboratoryAdmission
  >();
  for (const observation of snapshotObservations) {
    if (!isLaboratoryObservation(observation)) continue;
    const relation = observation.source_extracted_biomarker_id
      ? (revisionsByExtractedId.get(
          observation.source_extracted_biomarker_id,
        ) ?? observation.normalization_revision)
      : observation.normalization_revision;
    admissionsByObservationId.set(
      observation.id,
      projectHealthProfileLaboratoryAdmission({
        observation,
        relation,
        labUnitSystem: options.labUnitSystem,
      }),
    );
  }

  const reportedRows: ReportedResultProjectionRow[] = extractedRows.map(
    (row) => {
      const linkedObservation = observationByExtractedId.get(row.id) ?? null;
      const relation =
        revisionsByExtractedId.get(row.id) ??
        linkedObservation?.normalization_revision ??
        null;
      const linkedAdmission = linkedObservation
        ? (admissionsByObservationId.get(linkedObservation.id) ?? null)
        : null;
      if (linkedObservation && !linkedAdmission) {
        throw new Error(
          `Missing laboratory admission for observation ${linkedObservation.id}`,
        );
      }
      const observation =
        linkedObservation ??
        ({
          id: row.id,
          analyte_key: row.biomarker_key,
          measurement_definition_key: row.measurement_definition_key,
          resolution_status: null,
          name: row.biomarker_name,
          value: row.value_numeric,
          unit: row.unit ?? row.raw_unit,
          ...parseReferenceRange(
            row.reference_range ?? row.raw_reference_range,
          ),
          raw_reference_text: row.raw_reference_range ?? row.reference_range,
          observed_at: sourceById.get(row.document_id)?.observed_at ?? "",
          document_id: row.document_id,
          observation_kind: "lab" as const,
          value_kind: row.value_kind,
          value_text: row.value_text,
          ordinal: row.ordinal,
          specimen: row.specimen,
          modifier: row.modifier,
          source_page: row.source_page,
          source_text: row.source_text,
          bounding_box: row.bounding_box,
          source_extracted_biomarker_id: row.id,
          source_extracted_biomarker: {
            id: row.id,
            record_status: row.record_status,
            is_current: row.is_current,
            is_published: row.is_published,
          },
          normalization_revision: relation,
        } satisfies SnapshotObservationRow);
      const outcome =
        linkedAdmission?.evidence.outcome ??
        projectLaboratoryOutcome({ observation, relation });
      const assessmentInput =
        linkedAdmission?.kind === "accepted" ? linkedAdmission.input : null;
      return {
        id: row.id,
        document_id: row.document_id,
        outcome,
        assessment_input: assessmentInput,
      };
    },
  );
  const reportedResults: HealthProfileReportedResults =
    projectHealthProfileReportedResults(reportedRows);

  const excludedObservations: ScoreExclusion[] = [];
  const inputs = snapshotObservations
    .filter(
      (observation) =>
        isLaboratoryObservation(observation) &&
        (observation.document_id == null ||
          sourceIdSet.has(observation.document_id)),
    )
    .sort(compareSnapshotRows)
    .flatMap((observation) => {
      const region = parseSourceRegion(observation.bounding_box);
      const sourceRegion = sourceRegionMatchesPage(
        region,
        observation.source_page,
      )
        ? region
        : null;
      const admission = admissionsByObservationId.get(observation.id);
      if (!admission) {
        throw new Error(
          `Missing laboratory admission for observation ${observation.id}`,
        );
      }
      const input = admission.kind === "accepted" ? admission.input : null;

      if (input) {
        return [
          {
            ...input,
            observation_id: observation.id,
            source_page: observation.source_page,
            source_text: observation.source_text,
            source_region: sourceRegion,
          },
        ];
      }

      const outcome = admission.evidence.outcome;
      const definitionKey =
        admission.evidence.binding.measurementDefinitionKey ??
        observation.measurement_definition_key;
      const reviewedBinding = definitionKey
        ? getReviewedAssessmentBinding(definitionKey)
        : null;
      const systemId: BodySystemId =
        reviewedBinding?.binding.system ??
        (definitionKey ? getRegistryV2System(definitionKey) : "general");
      const excludedAdmission =
        admission.kind === "excluded" ? admission : null;
      if (!excludedAdmission) {
        throw new Error(
          `Accepted admission did not produce an input for ${observation.id}`,
        );
      }
      const reason: ScoreExclusion["reason"] =
        excludedAdmission.reason === "no_active_revision" ||
        excludedAdmission.reason === "incomplete_resolution" ||
        excludedAdmission.reason === "candidate_only_identity" ||
        excludedAdmission.reason === "assessment_binding_ineligible"
          ? excludedAdmission.reason
          : "assessment_binding_ineligible";
      const value =
        observation.value == null ? null : Number(observation.value);
      const refLow =
        observation.ref_low == null ? null : Number(observation.ref_low);
      const refHigh =
        observation.ref_high == null ? null : Number(observation.ref_high);
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
        key:
          reviewedBinding?.binding.assessmentInputKey ??
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
        source: observation.document_id
          ? (sourceById.get(observation.document_id) ?? null)
          : null,
        source_page: observation.source_page,
        source_text: observation.source_text,
        source_region: sourceRegion,
        reason,
        reason_detail:
          outcome.resolutionDetails.incompleteReason ?? outcome.outcome,
        contribution_group: null,
      });
      return [];
    });
  const freshnessEvaluatedAt = new Date().toISOString();
  const freshnessAsOf = freshnessEvaluatedAt.slice(0, 10);
  const profile = buildHealthProfile(inputs, sources, {
    excludedObservations,
    reportedResults,
    freshnessAsOf,
    freshnessEvaluatedAt,
    freshnessPolicy: HEALTH_PROFILE_FRESHNESS_POLICY,
  });
  const inputHash = hashHealthProfileSnapshotInput({
    freshness_policy_version: HEALTH_PROFILE_FRESHNESS_POLICY.version,
    freshness_as_of: freshnessAsOf,
    inputs,
    sources,
    excludedObservations,
    reported_results: reportedResults,
    reported_result_rows: reportedRows.map((row) => ({
      id: row.id,
      document_id: row.document_id,
      outcome: row.outcome.outcome,
      assessment_exclusion:
        row.outcome.resolutionDetails.eligibility.exclusions.assessment,
      incomplete_reason: row.outcome.resolutionDetails.incompleteReason,
      ready_for_scoring: row.assessment_input !== null,
    })),
  });
  return {
    inputHash,
    profile,
    sourceDocumentIds: sources.map((source) => source.id),
    freshnessPolicyVersion: HEALTH_PROFILE_FRESHNESS_POLICY.version,
    freshnessEvaluatedAt,
  };
}
