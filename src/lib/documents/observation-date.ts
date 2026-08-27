import { calendarDateProjection } from "./medical-events";

export type ExtractedObservationDateRow = {
  collected_at?: string | null;
};

/**
 * EH-165: observation uniqueness is day-precision. A history-table cell keeps
 * its own collected day; missing or partial row dates fall back to the
 * document day; nothing invents today.
 */
export function observationDateFromExtractedRow(
  row: ExtractedObservationDateRow,
  documentObservedAt: string | null | undefined,
): string | null {
  return (
    calendarDateProjection(row.collected_at) ??
    calendarDateProjection(documentObservedAt) ??
    null
  );
}
