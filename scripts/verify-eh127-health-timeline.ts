import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildTimelineEvents,
  filterTimelineEvents,
  isIsoDate,
  paginateTimelineEvents,
  parseTimelineQuery,
  TIMELINE_MAX_MEASUREMENTS_PER_EVENT,
  type TimelineClinicalNoteRow,
  type TimelineDocumentRow,
  type TimelineObservationRow,
} from "../src/lib/timeline";

const UUID = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

function document(
  id: string,
  type: string,
  overrides: Partial<TimelineDocumentRow> = {},
): TimelineDocumentRow {
  return {
    id: UUID(id),
    original_filename: `${type}-${id}.pdf`,
    document_type: type,
    lab_name: null,
    observed_at: "2025-01-01",
    created_at: `2025-01-01T00:00:00.000Z`,
    status: "completed",
    processing_status: "ready",
    error_message: null,
    processing_error: null,
    document_summary: null,
    modality: null,
    ...overrides,
  };
}

function clinicalNote(
  documentId: string,
  overrides: Partial<TimelineClinicalNoteRow> = {},
): TimelineClinicalNoteRow {
  return {
    id: UUID(`note-${documentId}`),
    document_id: documentId,
    note_kind: "consultation",
    provider_name: "Dr. Ada Example",
    visit_date: null,
    admission_date: null,
    discharge_date: null,
    chief_complaint: "Routine follow-up",
    history_summary: null,
    hospital_course: null,
    documented_problems: [],
    discharge_diagnoses: [],
    discharge_medications: [],
    recommendations: [],
    follow_up_plan: null,
    follow_up_instructions: null,
    ...overrides,
  };
}

function observation(
  documentId: string,
  suffix: string,
  overrides: Partial<TimelineObservationRow> = {},
): TimelineObservationRow {
  return {
    id: UUID(`${documentId}-${suffix}`),
    document_id: documentId,
    observation_kind: "lab",
    name: `Marker ${suffix}`,
    value: 12,
    value_text: null,
    value_kind: "numeric",
    unit: "mg/L",
    observed_at: "2025-01-01",
    source_extracted_biomarker: { record_status: "active", is_current: true },
    ...overrides,
  };
}

const lab = document("1", "lab_result", {
  observed_at: "2025-03-01",
  lab_name: "Synthetic Diagnostics",
  created_at: "2025-03-02T00:00:00.000Z",
});
const consultation = document("2", "consultation_note", {
  observed_at: "2025-01-01",
  created_at: "2025-02-04T00:00:00.000Z",
});
const discharge = document("3", "discharge_summary", {
  observed_at: null,
  created_at: "2025-01-06T00:00:00.000Z",
});
const unknown = document("4", "referral", {
  observed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
});
const dicom = document("5", "dicom");
const tieLate = document("6", "instrumental_report", {
  observed_at: "2025-04-01",
  created_at: "2025-04-02T00:00:00.000Z",
});
const tieEarly = document("7", "instrumental_report", {
  observed_at: "2025-04-01",
  created_at: "2025-04-01T00:00:00.000Z",
});

const labMeasurements = Array.from({ length: TIMELINE_MAX_MEASUREMENTS_PER_EVENT + 1 }, (_, index) =>
  observation("000000000001", String(index + 1), { name: `Marker ${index + 1}` }),
);
labMeasurements.push(
  observation("000000000001", "stale", {
    name: "Retired marker",
    source_extracted_biomarker: { record_status: "superseded", is_current: false },
  }),
);

const events = buildTimelineEvents({
  documents: [lab, consultation, discharge, unknown, dicom, tieLate, tieEarly],
  observations: labMeasurements.map((row) => ({ ...row, document_id: lab.id })),
  clinicalNotes: [
    clinicalNote(consultation.id, { visit_date: "2025-02-03" }),
    clinicalNote(discharge.id, {
      note_kind: "discharge",
      provider_name: "Synthetic Hospital",
      admission_date: "2025-01-01",
      discharge_date: "2025-01-05",
      hospital_course: "Stable course",
    }),
  ],
});

