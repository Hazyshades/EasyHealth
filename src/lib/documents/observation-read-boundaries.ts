import { getMeasurementDefinition } from "@/lib/biomarkers";
import type { ResolvedReviewedMeasurementBinding } from "@/lib/biomarkers";
import type { MeasurementOverride } from "./observation-measurement-correction";

type InstrumentalSourceRelation = { is_current?: boolean | null } | null;
type LaboratorySourceRow = {
  record_status?: string | null;
  is_current?: boolean | null;
};
type LaboratorySourceRelation = LaboratorySourceRow | LaboratorySourceRow[] | null;

export type DocumentObservationReadBoundary = {
  observation_kind?: string | null;
  source_instrumental_measure?:
    | InstrumentalSourceRelation
    | InstrumentalSourceRelation[];
  source_extracted_biomarker?: LaboratorySourceRelation;
};

export type LaboratoryObservationReadBoundary =
  Pick<DocumentObservationReadBoundary, "observation_kind" | "source_extracted_biomarker"> & {
    measurement_definition_key?: string | null;
    resolution_status?: string | null;
  };

/**
 * Minimal active-revision shape shared by Registry 2.0 consumer read models.
 * Supabase may return a to-one relation as either an object or an array.
 */
export type RegistryV2NormalizationRevisionReadBoundary = {
  resolver_result?: string | null;
  verification_status?: string | null;
  measurement_definition_key?: string | null;
  mapping_confidence?: number | null;
  mapping_confidence_band?: string | null;
  catalog_manifest_version?: string | null;
  resolver_version?: string | null;
  normalization_version?: string | null;
  is_active?: boolean | null;
  resolver_evidence?: {
    version?: number;
    compatibilityPolicyVersion?: string;
    selectedCandidateKey?: string | null;
    outcome?: string | null;
    candidates?: readonly {
      accepted?: readonly { code?: string }[];
      missing?: readonly { code?: string }[];
      rejected?: readonly { code?: string }[];
      missingAxes?: readonly string[];
    }[];
  } | null;
  measurement_override?: MeasurementOverride | null;
};

export type RegistryV2LaboratoryBindingSource =
  LaboratoryObservationReadBoundary;

export function getActiveRegistryV2NormalizationRevision(
  relation:
    | RegistryV2NormalizationRevisionReadBoundary
    | readonly RegistryV2NormalizationRevisionReadBoundary[]
    | null
    | undefined
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
    | undefined
) {
  const activeRevision = getActiveRegistryV2NormalizationRevision(relation);
  const revisionDefinitionKey = activeRevision?.measurement_definition_key ?? null;
  const resolutionStatus = activeRevision?.resolver_result ?? null;
  const selectedCandidateKey =
    activeRevision?.resolver_evidence?.selectedCandidateKey ?? null;
  const measurementDefinition = revisionDefinitionKey
    ? getMeasurementDefinition(revisionDefinitionKey)
    : undefined;
  const laboratorySource = Array.isArray(observation.source_extracted_biomarker)
    ? observation.source_extracted_biomarker[0] ?? null
    : observation.source_extracted_biomarker ?? null;
  const sourceLifecycleActive =
    laboratorySource == null ||
    (laboratorySource.record_status !== "rejected" &&
      laboratorySource.record_status !== "superseded" &&
      laboratorySource.is_current !== false);
  const registryBindingReady =
    isLaboratoryObservation(observation) &&
    sourceLifecycleActive &&
    activeRevision?.is_active === true &&
    resolutionStatus === "resolved" &&
    activeRevision.resolver_evidence?.outcome === "resolved" &&
    revisionDefinitionKey !== null &&
    revisionDefinitionKey === selectedCandidateKey &&
    measurementDefinition?.maturity === "reviewed" &&
    measurementDefinition.sourceProvenance.kind === "registry_v2_review";
  const measurementDefinitionKey = registryBindingReady
    ? revisionDefinitionKey
    : null;
  const resolvedMeasurementBinding: ResolvedReviewedMeasurementBinding | null =
    registryBindingReady && measurementDefinition?.conversion
      ? {
          measurementDefinitionKey: revisionDefinitionKey,
          analyteKey: measurementDefinition.analyteKey,
          conversion: measurementDefinition.conversion,
        }
      : null;

  return {
    activeRevision,
    measurementDefinitionKey,
    measurementDefinition: registryBindingReady ? measurementDefinition : undefined,
    resolutionStatus,
    verificationStatus: activeRevision?.verification_status ?? null,
    recordStatus: laboratorySource?.record_status ?? "active",
    registryBindingReady,
    resolvedMeasurementBinding,
  };
}

export function isCurrentDocumentObservation(
  observation: DocumentObservationReadBoundary
): boolean {
  if (observation.observation_kind === "lab") {
    const source = Array.isArray(observation.source_extracted_biomarker)
      ? observation.source_extracted_biomarker[0] ?? null
      : observation.source_extracted_biomarker ?? null;
    return (
      source == null ||
      (source.record_status !== "rejected" &&
        source.record_status !== "superseded" &&
        source.is_current !== false)
    );
  }
  if (observation.observation_kind !== "instrumental") return true;
  const source = Array.isArray(observation.source_instrumental_measure)
    ? observation.source_instrumental_measure[0] ?? null
    : observation.source_instrumental_measure;
  return source?.is_current === true;
}

export function isLaboratoryObservation(
  observation: Pick<DocumentObservationReadBoundary, "observation_kind">
): boolean {
  return observation.observation_kind === "lab";
}
