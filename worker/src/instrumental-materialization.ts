import { createHash } from "node:crypto";
import type { InstrumentalMeasureMaterializationInput } from "../../src/lib/documents/instrumental-measure-lineage.js";

export function canonicalInstrumentalSnapshotHash(
  studyDate: string,
  modality: string | null,
  bodyRegion: string | null,
  measures: InstrumentalMeasureMaterializationInput[]
) {
  const canonicalMeasures = [...measures]
    .sort((left, right) =>
      left.source_locator.localeCompare(right.source_locator) ||
      left.occurrence_index - right.occurrence_index
    )
    .map((measure) => ({
      key_hint: measure.key_hint,
      name: measure.name,
      raw_name: measure.raw_name,
      value: measure.value,
      raw_value_text: measure.raw_value_text,
      unit: measure.unit,
      raw_unit: measure.raw_unit,
      source_page: measure.source_page,
      source_text: measure.source_text,
      source_locator: measure.source_locator,
      occurrence_index: measure.occurrence_index,
      bounding_box: measure.bounding_box,
      confidence: measure.confidence,
    }));
  return createHash("sha256")
    .update(
      JSON.stringify({
        schema: "eh105.instrumental-snapshot.v1",
        study_date: studyDate,
        modality,
        body_region: bodyRegion,
        measures: canonicalMeasures,
      })
    )
    .digest("hex");
}

export function validateInstrumentalMeasures(
  measures: InstrumentalMeasureMaterializationInput[]
): InstrumentalMeasureMaterializationInput[] {
  const occurrences = new Set<string>();
  for (const measure of measures) {
    if (!Number.isFinite(measure.value)) {
      throw new Error("Instrumental measure must contain a finite numeric value");
    }
    if (!measure.name.trim() || !measure.raw_name.trim() || !measure.raw_value_text.trim()) {
      throw new Error("Instrumental measure is missing required raw/display evidence");
    }
    if (!measure.source_locator.trim()) {
      throw new Error("Instrumental measure is missing a deterministic source locator");
    }
    if (!Number.isInteger(measure.occurrence_index) || measure.occurrence_index < 0) {
      throw new Error("Instrumental measure has an invalid occurrence discriminator");
    }
    const occurrenceKey = `${measure.source_locator}\u0000${measure.occurrence_index}`;
    if (occurrences.has(occurrenceKey)) {
      throw new Error("Instrumental extraction contains duplicate source locator occurrences");
    }
    occurrences.add(occurrenceKey);
  }
  return measures;
}