assert.equal(events.length, 6, "six supported document events are projected and DICOM is excluded");
assert.equal(events.find((event) => event.documentId === consultation.id)?.eventDate, "2025-02-03");
assert.equal(events.find((event) => event.documentId === discharge.id)?.eventDate, "2025-01-05");
assert.equal(events.find((event) => event.documentId === unknown.id)?.eventDate, null);
assert.equal(events.find((event) => event.documentId === unknown.id)?.datePrecision, "unknown");
assert.equal(
  events.find((event) => event.documentId === unknown.id)?.source.href,
  `/app/documents/${unknown.id}`,
  "unknown-date events retain their source link",
);

const labEvent = events.find((event) => event.documentId === lab.id);
assert.ok(labEvent, "laboratory source document is projected");
assert.equal(labEvent.measurementCount, TIMELINE_MAX_MEASUREMENTS_PER_EVENT + 1);
assert.equal(labEvent.measurements.length, TIMELINE_MAX_MEASUREMENTS_PER_EVENT);
assert.equal(
  labEvent.measurements.some((measurement) => measurement.name === "Retired marker"),
  false,
  "superseded laboratory rows are not presented as current",
);

assert.deepEqual(
  events.slice(0, 3).map((event) => event.documentId),
  [tieLate.id, tieEarly.id, lab.id],
  "known events sort newest-first and same-day ties use created_at descending",
);
assert.equal(events.at(-1)?.documentId, unknown.id, "unknown dates sort after known dates");

const filtered = filterTimelineEvents(events, {
  type: "consultation_note",
  from: "2025-02-03",
  to: "2025-02-03",
});
assert.deepEqual(filtered.map((event) => event.documentId), [consultation.id]);
assert.equal(
  filterTimelineEvents(events, { type: null, from: "2025-01-01", to: "2025-12-31" }).some(
    (event) => event.eventDate === null,
  ),
  false,
  "active date ranges exclude unknown dates",
);

const page = paginateTimelineEvents(events, { page: 2, pageSize: 2 });
assert.deepEqual(page.items.map((event) => event.documentId), [lab.id, consultation.id]);
assert.equal(page.total, 6);
assert.equal(page.hasNext, true);
assert.equal(paginateTimelineEvents(events, { page: 3, pageSize: 3 }).hasNext, false);

assert.equal(isIsoDate("2025-02-28"), true);
assert.equal(isIsoDate("2025-02-29"), false);
const parsed = parseTimelineQuery(
  new URLSearchParams("type=referral&from=2025-01-01&to=2025-12-31&page=2&pageSize=5"),
);
assert.ok("value" in parsed);
if ("value" in parsed) {
  assert.deepEqual(parsed.value, {
    type: "referral",
    from: "2025-01-01",
    to: "2025-12-31",
    page: 2,
    pageSize: 5,
  });
}
assert.match(
  (parseTimelineQuery(new URLSearchParams("from=2025-03-01&to=2025-02-01")) as { error: string }).error,
  /on or before/,
);
assert.match(
  (parseTimelineQuery(new URLSearchParams("type=dicom")) as { error: string }).error,
  /Unsupported timeline type/,
);
assert.match(
  (parseTimelineQuery(new URLSearchParams("pageSize=26")) as { error: string }).error,
  /pageSize must be between/,
);

const route = readFileSync("src/app/api/timeline/route.ts", "utf8");
assert.match(route, /getSessionProfileId\(\)/, "timeline endpoint requires a session");
assert.match(route, /\.eq\("profile_id", profileId\)/, "timeline reads are profile-scoped");
assert.match(route, /parseTimelineQuery\(/, "endpoint validates query parameters");
assert.match(route, /filterTimelineEvents\(/, "endpoint filters normalized event dates");
assert.match(route, /paginateTimelineEvents\(/, "endpoint paginates after filtering");

const pageSource = readFileSync("src/app/app/timeline/page.tsx", "utf8");
assert.match(pageSource, /\/api\/timeline/, "timeline page calls the projection endpoint");
assert.match(pageSource, /Open source/, "timeline cards expose a source action");
assert.match(pageSource, /No events match your filters/, "filtered-empty state is distinct");
assert.match(pageSource, /Try again/, "timeline error state has a retry action");
assert.match(pageSource, /Active profile/, "timeline identifies the active profile");
assert.match(pageSource, /Previous/);
assert.match(pageSource, /Next/);

const nav = readFileSync("src/lib/nav-items.ts", "utf8");
assert.match(nav, /\/app\/timeline/);
const metadata = readFileSync("src/lib/navigation.ts", "utf8");
assert.match(metadata, /"\/app\/timeline"/);

console.log("verify-eh127-health-timeline: all checks passed");
