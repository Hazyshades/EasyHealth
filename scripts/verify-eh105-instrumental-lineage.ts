import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseInstrumentalExtraction } from "../src/lib/documents/instrumental-extraction";
import {
  isCurrentDocumentObservation,
  isLaboratoryObservation,
} from "../src/lib/documents/observation-read-boundaries";
import {
  instrumentalSnapshotDigest,
  normalizeInstrumentalSnapshot,
} from "../src/lib/documents/instrumental-publication";

const extraction = parseInstrumentalExtraction({
  facility_name: "Example clinic",
  study_date: "2026-07-19",
  modality: "ECG",
  body_region: "heart",
  impression: null,
  findings: [],
  numeric_measures: [
    {
      key: "ef",
      name: "Ejection fraction",
      raw_name: "EF",
      value: 55,
      raw_value_text: "55%",
      unit: "%",
      raw_unit: "%",
      source_page: 1,
      source_text: "EF 55%",
      source_locator: "page:1|table:measurements|row:1",
    },
    {
      key: "ef",
      name: "Ejection fraction",
      raw_name: "EF",
      value: 60,
      raw_value_text: "60%",
      unit: "%",
      raw_unit: "%",
      source_page: 1,
      source_text: "EF 60%",
      source_locator: "page:1|table:measurements|row:1",
    },
  ],
});

assert.equal(extraction.numeric_measures.length, 2);
assert.deepEqual(
  extraction.numeric_measures.map((measure) => measure.occurrence_index),
  [0, 1]
);
assert.deepEqual(
  extraction.numeric_measures.map((measure) => measure.key_hint),
  ["ef", "ef"]
);

const baseSnapshotInput = {
  study_date: "2026-07-19",
  modality: "ECG",
  body_region: "heart",
  facility_name: extraction.facility_name,
  impression: extraction.impression,
  processing_version: "test-v1",
  extraction_model: "test-model",
  findings: extraction.findings,
};

const firstSnapshot = normalizeInstrumentalSnapshot({
  ...baseSnapshotInput,
  measures: extraction.numeric_measures,
});
const firstHash = instrumentalSnapshotDigest(firstSnapshot);
const reorderedHash = instrumentalSnapshotDigest(
  normalizeInstrumentalSnapshot({
    ...baseSnapshotInput,
    measures: [...extraction.numeric_measures].reverse(),
  })
);
assert.equal(firstHash, reorderedHash, "snapshot fingerprint is order-independent");

const changedMeasures = extraction.numeric_measures.map((measure, index) =>
  index === 0 ? { ...measure, value: 56, raw_value_text: "56%" } : measure
);
assert.notEqual(
  firstHash,
  instrumentalSnapshotDigest(
    normalizeInstrumentalSnapshot({ ...baseSnapshotInput, measures: changedMeasures })
  ),
  "changed source evidence receives a new snapshot fingerprint"
);

assert.notEqual(
  firstHash,
  instrumentalSnapshotDigest(
    normalizeInstrumentalSnapshot({
      ...baseSnapshotInput,
      facility_name: "Another clinic",
      measures: extraction.numeric_measures,
    })
  ),
  "facility-only change produces a new content version hash"
);

assert.throws(
  () =>
    normalizeInstrumentalSnapshot({
      ...baseSnapshotInput,
      measures: [
        extraction.numeric_measures[0],
        {
          ...extraction.numeric_measures[1],
          occurrence_index: extraction.numeric_measures[0].occurrence_index,
        },
      ],
    }),
  /duplicate source locator occurrences/
);

assert.equal(isCurrentDocumentObservation({ observation_kind: "lab" }), true);
assert.equal(
  isCurrentDocumentObservation({
    observation_kind: "instrumental",
    source_instrumental_measure: { is_current: true },
  }),
  true
);
assert.equal(
  isCurrentDocumentObservation({
    observation_kind: "instrumental",
    source_instrumental_measure: { is_current: false },
  }),
  false
);
assert.equal(isLaboratoryObservation({ observation_kind: "lab" }), true);
assert.equal(isLaboratoryObservation({ observation_kind: "instrumental" }), false);

const healthProfileSnapshot = readFileSync("src/lib/health-profile-snapshot.ts", "utf8");
assert.match(healthProfileSnapshot, /\.eq\("observation_kind", "lab"\)/);
const observationsRoute = readFileSync(
  "src/app/api/documents/[id]/observations/route.ts",
  "utf8"
);
assert.match(observationsRoute, /source_instrumental_measure_id/);
assert.match(observationsRoute, /isCurrentDocumentObservation/);

console.log("verify-eh105-instrumental-lineage: all checks passed");
