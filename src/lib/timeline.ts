import {
  DOCUMENT_TYPE_LABELS,
  normalizeDocumentType,
  type DocumentType,
} from "@/lib/health-systems";
import { isCurrentDocumentObservation } from "@/lib/documents/observation-read-boundaries";

export const TIMELINE_EVENT_TYPES = [
  "lab_result",
  "instrumental_report",
  "consultation_note",
  "discharge_summary",
  "prescription",
  "referral",
] as const satisfies readonly Exclude<DocumentType, "dicom">[];

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];
export type TimelineDatePrecision = "day" | "unknown";

export const TIMELINE_DEFAULT_PAGE_SIZE = 10;
export const TIMELINE_MAX_PAGE_SIZE = 25;
export const TIMELINE_MAX_MEASUREMENTS_PER_EVENT = 5;

export type TimelineDocumentRow = {
  id: string;
  original_filename: string;
  document_type: string;
  lab_name: string | null;
  observed_at: string | null;
  created_at: string;
  status: string;
  processing_status: string | null;
  error_message: string | null;
  processing_error: string | null;
  document_summary: string | null;
  modality: string | null;
};

type LaboratorySourceRelation =
  | { record_status?: string | null; is_current?: boolean | null }
  | Array<{ record_status?: string | null; is_current?: boolean | null }>
  | null;

export type TimelineObservationRow = {
  id: string;
  document_id: string | null;
  observation_kind: string | null;
  name: string;
  value: number | string | null;
  value_text: string | null;
  value_kind: string | null;
  unit: string | null;
  observed_at: string | null;
  source_extracted_biomarker?: LaboratorySourceRelation;
};

export type TimelineInstrumentalFindingRow = {
  id: string;
  document_id: string;
  modality: string | null;
  body_region: string | null;
  finding_text: string;
  impression: string | null;
  source_page: number | null;
};

export type TimelineClinicalNoteRow = {
  id: string;
  document_id: string;
  note_kind: "consultation" | "discharge" | string | null;
  provider_name: string | null;
  visit_date: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  chief_complaint: string | null;
  history_summary: string | null;
  hospital_course: string | null;
  documented_problems: string[] | null;
  discharge_diagnoses: string[] | null;
  discharge_medications: string[] | null;
  recommendations: string[] | null;
  follow_up_plan: string | null;
  follow_up_instructions: string | null;
};

export type TimelinePrescriptionRow = {
  id: string;
  document_id: string;
  prescriber_name: string | null;
  prescribed_at: string | null;
  medications: Array<{
    name?: string | null;
    dose?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
  }> | null;
};

export type TimelineReferralRow = {
  id: string;
  document_id: string;
  referring_provider: string | null;
  referred_to_specialty: string | null;
  referred_to_provider: string | null;
  referral_date: string | null;
  reason_for_referral: string | null;
  clinical_summary: string | null;
  urgency: string | null;
};

export type TimelineMeasurement = {
  id: string;
  name: string;
  value: string | null;
  unit: string | null;
};

export type TimelineEvent = {
  id: string;
  documentId: string;
  type: TimelineEventType;
  typeLabel: string;
  title: string;
  eventDate: string | null;
  datePrecision: TimelineDatePrecision;
  createdAt: string;
  status: string;
  processingStatus: string;
  provider: string | null;
  labName: string | null;
  summary: string | null;
  details: string[];
  measurements: TimelineMeasurement[];
  measurementCount: number;
  source: {
    href: string;
    filename: string;
  };
};

export type TimelineProjectionInput = {
  documents: TimelineDocumentRow[];
  observations?: TimelineObservationRow[];
  findings?: TimelineInstrumentalFindingRow[];
  clinicalNotes?: TimelineClinicalNoteRow[];
  prescriptions?: TimelinePrescriptionRow[];
  referrals?: TimelineReferralRow[];
};

export type TimelineQuery = {
  type: TimelineEventType | null;
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
};

