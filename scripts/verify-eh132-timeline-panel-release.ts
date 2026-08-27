import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import {
  MEASUREMENT_DEFINITIONS,
  PANEL_DEFINITIONS,
  REQUIRED_PANEL_KEYS,
  evaluateSpecimenCompatibility,
  evaluateUnitCompatibility,
  getMeasurementConversionPolicy,
  getMeasurementDefinition,
  getRegistryV2ScoreContributionGroups,
  getRegistryV2ScoreReadinessGroups,
  getRegistryV2ScoreRole,
  getPanelDefinition,
  listPanelsForMeasurementDefinition,
  normalizeMeasurementUnit,
  presentObservation,
  resolveMeasurementDefinition,
  validatePanelRegistry,
  type PanelDefinition,
} from "../src/lib/biomarkers";
import { digestMeasurementRegistryManifest } from "../src/lib/biomarkers/measurement-registry-release";
import {
  calendarDateProjection,
  parseMedicalEventDate,
  sortTimelineEvents as sortMedicalTimelineEvents,
  type TimelineComparableEvent,
} from "../src/lib/documents/medical-events";
import {
  buildTimelineEvents,
  collectTimelinePages,
  TIMELINE_MAX_MEASUREMENTS_PER_EVENT,
  type TimelineDocumentRow,
  type TimelineObservationRow,
} from "../src/lib/timeline";

export const EH132_PERFORMANCE_EVENT_COUNT = 2_000;
export const EH132_PERFORMANCE_BUDGET_MS = 2_000;

const fixtureCounts = {
  dates: 0,
  timelineEvents: 0,
  comparisonRows: 0,
  panels: 0,
  performancePageRequests: 0,
  performanceEvents: EH132_PERFORMANCE_EVENT_COUNT,
};

function comparableEvent(
  eventId: string,
  occurredPrecision: TimelineComparableEvent["occurredPrecision"],
  occurredValue: string | null,
  occurredSortStartOn: string | null,
  occurredSortEndOn: string | null,
  occurredSortAt: string | null = null,
  eventType = "lab_result",
): TimelineComparableEvent {
  return {
    eventId,
    eventType,
    sourceDocumentId: eventId,
    occurredPrecision,
    occurredValue,
    occurredSortAt,
    occurredSortStartOn,
    occurredSortEndOn,
  };
}

function timelineDocument(
  id: string,
  documentType: string,
  overrides: Partial<TimelineDocumentRow> = {},
): TimelineDocumentRow {
  return {
    id,
    original_filename: `${documentType}-${id}.pdf`,
    document_type: documentType,
    lab_name: null,
    observed_at: "2025-01-01",
    created_at: "2025-01-02T00:00:00.000Z",
    status: "completed",
    processing_status: "ready",
    error_message: null,
    processing_error: null,
    document_summary: null,
    modality: null,
    ...overrides,
  };
}

function laboratoryObservation(
  documentId: string,
  id: string,
  overrides: Partial<TimelineObservationRow> = {},
): TimelineObservationRow {
  return {
    id,
    document_id: documentId,
    observation_kind: "lab",
    name: "Glucose",
    value: 100,
    value_text: null,
    value_kind: "numeric",
    unit: "mg/dL",
    observed_at: "2025-01-01",
    source_extracted_biomarker: { record_status: "active", is_current: true },
    ...overrides,
  };
}

function assertDateContracts(): void {
  const year = parseMedicalEventDate("2026");
  const month = parseMedicalEventDate("2026-08");
  const day = parseMedicalEventDate("2026-08-24");
  const instant = parseMedicalEventDate("2026-08-24T23:30:00-04:00");

  assert.deepEqual(year, {
    precision: "year",
    value: "2026",
    timezone: null,
    sortStartOn: "2026-01-01",
    sortEndOn: "2026-12-31",
    sortAt: null,
  });
  assert.equal(month?.precision, "month");
  assert.equal(month?.value, "2026-08");
  assert.equal(month?.sortStartOn, "2026-08-01");
  assert.equal(month?.sortEndOn, "2026-08-31");
  assert.equal(day?.precision, "day");
  assert.equal(day?.value, "2026-08-24");
  assert.equal(day?.timezone, null);
  assert.equal(instant?.precision, "instant");
  assert.equal(instant?.timezone, "-04:00");
  assert.equal(instant?.sortAt, "2026-08-25T03:30:00.000Z");
  assert.equal(calendarDateProjection("2026"), null);
  assert.equal(calendarDateProjection("2026-08"), null);
  assert.equal(calendarDateProjection("2026-08-24"), "2026-08-24");
  assert.equal(parseMedicalEventDate("2026-08-24T23:30:00"), null);
  assert.equal(parseMedicalEventDate("2026-02-29"), null);
  assert.equal(parseMedicalEventDate("2025-02-29"), null);
  assert.equal(parseMedicalEventDate("2026-13"), null);

  fixtureCounts.dates = 8;
}

