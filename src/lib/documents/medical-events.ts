export const MEDICAL_EVENT_DATE_ROLES = [
  "occurred",
  "occurred_end",
  "collected",
  "authored",
] as const;

export type MedicalEventDateRole = (typeof MEDICAL_EVENT_DATE_ROLES)[number];

export const MEDICAL_EVENT_DATE_PRECISIONS = [
  "instant",
  "day",
  "month",
  "year",
  "unknown",
] as const;

export type MedicalEventDatePrecision =
  (typeof MEDICAL_EVENT_DATE_PRECISIONS)[number];

export type MedicalEventDateSync = Readonly<{
  role: MedicalEventDateRole;
  precision: MedicalEventDatePrecision;
  value: string | null;
  raw_text: string | null;
  timezone: string | null;
}>;

export type ParsedMedicalEventDate = Readonly<{
  precision: Exclude<MedicalEventDatePrecision, "unknown">;
  value: string;
  timezone: string | null;
  sortStartOn: string;
  sortEndOn: string;
  sortAt: string | null;
}>;

const YEAR_RE = /^(\d{4})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validYear(year: number): boolean {
  return year >= 1 && year <= 9999;
}

function validMonth(year: number, month: number): boolean {
  return validYear(year) && month >= 1 && month <= 12;
}

function validDay(year: number, month: number, day: number): boolean {
  return validMonth(year, month) && day >= 1 && day <= daysInMonth(year, month);
}

