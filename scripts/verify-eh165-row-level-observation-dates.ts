import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parsePipelineExtraction } from "../src/lib/documents/extraction";
import { observationDateFromExtractedRow } from "../src/lib/documents/observation-date";
import { applyMeasurementOverride } from "../src/lib/documents/observation-measurement-correction";

const TODAY = new Date().toISOString().slice(0, 10);
const DOCUMENT_DAY = "2026-01-08";

function uniquenessKey(options: {
  profileId: string;
  biomarkerKey: string;
  observedAt: string | null;
  specimen: string;
  modifier: string;
}): string {
  return [
    options.profileId,
    options.biomarkerKey,
    options.observedAt ?? "",
    options.specimen,
    options.modifier,
  ].join("|");
}

function glucoseRow(collectedAt: string | null, value: number) {
  return {
    raw_name: "Glucose",
    key: "glucose",
    name: "Glucose",
    value,
    unit: "mg/dL",
    collected_at: collectedAt,
    source_page: 1,
    source_text: "Glucose",
    confidence: 0.9,
  };
}

assert.equal(
  observationDateFromExtractedRow({ collected_at: "2023-01-10" }, DOCUMENT_DAY),
  "2023-01-10",
);
assert.equal(
  observationDateFromExtractedRow({ collected_at: null }, DOCUMENT_DAY),
  DOCUMENT_DAY,
);
assert.equal(observationDateFromExtractedRow({ collected_at: "2023" }, DOCUMENT_DAY), DOCUMENT_DAY);
assert.equal(observationDateFromExtractedRow({ collected_at: "2023-01" }, DOCUMENT_DAY), DOCUMENT_DAY);
assert.equal(observationDateFromExtractedRow({ collected_at: null }, "2023"), null);
assert.equal(observationDateFromExtractedRow({ collected_at: null }, null), null);
assert.notEqual(observationDateFromExtractedRow({ collected_at: null }, null), TODAY);

const overridden = applyMeasurementOverride(
  {
    value: 95,
    valueText: "95",
    valueKind: "numeric",
    ordinal: null,
    unit: "mg/dL",
    refLow: null,
    refHigh: null,
    observedAt: observationDateFromExtractedRow({ collected_at: "2023-01-10" }, DOCUMENT_DAY),
  },
  { observed_at: "2024-06-01" },
);
assert.equal(overridden.observedAt, "2024-06-01");

const oneByThree = parsePipelineExtraction({
  observed_at: DOCUMENT_DAY,
  biomarkers: [
    glucoseRow("2023-01-10", 91),
    glucoseRow("2024-01-09", 94),
    glucoseRow("2026-01-08", 99),
  ],
});
assert.deepEqual(
  oneByThree.biomarkers.map((row) => row.collected_at),
  ["2023-01-10", "2024-01-09", "2026-01-08"],
);
assert.deepEqual(
  oneByThree.biomarkers.map((row) => observationDateFromExtractedRow(row, DOCUMENT_DAY)),
  ["2023-01-10", "2024-01-09", "2026-01-08"],
);

const analytes = ["Glucose", "HbA1c", "LDL cholesterol"] as const;
const dates = ["2023-01-10", "2024-01-09", "2026-01-08"] as const;
const threeByThree = parsePipelineExtraction({
  observed_at: DOCUMENT_DAY,
  biomarkers: analytes.flatMap((name) =>
    dates.map((collectedAt, index) => ({
      raw_name: name,
      key: name.toLowerCase().replace(/\s+/g, "_"),
      name,
      value: 10 + index,
      unit: "mg/dL",
      collected_at: collectedAt,
      source_page: 1,
      source_text: name,
      confidence: 0.9,
    })),
  ),
});
assert.equal(threeByThree.biomarkers.length, 9);
assert.deepEqual(
  threeByThree.biomarkers.map((row) => [row.raw_name, row.collected_at]),
  analytes.flatMap((name) => dates.map((collectedAt) => [name, collectedAt])),
);

