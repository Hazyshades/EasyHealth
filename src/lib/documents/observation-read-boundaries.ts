import { getMeasurementDefinition } from "@/lib/biomarkers";

type InstrumentalSourceRelation = { is_current?: boolean | null } | null;

export type DocumentObservationReadBoundary = {
  observation_kind?: string | null;
  source_instrumental_measure?:
    | InstrumentalSourceRelation
    | InstrumentalSourceRelation[];
};

export type LaboratoryObservationReadBoundary =
  Pick<DocumentObservationReadBoundary, "observation_kind"> & {
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
  is_active?: boolean | null;
};

export type RegistryV2LaboratoryBindingSource =
  LaboratoryObservationReadBoundary;

export function getActiveRegistryV2NormalizationRevision(
  relation:
    | RegistryV2NormalizationRevisionReadBoundary
    | RegistryV2NormalizationRevisionReadBoundary[]
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
    | RegistryV2NormalizationRevisionReadBoundary[]
    | null
    | undefined
) {
  const activeRevision = getActiveRegistryV2NormalizationRevision(relation);
  const measurementDefinitionKey = activeRevision
    ? activeRevision.measurement_definition_key ?? null
    : observation.measurement_definition_key ?? null;
  const resolutionStatus = activeRevision
    ? activeRevision.resolver_result ?? null
    : observation.resolution_status ?? null;
  const measurementDefinition = measurementDefinitionKey
    ? getMeasurementDefinition(measurementDefinitionKey)
    : undefined;
  const registryBindingReady =
    isLaboratoryObservation(observation) &&
    activeRevision?.is_active === true &&
    resolutionStatus === "resolved" &&
    measurementDefinition?.maturity === "reviewed" &&
    measurementDefinition.sourceProvenance.kind === "registry_v2_review";

  return {
    activeRevision,
    measurementDefinitionKey,
    measurementDefinition,
    resolutionStatus,
    verificationStatus: activeRevision?.verification_status ?? null,
    registryBindingReady,
  };
}

export function isCurrentDocumentObservation(
  observation: DocumentObservationReadBoundary
): boolean {
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

/**
 * A concrete laboratory value has a resolved Registry 2.0 definition. Callers
 * still need to verify the definition's reviewed maturity before using it for
 * conversion, scoring, or other clinical semantics.
 */
export function hasResolvedLaboratoryDefinition(
  observation: LaboratoryObservationReadBoundary
): boolean {
  return (
    isLaboratoryObservation(observation) &&
    observation.resolution_status === "resolved" &&
    typeof observation.measurement_definition_key === "string" &&
    observation.measurement_definition_key.length > 0
  );
}