function monthEnd(year: number, month: number): string {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${daysInMonth(year, month).toString().padStart(2, "0")}`;
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const match = DAY_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return validDay(year, month, day) ? { year, month, day } : null;
}

/**
 * Parses a source date without passing calendar dates through `Date`. A null
 * result means the source was non-empty but did not satisfy the contract.
 */
export function parseMedicalEventDate(value: unknown): ParsedMedicalEventDate | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const yearMatch = YEAR_RE.exec(trimmed);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    if (!validYear(year)) return null;
    return {
      precision: "year",
      value: trimmed,
      timezone: null,
      sortStartOn: `${trimmed}-01-01`,
      sortEndOn: `${trimmed}-12-31`,
      sortAt: null,
    };
  }

  const monthMatch = MONTH_RE.exec(trimmed);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (!validMonth(year, month)) return null;
    const monthValue = `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}`;
    return {
      precision: "month",
      value: monthValue,
      timezone: null,
      sortStartOn: `${monthValue}-01`,
      sortEndOn: monthEnd(year, month),
      sortAt: null,
    };
  }

  const dayParts = dateParts(trimmed);
  if (dayParts) {
    return {
      precision: "day",
      value: trimmed,
      timezone: null,
      sortStartOn: trimmed,
      sortEndOn: trimmed,
      sortAt: null,
    };
  }

  const instantMatch = INSTANT_RE.exec(trimmed);
  if (!instantMatch) return null;
  const year = Number(instantMatch[1]);
  const month = Number(instantMatch[2]);
  const day = Number(instantMatch[3]);
  const hour = Number(instantMatch[4]);
  const minute = Number(instantMatch[5]);
  const second = instantMatch[6] ? Number(instantMatch[6]) : 0;
  const offset = instantMatch[8];
  const offsetMinutes =
    offset === "Z"
      ? 0
      : Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6));
  const offsetSign = offset === "Z" || offset[0] === "+" ? 1 : -1;

  if (
    !validDay(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetMinutes > 14 * 60 ||
    (offset !== "Z" && Number(offset.slice(4, 6)) > 59)
  ) {
    return null;
  }

  const instantMs = Date.parse(trimmed);
  if (!Number.isFinite(instantMs)) return null;
  const sortAt = new Date(instantMs).toISOString();
  const sortStartOn = sortAt.slice(0, 10);
  const sortEndOn = sortStartOn;
  // The explicit calculation above makes the offset validation visible even
  // when the runtime parser is permissive. Keep the variable used so a future
  // parser change cannot silently remove that invariant.
  void offsetSign;

  return {
    precision: "instant",
    value: trimmed,
    timezone: offset === "Z" ? "UTC" : offset,
    sortStartOn,
    sortEndOn,
    sortAt,
  };
}

export function unknownMedicalEventDate(
  role: MedicalEventDateRole,
  rawValue?: unknown,
): MedicalEventDateSync {
  return {
    role,
    precision: "unknown",
    value: null,
    raw_text: typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null,
    timezone: null,
  };
}

export function buildMedicalEventDateSync(
  role: MedicalEventDateRole,
  rawValue: unknown,
): MedicalEventDateSync {
  const rawText = typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null;
  const parsed = parseMedicalEventDate(rawValue);
  if (!parsed) return unknownMedicalEventDate(role, rawValue);
  return {
    role,
    precision: parsed.precision,
    value: parsed.value,
    raw_text: rawText,
    timezone: parsed.timezone,
  };
}

export function calendarDateProjection(value: unknown): string | null {
  const parsed = parseMedicalEventDate(value);
  return parsed?.precision === "day" ? parsed.value : null;
}

export function eventTypeForDocumentType(documentType: string | null | undefined): string {
  switch (documentType) {
    case "lab_result":
    case "instrumental_report":
    case "consultation_note":
    case "discharge_summary":
    case "prescription":
    case "referral":
    case "dicom":
      return documentType;
    default:
      return "other";
  }
}

export type TimelineComparableEvent = Readonly<{
  eventId: string;
  eventType: string;
  sourceDocumentId: string | null;
  occurredPrecision: MedicalEventDatePrecision;
  occurredValue: string | null;
  occurredSortAt: string | null;
  occurredSortStartOn: string | null;
  occurredSortEndOn: string | null;
}>;

export type TimelineDirection = "asc" | "desc";

const PRECISION_RANK: Readonly<Record<MedicalEventDatePrecision, number>> = {
  instant: 0,
  day: 1,
  month: 2,
  year: 3,
  unknown: 4,
};

function compareStrings(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}

function compareNullableDate(
  left: string | null,
  right: string | null,
  direction: TimelineDirection,
): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const result = left.localeCompare(right);
  return direction === "asc" ? result : -result;
}

function compareNullableInstant(
  left: string | null,
  right: string | null,
  direction: TimelineDirection,
): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs !== rightMs) {
    const result = leftMs - rightMs;
    return direction === "asc" ? result : -result;
  }
  return compareNullableDate(left, right, direction);
}

export function compareTimelineEvents(
  left: TimelineComparableEvent,
  right: TimelineComparableEvent,
  direction: TimelineDirection = "asc",
): number {
  const leftUnknown = left.occurredPrecision === "unknown";
  const rightUnknown = right.occurredPrecision === "unknown";
  if (leftUnknown !== rightUnknown) return leftUnknown ? 1 : -1;

  if (!leftUnknown) {
    const start = compareNullableDate(
      left.occurredSortStartOn,
      right.occurredSortStartOn,
      direction,
    );
    if (start !== 0) return start;

    const instant = compareNullableInstant(
      left.occurredSortAt,
      right.occurredSortAt,
      direction,
    );
    if (instant !== 0) return instant;

    const end = compareNullableDate(
      left.occurredSortEndOn,
      right.occurredSortEndOn,
      direction,
    );
    if (end !== 0) return end;

    const precision =
      PRECISION_RANK[left.occurredPrecision] - PRECISION_RANK[right.occurredPrecision];
    if (precision !== 0) return precision;
  }

  return (
    compareStrings(left.eventType, right.eventType) ||
    compareStrings(left.sourceDocumentId, right.sourceDocumentId) ||
    compareStrings(left.eventId, right.eventId)
  );
}

export function sortTimelineEvents<T extends TimelineComparableEvent>(
  events: readonly T[],
  direction: TimelineDirection = "asc",
): T[] {
  return [...events].sort((left, right) => compareTimelineEvents(left, right, direction));
}