function assertMedicalEventOrdering(): void {
  const events = [
    comparableEvent("unknown", "unknown", null, null, null),
    comparableEvent("instant", "instant", "2025-02-11T00:00:00Z", "2025-02-11", "2025-02-11", "2025-02-11T00:00:00.000Z"),
    comparableEvent("day", "day", "2025-02-10", "2025-02-10", "2025-02-10"),
    comparableEvent("month", "month", "2025-02", "2025-02-01", "2025-02-28"),
    comparableEvent("year", "year", "2024", "2024-01-01", "2024-12-31"),
  ];

  assert.deepEqual(
    sortMedicalTimelineEvents(events, "asc").map((event) => event.eventId),
    ["year", "month", "day", "instant", "unknown"],
  );
  assert.deepEqual(
    sortMedicalTimelineEvents(events, "desc").map((event) => event.eventId),
    ["instant", "day", "month", "year", "unknown"],
  );

  const unknownTie = [
    comparableEvent("z", "unknown", null, null, null, null, "referral"),
    comparableEvent("a", "unknown", null, null, null, null, "referral"),
  ];
  const firstOrder = sortMedicalTimelineEvents(unknownTie, "asc").map((event) => event.eventId);
  const secondOrder = sortMedicalTimelineEvents(unknownTie, "asc").map((event) => event.eventId);
  assert.deepEqual(firstOrder, ["a", "z"]);
  assert.deepEqual(secondOrder, firstOrder);
}

function assertTimelineProjection(): void {
  const unknown = timelineDocument("timeline-unknown", "referral", {
    observed_at: null,
    created_at: "2099-01-01T00:00:00.000Z",
  });
  const known = timelineDocument("timeline-known", "lab_result", {
    observed_at: "2025-02-01",
    created_at: "2025-02-02T00:00:00.000Z",
    lab_name: "Synthetic Diagnostics",
  });
  const observations = Array.from({ length: TIMELINE_MAX_MEASUREMENTS_PER_EVENT + 1 }, (_, index) =>
    laboratoryObservation(known.id, `measurement-${index}`, { name: `Marker ${index}` }),
  );
  observations.push(
    laboratoryObservation(known.id, "superseded", {
      name: "Retired marker",
      source_extracted_biomarker: { record_status: "superseded", is_current: false },
    }),
  );

  const events = buildTimelineEvents({ documents: [unknown, known], observations });
  fixtureCounts.timelineEvents = events.length;
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.documentId), [known.id, unknown.id]);

  const unknownEvent = events.find((event) => event.documentId === unknown.id);
  assert.ok(unknownEvent);
  assert.equal(unknownEvent.eventDate, null);
  assert.equal(unknownEvent.datePrecision, "unknown");
  assert.equal(unknownEvent.source.href, `/app/documents/${unknown.id}`);

  const knownEvent = events.find((event) => event.documentId === known.id);
  assert.ok(knownEvent);
  assert.equal(knownEvent.measurementCount, TIMELINE_MAX_MEASUREMENTS_PER_EVENT + 1);
  assert.equal(knownEvent.measurements.length, TIMELINE_MAX_MEASUREMENTS_PER_EVENT);
  assert.equal(knownEvent.measurements.some((measurement) => measurement.name === "Retired marker"), false);
}

type ComparisonFixture = {
  id: string;
  measurement_definition_key: string | null;
  trend_eligible: boolean;
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  laboratory: string;
  document_id: string;
};

