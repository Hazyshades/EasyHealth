import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseInstrumentalExtraction } from "../src/lib/documents/instrumental-extraction";
import {
  isCurrentDocumentObservation,
  isLaboratoryObservation,
} from "../src/lib/documents/observation-read-boundaries";
import {
  canonicalInstrumentalSnapshotHash,
  validateInstrumentalMeasures,
} from "../worker/src/instrumental-materialization";

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

const validMeasures = validateInstrumentalMeasures(extraction.numeric_measures);
const firstHash = canonicalInstrumentalSnapshotHash(
  "2026-07-19",
  "ECG",
  "heart",
  validMeasures
);
const reorderedHash = canonicalInstrumentalSnapshotHash(
  "2026-07-19",
  "ECG",
  "heart",
  [...validMeasures].reverse()
);
assert.equal(firstHash, reorderedHash, "snapshot fingerprint is order-independent");

const changedMeasures = validMeasures.map((measure, index) =>
  index === 0 ? { ...measure, value: 56, raw_value_text: "56%" } : measure
);
assert.notEqual(
  firstHash,
  canonicalInstrumentalSnapshotHash("2026-07-19", "ECG", "heart", changedMeasures),
  "changed source evidence receives a new snapshot fingerprint"
);

assert.throws(
  () =>
    validateInstrumentalMeasures([
      validMeasures[0],
      { ...validMeasures[1], occurrence_index: validMeasures[0].occurrence_index },
    ]),
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

const healthProfileRoute = readFileSync("src/app/api/health-profile/route.ts", "utf8");
assert.match(healthProfileRoute, /\.eq\("observation_kind", "lab"\)/);
const observationsRoute = readFileSync(
  "src/app/api/documents/[id]/observations/route.ts",
  "utf8"
);
assert.match(observationsRoute, /source_instrumental_measure_id/);
assert.match(observationsRoute, /isCurrentDocumentObservation/);

console.log("verify-eh105-instrumental-lineage: all checks passed");
