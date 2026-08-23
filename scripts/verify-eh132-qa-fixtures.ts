import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "QA/eh-132/fixtures";
const manifestPath = join(root, "manifest.json");
const performancePath = join(root, "EH132-PERF-01.json");

assert.ok(existsSync(manifestPath), "EH132 fixture manifest is missing");
assert.ok(existsSync(performancePath), "EH132 performance fixture is missing");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  fixturePack: string;
  syntheticOnly: boolean;
  disclaimer: string;
  timeline: {
    requiredTypes: string[];
    explicitDateFixtures: Array<{ filename: string; documentType: string; id: string }>;
    unknownDateFixture: string;
  };
  comparison: {
    compatibleSources: string[];
    controls: string;
    concreteDefinition: string;
  };
  performance: { file: string; eventCount: number; pageSize: number; targetBudgetMs: number };
};

assert.equal(manifest.fixturePack, "EH132");
assert.equal(manifest.syntheticOnly, true);
assert.match(manifest.disclaimer, /fictional de-identified/i);
assert.deepEqual(manifest.timeline.requiredTypes, [
  "lab_result",
  "instrumental_report",
  "consultation_note",
  "discharge_summary",
  "prescription",
  "referral",
]);
assert.equal(manifest.timeline.explicitDateFixtures.length, 6);
assert.equal(manifest.timeline.unknownDateFixture, "EH132-TIMELINE-02-UNKNOWN-DATE.pdf");
assert.deepEqual(
  manifest.timeline.explicitDateFixtures.map((fixture) => fixture.documentType),
  manifest.timeline.requiredTypes,
);

const pdfFiles = [
  ...manifest.timeline.explicitDateFixtures.map((fixture) => fixture.filename),
  manifest.timeline.unknownDateFixture,
  ...manifest.comparison.compatibleSources,
  manifest.comparison.controls,
];
for (const filename of pdfFiles) {
  const path = join(root, filename);
  assert.ok(existsSync(path), `fixture file is missing: ${filename}`);
  const pdf = readFileSync(path, "ascii");
  assert.match(pdf, /^%PDF-1\.4\n/, `${filename} is not a PDF 1.4 fixture`);
  assert.match(pdf, /%%EOF\s*$/, `${filename} has no PDF EOF marker`);
  assert.ok(statSync(path).size > 500, `${filename} is unexpectedly small`);
}

const unknownPdf = readFileSync(join(root, manifest.timeline.unknownDateFixture), "ascii");
assert.match(unknownPdf, /No medical date is stated/);
assert.doesNotMatch(unknownPdf, /\b20\d{2}-\d{2}-\d{2}\b/, "unknown-date fixture contains a medical date");

const compatibleA = readFileSync(join(root, manifest.comparison.compatibleSources[0]), "ascii");
const compatibleB = readFileSync(join(root, manifest.comparison.compatibleSources[1]), "ascii");
assert.match(compatibleA, /Hemoglobin .*150.*g\/L/);
assert.match(compatibleB, /Hemoglobin .*14\.2.*g\/dL/);
assert.match(compatibleA, /Synthetic Lab A/);
assert.match(compatibleB, /Synthetic Lab B/);
assert.match(compatibleA, /RDW-CV/);
assert.match(compatibleA, /RDW-SD/);

const controls = readFileSync(join(root, manifest.comparison.controls), "ascii");
for (const marker of ["RDW-CV", "RDW-SD", "serum", "plasma", "urine", "unresolved", "ineligible"]) {
  assert.match(controls, new RegExp(marker, "i"), `comparison control is missing: ${marker}`);
}

const performance = JSON.parse(readFileSync(performancePath, "utf8")) as {
  fixtureId: string;
  eventCount: number;
  pageSize: number;
  expectedPages: number;
  targetBudgetMs: number;
  events: Array<{
    id: string;
    profileId: string;
    documentType: string;
    eventDate: string;
    createdAt: string;
  }>;
};
assert.equal(performance.fixtureId, "EH132-PERF-01");
assert.equal(performance.eventCount, 2_000);
assert.equal(performance.events.length, 2_000);
assert.equal(performance.pageSize, 25);
assert.equal(performance.expectedPages, 80);
assert.equal(performance.targetBudgetMs, 2_000);
assert.ok(performance.events.every((event) => event.profileId === "<dedicated-synthetic-profile-id>"));
assert.equal(new Set(performance.events.map((event) => event.id)).size, 2_000);
assert.deepEqual(
  [...new Set(performance.events.map((event) => event.documentType))].sort(),
  ["consultation_note", "discharge_summary", "instrumental_report", "lab_result", "prescription", "referral"].sort(),
);
assert.ok(performance.events.every((event) => /^\d{4}-\d{2}-\d{2}$/.test(event.eventDate)));
assert.ok(performance.events.every((event) => event.createdAt.endsWith(".000Z")));

console.log(
  `eh132-fixtures: ${pdfFiles.length} PDFs, timelineTypes=${manifest.timeline.requiredTypes.length}, comparisonSources=${manifest.comparison.compatibleSources.length}, performanceEvents=${performance.events.length}`,
);
