import type { MeasurementOverride } from "./observation-measurement-correction";
import { readPersistedDecision } from "./persisted-decision-read";
import type { PersistedDecisionReadOptions } from "./persisted-decision-read";

type InstrumentalSourceRelation = { is_current?: boolean | null } | null;
type LaboratorySourceRow = {
  id?: string | null;
  record_status?: string | null;
  is_current?: boolean | null;
  is_published?: boolean | null;
};
type LaboratorySourceRelation =
  | LaboratorySourceRow
  | LaboratorySourceRow[]
  | null;

export type DocumentObservationReadBoundary = {
  id?: string | null;
  observation_kind?: string | null;
  source_extracted_biomarker_id?: string | null;
  source_instrumental_measure?:
    | InstrumentalSourceRelation
    | InstrumentalSourceRelation[];
  source_extracted_biomarker?: LaboratorySourceRelation;
};

export type LaboratoryObservationReadBoundary = Pick<
  DocumentObservationReadBoundary,
  | "id"
  | "observation_kind"
  | "source_extracted_biomarker_id"
  | "source_extracted_biomarker"
> & {
  measurement_definition_key?: string | null;
  resolution_status?: string | null;
};

/**
 * Minimal active-revision shape shared by Registry 2.0 consumer read models.
 * Supabase may return a to-one relation as either an object or an array.
 */
export type RegistryV2ResolverEvidenceCandidate = {
  candidateKey?: string;
  accepted?: readonly { code?: string }[];
  missing?: readonly { code?: string }[];
  rejected?: readonly { code?: string }[];
  missingAxes?: readonly string[];
  score?: number | null;
  selectable?: boolean;
  eligible?: boolean;
  admissibilityRejections?: readonly string[];
};

export type RegistryV2ResolverEvidence = {
  version?: number;
  compatibilityPolicyVersion?: string;
  selectedCandidateKey?: string | null;
  runnerUpCandidateKey?: string | null;
  outcome?: string | null;
  confidence?: number;
  candidates?: readonly RegistryV2ResolverEvidenceCandidate[];
};

export type RegistryV2NormalizationRevisionReadBoundary = {
  id?: string | null;
  extracted_biomarker_id?: string | null;
  observation_id?: string | null;
  resolver_result?: string | null;
  verification_status?: string | null;
  measurement_definition_key?: string | null;
  analyte_key?: string | null;
  mapping_confidence?: number | null;
  mapping_confidence_band?: string | null;
  catalog_manifest_version?: string | null;
  catalog_manifest_digest?: string | null;
  resolver_version?: string | null;
  normalization_version?: string | null;
  is_active?: boolean | null;
  input_evidence_hash?: string | null;
  input_identity_format_version?: string | null;
  resolver_evidence?: RegistryV2ResolverEvidence | null;
  resolver_decision_trace?: unknown | null;
  resolver_trace_schema_version?: string | null;
  measurement_override?: MeasurementOverride | null;
  created_at?: string | null;
};

export const REGISTRY_V2_NORMALIZATION_REVISION_SELECT =
  "id, extracted_biomarker_id, observation_id, resolver_result, verification_status, measurement_definition_key, analyte_key, mapping_confidence, mapping_confidence_band, catalog_manifest_version, catalog_manifest_digest, resolver_version, normalization_version, is_active, input_evidence_hash, input_identity_format_version, resolver_evidence, resolver_decision_trace, resolver_trace_schema_version, measurement_override, created_at";

export type RegistryV2LaboratoryBindingSource =
  LaboratoryObservationReadBoundary;

export function getActiveRegistryV2NormalizationRevision(
  relation:
    | RegistryV2NormalizationRevisionReadBoundary
    | readonly RegistryV2NormalizationRevisionReadBoundary[]
    | null
    | undefined,
): RegistryV2NormalizationRevisionReadBoundary | null {
  const revisions = Array.isArray(relation)
    ? relation
    : relation
      ? [relation]
      : [];
  return revisions.find((revision) => revision.is_active === true) ?? null;
}

/**
 * Resolve the only consumer-safe Registry 2.0 laboratory binding. The active
 * revision is authoritative when present; an observation projection can still
 * be returned as raw evidence when no active revision exists, but never becomes
 * concrete or score/conversion eligible.
 */
export function projectActiveRegistryV2LaboratoryBinding(
  observation: RegistryV2LaboratoryBindingSource,
  relation:
    | RegistryV2NormalizationRevisionReadBoundary
    | readonly RegistryV2NormalizationRevisionReadBoundary[]
    | null
    | undefined,
) {
  const decision: PersistedDecisionReadOptions = { observation, relation };
  const read = readPersistedDecision(decision);
  const laboratorySource = Array.isArray(observation.source_extracted_biomarker)
    ? (observation.source_extracted_biomarker[0] ?? null)
    : observation.source_extracted_biomarker;
  return {
    activeRevision: read.activeRevision,
    decisionSource: read.source,
    decisionQuality: read.quality,
    decisionNotPersisted: read.notPersisted,
    decisionQualityCodes: read.qualityCodes,
    conflictDetails: read.conflicts,
    release: read.release,
    technicalTrace: read.technicalTrace,
    measurementDefinitionKey: read.currentBindingReady
      ? read.stored.measurementDefinitionKey
      : null,
    measurementDefinition: read.currentBindingReady
      ? (read.measurementDefinition ?? undefined)
      : undefined,
    resolutionStatus: read.stored.outcome,
    verificationStatus: read.stored.verificationStatus,
    recordStatus: laboratorySource?.record_status ?? "active",
    registryBindingReady: read.currentBindingReady,
    resolvedMeasurementBinding: read.resolvedMeasurementBinding,
  };
}

export function isCurrentDocumentObservation(
  observation: DocumentObservationReadBoundary,
): boolean {
  if (observation.observation_kind === "lab") {
    const source = Array.isArray(observation.source_extracted_biomarker)
      ? (observation.source_extracted_biomarker[0] ?? null)
      : observation.source_extracted_biomarker;
    return (
      source == null ||
      (source.record_status !== "rejected" &&
        source.record_status !== "superseded" &&
        source.is_current !== false &&
        source.is_published !== false)
    );
  }
  if (observation.observation_kind !== "instrumental") return true;
  const source = Array.isArray(observation.source_instrumental_measure)
    ? (observation.source_instrumental_measure[0] ?? null)
    : observation.source_instrumental_measure;
  return source?.is_current === true;
}

export function isLaboratoryObservation(
  observation: Pick<DocumentObservationReadBoundary, "observation_kind">,
): boolean {
  return observation.observation_kind === "lab";
}