export type TimelinePage = {
  items: TimelineEvent[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

export function isTimelineEventType(value: string): value is TimelineEventType {
  return (TIMELINE_EVENT_TYPES as readonly string[]).includes(value);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function validDate(value: string | null | undefined): string | null {
  return value && isIsoDate(value) ? value : null;
}

function firstValidDate(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const date = validDate(value);
    if (date) return date;
  }
  return null;
}


function groupedByDocument<T extends { document_id: string | null }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.document_id) continue;
    const entries = grouped.get(row.document_id) ?? [];
    entries.push(row);
    grouped.set(row.document_id, entries);
  }
  return grouped;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function addDetail(details: string[], label: string, value: string | null | undefined) {
  const normalized = nonEmpty(value);
  if (normalized) details.push(`${label}: ${normalized}`);
}

function addListDetail(details: string[], label: string, values: string[] | null | undefined) {
  const normalized = (values ?? []).map((value) => value.trim()).filter(Boolean);
  if (normalized.length > 0) details.push(`${label}: ${normalized.slice(0, 3).join("; ")}`);
}

function formatRawValue(row: TimelineObservationRow): string | null {
  const text = nonEmpty(row.value_text);
  if (text) return text;
  if (row.value === null || row.value === undefined || row.value === "") return null;
  return String(row.value);
}

function measurementRows(rows: TimelineObservationRow[]): TimelineMeasurement[] {
  return rows
    .filter(
      (row) =>
        row.observation_kind === "lab" &&
        isCurrentDocumentObservation({
          observation_kind: row.observation_kind,
          source_extracted_biomarker: row.source_extracted_biomarker,
        }),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      value: formatRawValue(row),
      unit: nonEmpty(row.unit),
    }))
    .sort((left, right) =>
      `${left.name}\u0000${left.id}`.localeCompare(`${right.name}\u0000${right.id}`),
    );
}

function eventDateFor(
  type: TimelineEventType,
  document: TimelineDocumentRow,
  note: TimelineClinicalNoteRow | null,
  prescription: TimelinePrescriptionRow | null,
  referral: TimelineReferralRow | null,
): string | null {
  switch (type) {
    case "consultation_note":
      return firstValidDate(note?.visit_date, document.observed_at);
    case "discharge_summary":
      return firstValidDate(note?.discharge_date, note?.admission_date, document.observed_at);
    case "prescription":
      return firstValidDate(prescription?.prescribed_at, document.observed_at);
    case "referral":
      return firstValidDate(referral?.referral_date, document.observed_at);
    case "lab_result":
    case "instrumental_report":
      return validDate(document.observed_at);
  }
}

