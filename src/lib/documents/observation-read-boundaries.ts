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