const headerOnly = parsePipelineExtraction({
  observed_at: DOCUMENT_DAY,
  biomarkers: dates.map((collectedAt, index) => ({
    raw_name: "Glucose",
    key: "glucose",
    name: "Glucose",
    value: 90 + index,
    unit: "mg/dL",
    collected_at: collectedAt,
    source_page: 1,
    source_text: `Glucose ${collectedAt}`,
    confidence: 0.9,
  })),
});
assert.deepEqual(
  headerOnly.biomarkers.map((row) => row.collected_at),
  [...dates],
);

const undatedColumn = parsePipelineExtraction({
  observed_at: DOCUMENT_DAY,
  biomarkers: [
    glucoseRow("2023-01-10", 91),
    { ...glucoseRow(null, 88), collected_at: undefined },
  ],
});
assert.equal(undatedColumn.biomarkers[0]?.collected_at, "2023-01-10");
assert.equal(undatedColumn.biomarkers[1]?.collected_at, null);
assert.equal(
  observationDateFromExtractedRow(undatedColumn.biomarkers[1]!, DOCUMENT_DAY),
  DOCUMENT_DAY,
);

const sameDay = parsePipelineExtraction({
  biomarkers: [glucoseRow("2026-01-08", 99), glucoseRow("2026-01-08", 101)],
});
const keys = sameDay.biomarkers.map((row) =>
  uniquenessKey({
    profileId: "profile",
    biomarkerKey: "glucose",
    observedAt: observationDateFromExtractedRow(row, DOCUMENT_DAY),
    specimen: "unspecified",
    modifier: "none",
  }),
);
assert.equal(keys[0], keys[1]);
assert.notEqual(
  uniquenessKey({
    profileId: "profile",
    biomarkerKey: "glucose",
    observedAt: "2023-01-10",
    specimen: "unspecified",
    modifier: "none",
  }),
  uniquenessKey({
    profileId: "profile",
    biomarkerKey: "glucose",
    observedAt: "2026-01-08",
    specimen: "unspecified",
    modifier: "none",
  }),
);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const writer = readFileSync(join(root, "src/lib/documents/observation-normalization-writer.ts"), "utf8");
assert.match(writer, /observationDateFromExtractedRow\(options\.row, options\.observedAt\)/);
assert.equal(
  writer.split("observationDateFromExtractedRow(options.row, options.observedAt)").length - 1,
  2,
);

const prompt = readFileSync(join(root, "src/lib/documents/extraction.ts"), "utf8");
assert.match(prompt, /one candidate per printed value per date/);
assert.match(prompt, /leave collected_at null/);

for (const [relative, needle] of [
  ["src/lib/documents/biomarker-acceptance.ts", "processing_version, collected_at"],
  ["src/app/api/documents/[id]/biomarkers/confirm-observations/route.ts", "processing_version, collected_at"],
  ["src/app/api/documents/[id]/biomarkers/route.ts", "processing_version, collected_at"],
  ["src/lib/documents/batch-verification-service.ts", "processing_version, collected_at"],
  ["src/lib/registry-reprocessing/service.ts", "processing_version, collected_at"],
  ["src/lib/registry-reprocessing/selection.ts", "processing_version, collected_at"],
  ["src/app/api/documents/[id]/route.ts", "created_at, collected_at"],
] as const) {
  const source = readFileSync(join(root, relative), "utf8");
  assert.ok(source.includes(needle), `${relative} must SELECT collected_at`);
}

const biomarkersRoute = readFileSync(join(root, "src/app/api/documents/[id]/biomarkers/route.ts"), "utf8");
assert.equal(biomarkersRoute.split("collected_at, collected_at").length - 1, 0);
assert.match(biomarkersRoute, /created_at, collected_at/);

const viewer = readFileSync(join(root, "src/components/documents/document-viewer.tsx"), "utf8");
assert.match(viewer, /observationDateFromExtractedRow\(item, doc\.observed_at\)/);

console.log("verify-eh165-row-level-observation-dates: all checks passed");