function buildTypedDetails(
  type: TimelineEventType,
  document: TimelineDocumentRow,
  findings: TimelineInstrumentalFindingRow[],
  note: TimelineClinicalNoteRow | null,
  prescription: TimelinePrescriptionRow | null,
  referral: TimelineReferralRow | null,
): { provider: string | null; summary: string | null; details: string[] } {
  const details: string[] = [];

  switch (type) {
    case "instrumental_report": {
      const finding = findings[0] ?? null;
      addDetail(details, "Modality", findings.find((item) => item.modality)?.modality ?? document.modality);
      addDetail(details, "Body region", findings.find((item) => item.body_region)?.body_region);
      addDetail(details, "Finding", finding?.finding_text);
      addDetail(details, "Impression", finding?.impression);
      return {
        provider: null,
        summary: nonEmpty(document.document_summary) ?? nonEmpty(finding?.impression) ?? nonEmpty(finding?.finding_text),
        details,
      };
    }
    case "consultation_note": {
      addDetail(details, "Chief complaint", note?.chief_complaint);
      addDetail(details, "History", note?.history_summary);
      addListDetail(details, "Problems", note?.documented_problems);
      addListDetail(details, "Recommendations", note?.recommendations);
      addDetail(details, "Follow-up", note?.follow_up_plan);
      return {
        provider: nonEmpty(note?.provider_name),
        summary: nonEmpty(note?.chief_complaint) ?? nonEmpty(note?.history_summary),
        details,
      };
    }
    case "discharge_summary": {
      addDetail(details, "Admission date", note?.admission_date);
      addDetail(details, "Discharge date", note?.discharge_date);
      addDetail(details, "Hospital course", note?.hospital_course);
      addListDetail(details, "Diagnoses", note?.discharge_diagnoses ?? note?.documented_problems);
      addListDetail(details, "Medications", note?.discharge_medications);
      addDetail(details, "Follow-up", note?.follow_up_instructions ?? note?.follow_up_plan);
      return {
        provider: nonEmpty(note?.provider_name),
        summary: nonEmpty(note?.hospital_course) ?? (note?.discharge_diagnoses?.[0] ?? null),
        details,
      };
    }
    case "prescription": {
      const medications = (prescription?.medications ?? []).filter((medication) => nonEmpty(medication.name));
      addDetail(details, "Prescriber", prescription?.prescriber_name);
      if (medications.length > 0) {
        details.push(
          `Medications: ${medications
            .slice(0, 3)
            .map((medication) => medication.name?.trim())
            .filter(Boolean)
            .join("; ")}`,
        );
      }
      return {
        provider: nonEmpty(prescription?.prescriber_name),
        summary:
          medications.length > 0
            ? `${medications.length} medication${medications.length === 1 ? "" : "s"}`
            : null,
        details,
      };
    }
    case "referral": {
      addDetail(details, "Referred to", referral?.referred_to_specialty ?? referral?.referred_to_provider);
      addDetail(details, "Referring provider", referral?.referring_provider);
      addDetail(details, "Urgency", referral?.urgency);
      addDetail(details, "Reason", referral?.reason_for_referral);
      addDetail(details, "Summary", referral?.clinical_summary);
      return {
        provider: nonEmpty(referral?.referring_provider),
        summary:
          nonEmpty(referral?.reason_for_referral) ??
          nonEmpty(referral?.referred_to_specialty) ??
          nonEmpty(referral?.clinical_summary),
        details,
      };
    }
    case "lab_result":
      return { provider: nonEmpty(document.lab_name), summary: null, details };
  }
}

function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((left, right) => {
    if (left.eventDate && right.eventDate) {
      const byDate = right.eventDate.localeCompare(left.eventDate);
      if (byDate !== 0) return byDate;
    } else if (left.eventDate) {
      return -1;
    } else if (right.eventDate) {
      return 1;
    }

    const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
    if (byCreatedAt !== 0) return byCreatedAt;
    return left.documentId.localeCompare(right.documentId);
  });
}

