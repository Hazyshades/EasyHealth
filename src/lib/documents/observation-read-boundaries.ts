type InstrumentalSourceRelation = { is_current?: boolean | null } | null;

export type DocumentObservationReadBoundary = {
  observation_kind?: string | null;
  source_instrumental_measure?:
    | InstrumentalSourceRelation
    | InstrumentalSourceRelation[];
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
