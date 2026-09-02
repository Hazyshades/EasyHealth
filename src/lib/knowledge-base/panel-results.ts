import type { MeasurementDefinitionKey } from "@/lib/biomarkers";

export type PanelArticleObservationDocument = Readonly<{
  id: string;
  original_filename: string;
  lab_name?: string | null;
}>;

export type PanelArticleObservation = Readonly<{
  id: string;
  measurement_definition_key: MeasurementDefinitionKey | null;
  name: string;
  value: number | string | null;
  value_text?: string | null;
  unit: string | null;
  observed_at: string | null;
  ordinal?: number | null;
  document_id: string | null;
  source_page?: number | null;
  documents?: PanelArticleObservationDocument | null;
}>;

function compareNullableTextDesc(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  if (left === right) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left > right ? -1 : 1;
}

function compareNullableNumberAsc(
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  if (left === right) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}

/**
 * Select only exact Registry 2.0 member keys for a panel article.
 * The source array is never mutated and duplicate observations are preserved.
 */
export function selectPanelArticleResults(
  observations: readonly PanelArticleObservation[],
  memberKeys: readonly MeasurementDefinitionKey[],
): readonly PanelArticleObservation[] {
  const memberKeySet = new Set(memberKeys);
  return [...observations]
    .filter(
      (observation) =>
        observation.measurement_definition_key !== null &&
        memberKeySet.has(observation.measurement_definition_key),
    )
    .sort((left, right) => {
      const dateOrder = compareNullableTextDesc(
        left.observed_at,
        right.observed_at,
      );
      if (dateOrder !== 0) return dateOrder;
      const ordinalOrder = compareNullableNumberAsc(
        left.ordinal,
        right.ordinal,
      );
      if (ordinalOrder !== 0) return ordinalOrder;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
}