export function buildTimelineEvents(input: TimelineProjectionInput): TimelineEvent[] {
  const observationsByDocument = groupedByDocument(input.observations ?? []);
  const findingsByDocument = groupedByDocument(input.findings ?? []);
  const notesByDocument = new Map((input.clinicalNotes ?? []).map((row) => [row.document_id, row]));
  const prescriptionsByDocument = new Map(
    (input.prescriptions ?? []).map((row) => [row.document_id, row]),
  );
  const referralsByDocument = new Map((input.referrals ?? []).map((row) => [row.document_id, row]));

  const events: TimelineEvent[] = [];
  for (const document of input.documents) {
    const normalizedType = normalizeDocumentType(document.document_type);
    if (!normalizedType || !isTimelineEventType(normalizedType)) continue;

    const measurements = measurementRows(observationsByDocument.get(document.id) ?? []);
    const findings = findingsByDocument.get(document.id) ?? [];
    const note = notesByDocument.get(document.id) ?? null;
    const prescription = prescriptionsByDocument.get(document.id) ?? null;
    const referral = referralsByDocument.get(document.id) ?? null;
    const typed = buildTypedDetails(normalizedType, document, findings, note, prescription, referral);
    const eventDate = eventDateFor(normalizedType, document, note, prescription, referral);
    const processingStatus = document.processing_status ?? document.status;
    const statusSummary =
      processingStatus === "processing"
        ? "Extraction in progress"
        : processingStatus === "failed"
          ? nonEmpty(document.processing_error) ?? nonEmpty(document.error_message) ?? "Document processing failed"
          : null;
    const measurementSummary =
      normalizedType === "lab_result" && measurements.length > 0
        ? `${measurements.length} measurement${measurements.length === 1 ? "" : "s"}`
        : null;

    events.push({
      id: document.id,
      documentId: document.id,
      type: normalizedType,
      typeLabel: DOCUMENT_TYPE_LABELS[normalizedType],
      title: nonEmpty(document.original_filename) ?? DOCUMENT_TYPE_LABELS[normalizedType],
      eventDate,
      datePrecision: eventDate ? "day" : "unknown",
      createdAt: document.created_at,
      status: document.status,
      processingStatus,
      provider: typed.provider,
      labName: nonEmpty(document.lab_name),
      summary: typed.summary ?? measurementSummary ?? statusSummary,
      details: typed.details,
      measurements: measurements.slice(0, TIMELINE_MAX_MEASUREMENTS_PER_EVENT),
      measurementCount: measurements.length,
      source: {
        href: `/app/documents/${document.id}`,
        filename: document.original_filename,
      },
    });
  }

  return sortTimelineEvents(events);
}

export function filterTimelineEvents(
  events: TimelineEvent[],
  query: Pick<TimelineQuery, "type" | "from" | "to">,
): TimelineEvent[] {
  return events.filter((event) => {
    if (query.type && event.type !== query.type) return false;
    if (query.from || query.to) {
      if (!event.eventDate) return false;
      if (query.from && event.eventDate < query.from) return false;
      if (query.to && event.eventDate > query.to) return false;
    }
    return true;
  });
}

export function paginateTimelineEvents(
  events: TimelineEvent[],
  query: Pick<TimelineQuery, "page" | "pageSize">,
): TimelinePage {
  const page = Math.max(1, query.page);
  const pageSize = Math.min(Math.max(1, query.pageSize), TIMELINE_MAX_PAGE_SIZE);
  const start = (page - 1) * pageSize;
  return {
    items: events.slice(start, start + pageSize),
    page,
    pageSize,
    total: events.length,
    hasNext: start + pageSize < events.length,
  };
}

export function parseTimelineQuery(
  searchParams: URLSearchParams,
): { value: TimelineQuery } | { error: string } {
  const rawType = searchParams.get("type") ?? "all";
  const type = rawType === "all" ? null : isTimelineEventType(rawType) ? rawType : undefined;
  if (type === undefined) {
    return { error: `Unsupported timeline type: ${rawType}` };
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from !== null && !isIsoDate(from)) return { error: "from must be a valid ISO date (YYYY-MM-DD)" };
  if (to !== null && !isIsoDate(to)) return { error: "to must be a valid ISO date (YYYY-MM-DD)" };
  if (from && to && from > to) return { error: "from must be on or before to" };

  const page = parsePositiveInteger(searchParams.get("page"), 1, "page");
  if (typeof page === "string") return { error: page };
  const pageSize = parsePositiveInteger(
    searchParams.get("pageSize"),
    TIMELINE_DEFAULT_PAGE_SIZE,
    "pageSize",
  );
  if (typeof pageSize === "string") return { error: pageSize };
  if (pageSize > TIMELINE_MAX_PAGE_SIZE) {
    return { error: `pageSize must be between 1 and ${TIMELINE_MAX_PAGE_SIZE}` };
  }

  return {
    value: {
      type,
      from,
      to,
      page,
      pageSize,
    },
  };
}

function parsePositiveInteger(
  raw: string | null,
  fallback: number,
  label: string,
): number | string {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return `${label} must be a positive integer`;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return `${label} must be a positive integer`;
  return parsed;
}
