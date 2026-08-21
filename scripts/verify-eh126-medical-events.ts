import assert from "node:assert/strict";
import {
  buildMedicalEventDateSync,
  calendarDateProjection,
  compareTimelineEvents,
  eventTypeForDocumentType,
  parseMedicalEventDate,
  sortTimelineEvents,
} from "../src/lib/documents/medical-events";

const year = parseMedicalEventDate("2026");
assert.deepEqual(year, {
  precision: "year",
  value: "2026",
  timezone: null,
  sortStartOn: "2026-01-01",
  sortEndOn: "2026-12-31",
  sortAt: null,
});

const month = parseMedicalEventDate("2026-02");
assert.equal(month?.precision, "month");
assert.equal(month?.sortEndOn, "2026-02-28");
assert.equal(parseMedicalEventDate("2024-02-29")?.precision, "day");
assert.equal(parseMedicalEventDate("2025-02-29"), null);

const instant = parseMedicalEventDate("2026-08-16T13:45:00+03:00");
assert.equal(instant?.precision, "instant");
assert.equal(instant?.timezone, "+03:00");
assert.equal(instant?.sortAt, "2026-08-16T10:45:00.000Z");
assert.equal(parseMedicalEventDate("2026-08-16T13:45:00"), null);

assert.deepEqual(buildMedicalEventDateSync("occurred", "2026-08"), {
  role: "occurred",
  precision: "month",
  value: "2026-08",
  raw_text: "2026-08",
  timezone: null,
});
assert.deepEqual(buildMedicalEventDateSync("occurred", "not a date"), {
  role: "occurred",
  precision: "unknown",
  value: null,
  raw_text: "not a date",
  timezone: null,
});
assert.equal(calendarDateProjection("2026"), null);
assert.equal(calendarDateProjection("2026-08"), null);
assert.equal(calendarDateProjection("2026-08-16"), "2026-08-16");
assert.equal(eventTypeForDocumentType("consultation_note"), "consultation_note");
assert.equal(eventTypeForDocumentType("future_document_type"), "other");


const event = (id: string, precision: "day" | "month" | "unknown", start: string | null) => ({
  eventId: id,
  eventType: "lab_result",
  sourceDocumentId: id,
  occurredPrecision: precision,
  occurredValue: start,
  occurredSortAt: null,
  occurredSortStartOn: start,
  occurredSortEndOn: start,
});
const sorted = sortTimelineEvents([
  event("unknown", "unknown", null),
  event("later", "month", "2026-09-01"),
  event("earlier", "day", "2026-08-16"),
]);
assert.deepEqual(sorted.map((item) => item.eventId), ["earlier", "later", "unknown"]);
assert.equal(
  compareTimelineEvents(event("a", "unknown", null), event("b", "unknown", null)),
  -1,
);

console.log("verify-eh126-medical-events: all checks passed");