function assertComparisonCompatibility(): void {
  const rows: ComparisonFixture[] = [
    {
      id: "glucose-lab-a",
      measurement_definition_key: "glucose_serum",
      trend_eligible: true,
      value: 100,
      unit: "mg/dL",
      ref_low: 70,
      ref_high: 99,
      laboratory: "Synthetic Lab A",
      document_id: "doc-a",
    },
    {
      id: "glucose-lab-b",
      measurement_definition_key: "glucose_serum",
      trend_eligible: true,
      value: 5.55,
      unit: "mmol/L",
      ref_low: 3.9,
      ref_high: 5.5,
      laboratory: "Synthetic Lab B",
      document_id: "doc-b",
    },
    {
      id: "rdw-cv",
      measurement_definition_key: "rdw_cv",
      trend_eligible: true,
      value: 13,
      unit: "%",
      ref_low: 11,
      ref_high: 15,
      laboratory: "Synthetic Lab A",
      document_id: "doc-a",
    },
    {
      id: "rdw-sd",
      measurement_definition_key: "rdw_sd",
      trend_eligible: true,
      value: 42,
      unit: "fL",
      ref_low: 37,
      ref_high: 54,
      laboratory: "Synthetic Lab A",
      document_id: "doc-a",
    },
    {
      id: "glucose-plasma",
      measurement_definition_key: "glucose_plasma",
      trend_eligible: true,
      value: 5.5,
      unit: "mmol/L",
      ref_low: 3.9,
      ref_high: 5.5,
      laboratory: "Synthetic Lab C",
      document_id: "doc-c",
    },
    {
      id: "unresolved-glucose",
      measurement_definition_key: null,
      trend_eligible: false,
      value: 100,
      unit: "mg/dL",
      ref_low: null,
      ref_high: null,
      laboratory: "Synthetic Lab D",
      document_id: "doc-d",
    },
    {
      id: "ineligible-glucose",
      measurement_definition_key: "glucose_serum",
      trend_eligible: false,
      value: 100,
      unit: "%",
      ref_low: null,
      ref_high: null,
      laboratory: "Synthetic Lab D",
      document_id: "doc-d",
    },
  ];
  fixtureCounts.comparisonRows = rows.length;

  const series = new Map<string, ComparisonFixture[]>();
  for (const row of rows) {
    if (!row.trend_eligible || !row.measurement_definition_key) continue;
    const points = series.get(row.measurement_definition_key) ?? [];
    points.push(row);
    series.set(row.measurement_definition_key, points);
  }

  assert.deepEqual([...series.keys()], ["glucose_serum", "rdw_cv", "rdw_sd", "glucose_plasma"]);
  assert.deepEqual(series.get("glucose_serum")?.map((row) => row.id), ["glucose-lab-a", "glucose-lab-b"]);
  assert.equal(series.get("rdw_cv")?.length, 1);
  assert.equal(series.get("rdw_sd")?.length, 1);
  assert.equal(series.get("glucose_plasma")?.length, 1);
  assert.equal(series.has("unresolved-glucose"), false);
  assert.equal(series.get("glucose_serum")?.some((row) => row.id === "ineligible-glucose"), false);

  const glucoseDefinition = getMeasurementDefinition("glucose_serum");
  assert.ok(glucoseDefinition);
  const acceptedUnit = evaluateUnitCompatibility(
    glucoseDefinition.unitPolicy,
    normalizeMeasurementUnit("mg/dL"),
  );
  assert.equal(acceptedUnit.disposition, "compatible");
  const wrongUnit = evaluateUnitCompatibility(
    glucoseDefinition.unitPolicy,
    normalizeMeasurementUnit("%"),
  );
  assert.equal(wrongUnit.disposition, "conflict");
  assert.equal(wrongUnit.evidence.code, "unit_dimension_conflict");
  const specimenConflict = evaluateSpecimenCompatibility("serum", "urine");
  assert.ok(specimenConflict);
  assert.equal(specimenConflict.disposition, "conflict");

  const resolved = resolveMeasurementDefinition({
    rawLabel: "Glucose",
    rawUnit: "mg/dL",
    specimen: "serum",
    valueKind: "numeric",
  });
  assert.equal(resolved.result, "resolved");
  assert.equal(resolved.measurementDefinitionKey, "glucose_serum");
  const incompatible = resolveMeasurementDefinition({
    rawLabel: "Glucose",
    rawUnit: "%",
    specimen: "serum",
    valueKind: "numeric",
  });
  assert.notEqual(incompatible.measurementDefinitionKey, "glucose_serum");
  assert.ok(incompatible.conflicts.includes("unit_dimension_conflict"));

  const conversion = getMeasurementConversionPolicy("glucose_serum");
  assert.ok(conversion);
  const native = {
    value: 100,
    unit: "mg/dL",
    ref_low: 70,
    ref_high: 99,
  };
  const nativeBefore = { ...native };
  const presented = presentObservation(
    {
      resolved_measurement_binding: {
        measurementDefinitionKey: glucoseDefinition.key,
        analyteKey: glucoseDefinition.analyteKey,
        conversion,
      },
      ...native,
    },
    "si",
  );
  assert.equal(presented.converted, true);
  assert.equal(presented.unit, "mmol/L");
  assert.ok(Math.abs(presented.value - 5.55) < 0.01);
  assert.equal(presented.original_unit, native.unit);
  assert.deepEqual(native, nativeBefore);
  assert.equal(series.get("glucose_serum")?.[0]?.ref_low, 70);
  assert.equal(series.get("glucose_serum")?.[1]?.document_id, "doc-b");

  const biomarkerPage = readFileSync("src/app/app/biomarkers/page.tsx", "utf8");
  assert.match(biomarkerPage, /trend_eligible === true/);
  assert.match(biomarkerPage, /measurement_definition_key === selectedKey/);
  const biomarkerTable = readFileSync("src/components/biomarker-table.tsx", "utf8");
  assert.match(biomarkerTable, /Reference/);
  assert.match(biomarkerTable, /function observationSourceHref\(/);
  assert.match(
    biomarkerTable,
    /buildHealthNavigationPath\(`\/app\/documents\/\$\{observation\.documents\.id\}/,
  );
  assert.match(biomarkerTable, /const sourceHref = observationSourceHref\(o, sourceReturnTo\)/);
}

function assertPanelContracts(): void {
  const validation = validatePanelRegistry();
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.deepEqual(PANEL_DEFINITIONS.map((panel) => panel.key), REQUIRED_PANEL_KEYS);
  fixtureCounts.panels = PANEL_DEFINITIONS.length;

  for (const panel of PANEL_DEFINITIONS) {
    assert.equal(getPanelDefinition(panel.key), panel);
    assert.ok(panel.members.length > 0);
    assert.deepEqual(
      panel.members.map((member) => member.displayOrder),
      [...panel.members.map((member) => member.displayOrder)].sort((left, right) => left - right),
    );
    for (const member of panel.members) {
      const definition = getMeasurementDefinition(member.measurementDefinitionKey);
      assert.ok(definition);
      assert.equal(definition.maturity, "reviewed");
      assert.equal(definition.sourceProvenance.kind, "registry_v2_review");
    }
  }

  assert.deepEqual(
    listPanelsForMeasurementDefinition("hemoglobin_whole_blood").map((panel) => panel.key),
    ["cbc", "iron_studies"],
  );

  const beforeResolution = resolveMeasurementDefinition({
    rawLabel: "Hemoglobin",
    rawUnit: "g/L",
    specimen: "whole_blood",
    valueKind: "numeric",
  });
  const beforeRole = getRegistryV2ScoreRole("hemoglobin_whole_blood");
  const beforeReadiness = getRegistryV2ScoreReadinessGroups("blood");
  const beforeContribution = getRegistryV2ScoreContributionGroups("blood");
  listPanelsForMeasurementDefinition("hemoglobin_whole_blood");
  assert.deepEqual(
    resolveMeasurementDefinition({
      rawLabel: "Hemoglobin",
      rawUnit: "g/L",
      specimen: "whole_blood",
      valueKind: "numeric",
    }),
    beforeResolution,
  );
  assert.equal(getRegistryV2ScoreRole("hemoglobin_whole_blood"), beforeRole);
  assert.deepEqual(getRegistryV2ScoreReadinessGroups("blood"), beforeReadiness);
  assert.deepEqual(getRegistryV2ScoreContributionGroups("blood"), beforeContribution);

  const duplicatePanel: readonly PanelDefinition[] = [
    ...PANEL_DEFINITIONS,
    { ...PANEL_DEFINITIONS[0]! },
  ];
  assert.equal(validatePanelRegistry(duplicatePanel).valid, false);
  assert.equal(
    validatePanelRegistry([
      { ...PANEL_DEFINITIONS[0]!, alternateNames: [PANEL_DEFINITIONS[0]!.displayName] },
      ...PANEL_DEFINITIONS.slice(1),
    ]).valid,
    false,
  );
  assert.equal(
    validatePanelRegistry([
      {
        ...PANEL_DEFINITIONS[0]!,
        members: [
          PANEL_DEFINITIONS[0]!.members[0]!,
          { ...PANEL_DEFINITIONS[0]!.members[0]!, displayOrder: 20 },
        ],
      },
      ...PANEL_DEFINITIONS.slice(1),
    ]).valid,
    false,
  );

  const manifest = digestMeasurementRegistryManifest();
  const changedPanels: readonly PanelDefinition[] = PANEL_DEFINITIONS.map((panel) =>
    panel.key === "cbc"
      ? {
          ...panel,
          members: panel.members.map((member) =>
            member.displayOrder === 10 ? { ...member, role: "optional" as const } : member,
          ),
        }
      : panel,
  );
  assert.notEqual(manifest, digestMeasurementRegistryManifest(MEASUREMENT_DEFINITIONS, changedPanels));
}

function assertEndpointAndPageWiring(): void {
  const timelineRoute = readFileSync("src/app/api/timeline/route.ts", "utf8");
  assert.match(timelineRoute, /medical_event_timeline/);
  assert.match(timelineRoute, /Cache-Control.*no-store|noStoreJson/);
  assert.match(timelineRoute, /getSessionProfileId\(\)/);
  const timelinePage = readFileSync("src/app/app/timeline/page.tsx", "utf8");
  assert.match(timelinePage, /\/api\/timeline/);
  assert.match(timelinePage, /Open source/);
  const biomarkerRoute = readFileSync("src/app/api/biomarkers/route.ts", "utf8");
  assert.match(biomarkerRoute, /presentObservation/);
  assert.match(biomarkerRoute, /ref_low/);
  assert.match(biomarkerRoute, /document_id/);
}

function performanceDocuments(): TimelineDocumentRow[] {
  return Array.from({ length: EH132_PERFORMANCE_EVENT_COUNT }, (_, index) => {
    const month = (index % 12) + 1;
    const day = (index % 28) + 1;
    const date = `2020-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    return timelineDocument(`performance-${index.toString().padStart(4, "0")}`, "lab_result", {
      observed_at: date,
      created_at: new Date(Date.UTC(2020, 0, 1 + index)).toISOString(),
    });
  });
}

async function assertDocumentPageCollection(): Promise<void> {
  const documents = Array.from(
    { length: EH132_PERFORMANCE_EVENT_COUNT },
    (_, index) => `document-${index}`,
  );
  const pageRequests: Array<{ offset: number; limit: number }> = [];
  const collected = await collectTimelinePages(
    async (offset, limit) => {
      pageRequests.push({ offset, limit });
      return documents.slice(offset, offset + limit);
    },
    500,
  );

  assert.deepEqual(collected, documents);
  assert.deepEqual(pageRequests, [
    { offset: 0, limit: 500 },
    { offset: 500, limit: 500 },
    { offset: 1_000, limit: 500 },
    { offset: 1_500, limit: 500 },
    { offset: 2_000, limit: 500 },
  ]);
  fixtureCounts.performancePageRequests = pageRequests.length;

  await assert.rejects(
    collectTimelinePages(async () => documents, 500),
    /more items than requested/,
  );
}

function assertProjectionPerformance(): number {
  const documents = performanceDocuments();
  buildTimelineEvents({ documents });
  const startedAt = performance.now();
  const events = buildTimelineEvents({ documents });
  const elapsedMs = performance.now() - startedAt;
  assert.equal(events.length, EH132_PERFORMANCE_EVENT_COUNT);
  if (elapsedMs > EH132_PERFORMANCE_BUDGET_MS) {
    throw new Error(
      `EH-132 timeline projection exceeded ${EH132_PERFORMANCE_BUDGET_MS}ms for ${EH132_PERFORMANCE_EVENT_COUNT} events: ${elapsedMs.toFixed(2)}ms`,
    );
  }
  return elapsedMs;
}

async function main(): Promise<void> {
  assertDateContracts();
  assertMedicalEventOrdering();
  assertTimelineProjection();
  assertComparisonCompatibility();
  assertPanelContracts();
  assertEndpointAndPageWiring();
  await assertDocumentPageCollection();
  const elapsedMs = assertProjectionPerformance();

  console.log(
    `verify-eh132-timeline-panel-release: dates=${fixtureCounts.dates}, timelineEvents=${fixtureCounts.timelineEvents}, comparisonRows=${fixtureCounts.comparisonRows}, panels=${fixtureCounts.panels}, performanceEvents=${fixtureCounts.performanceEvents}, performancePageRequests=${fixtureCounts.performancePageRequests}, performanceMs=${elapsedMs.toFixed(2)}`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
