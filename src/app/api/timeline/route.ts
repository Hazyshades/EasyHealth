import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { noStoreJson } from "@/lib/documents/access";
import {
  buildTimelineEvents,
  filterTimelineEvents,
  paginateTimelineEvents,
  parseTimelineQuery,
  type TimelineClinicalNoteRow,
  type TimelineDocumentRow,
  type TimelineInstrumentalFindingRow,
  type TimelineObservationRow,
  type TimelinePrescriptionRow,
  type TimelineReferralRow,
} from "@/lib/timeline";

const DOCUMENT_SELECT =
  "id, original_filename, document_type, lab_name, observed_at, created_at, status, processing_status, error_message, processing_error, document_summary, modality";
const OBSERVATION_SELECT =
  "id, document_id, observation_kind, name, value, value_text, value_kind, unit, observed_at, source_extracted_biomarker:document_extracted_biomarkers!observations_source_extracted_biomarker_fkey(record_status, is_current)";

function isHealthTimelinePageRequest(request: NextRequest): boolean {
  return ["type", "from", "to", "page", "pageSize"].some((key) =>
    request.nextUrl.searchParams.has(key),
  );
}

async function getHealthTimelinePage(request: NextRequest) {
  const profileId = await getSessionProfileId();
  if (!profileId) return noStoreJson({ error: "Unauthorized" }, { status: 401 });

  const parsedQuery = parseTimelineQuery(request.nextUrl.searchParams);
  if ("error" in parsedQuery) {
    return noStoreJson({ error: parsedQuery.error }, { status: 400 });
  }
  const query = parsedQuery.value;
  const supabase = createAdminClient();

  let profile;
  try {
    profile = await getProfileById(profileId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile";
    return noStoreJson({ error: message }, { status: 500 });
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (documentsError) {
    return noStoreJson({ error: documentsError.message }, { status: 500 });
  }

  const rows = (documents ?? []) as TimelineDocumentRow[];
  const documentIds = rows.map((document) => document.id);
  const emptyResult = Promise.resolve({ data: [], error: null });
  const observationsResult = documentIds.length
    ? supabase
        .from("observations")
        .select(OBSERVATION_SELECT)
        .eq("profile_id", profileId)
        .eq("observation_kind", "lab")
        .in("document_id", documentIds)
    : emptyResult;
  const findingsResult = documentIds.length
    ? supabase
        .from("document_extracted_findings")
        .select("id, document_id, modality, body_region, finding_text, impression, source_page")
        .eq("profile_id", profileId)
        .eq("status", "accepted")
        .in("document_id", documentIds)
    : emptyResult;
  const clinicalNotesResult = documentIds.length
    ? supabase
        .from("document_extracted_clinical_notes")
        .select(
          "id, document_id, note_kind, provider_name, visit_date, admission_date, discharge_date, chief_complaint, history_summary, hospital_course, documented_problems, discharge_diagnoses, recommendations, follow_up_plan, follow_up_instructions",
        )
        .eq("profile_id", profileId)
        .eq("status", "accepted")
        .in("document_id", documentIds)
    : emptyResult;
  const prescriptionsResult = documentIds.length
    ? supabase
        .from("document_extracted_prescriptions")
        .select("id, document_id, prescriber_name, prescribed_at, medications")
        .eq("profile_id", profileId)
        .eq("status", "accepted")
        .in("document_id", documentIds)
    : emptyResult;
  const referralsResult = documentIds.length
    ? supabase
        .from("document_extracted_referrals")
        .select(
          "id, document_id, referring_provider, referred_to_specialty, referred_to_provider, referral_date, reason_for_referral, clinical_summary, urgency",
        )
        .eq("profile_id", profileId)
        .eq("status", "accepted")
        .in("document_id", documentIds)
    : emptyResult;

  const [
    observationsResponse,
    findingsResponse,
    clinicalNotesResponse,
    prescriptionsResponse,
    referralsResponse,
  ] = await Promise.all([
    observationsResult,
    findingsResult,
    clinicalNotesResult,
    prescriptionsResult,
    referralsResult,
  ]);
  const relatedResponses = [
    observationsResponse,
    findingsResponse,
    clinicalNotesResponse,
    prescriptionsResponse,
    referralsResponse,
  ];
  const relatedError = relatedResponses.find((response) => response.error)?.error;
  if (relatedError) {
    return noStoreJson({ error: relatedError.message }, { status: 500 });
  }

  const events = buildTimelineEvents({
    documents: rows,
    observations: (observationsResponse.data ?? []) as TimelineObservationRow[],
    findings: (findingsResponse.data ?? []) as TimelineInstrumentalFindingRow[],
    clinicalNotes: (clinicalNotesResponse.data ?? []) as TimelineClinicalNoteRow[],
    prescriptions: (prescriptionsResponse.data ?? []) as TimelinePrescriptionRow[],
    referrals: (referralsResponse.data ?? []) as TimelineReferralRow[],
  });
  const filtered = filterTimelineEvents(events, query);
  const page = paginateTimelineEvents(filtered, query);
  const profileLabel =
    profile.display_name?.trim() ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email?.trim() ||
    "Active profile";

  return noStoreJson({
    profile: { id: profile.id, label: profileLabel },
    events: page.items,
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      hasNext: page.hasNext,
    },
    filters: {
      type: query.type ?? "all",
      from: query.from,
      to: query.to,
    },
  });
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

type TimelineDate = {
  date_role: string;
  precision: string;
  value_text: string | null;
  raw_text: string | null;
  timezone: string | null;
};

type TimelineObservation = {
  id: string;
  name: string;
  value: number | null;
  unit: string | null;
  observed_at: string | null;
  observation_kind: string | null;
  value_kind: string | null;
};

type TimelineRow = {
  event_id: string;
  profile_id: string;
  event_type: string;
  document_id: string;
  event_created_at: string;
  original_filename: string | null;
  document_type: string | null;
  document_status: string | null;
  processing_status: string | null;
  lab_name: string | null;
  uploaded_at: string;
  occurred_precision: string;
  occurred_value: string | null;
  occurred_raw_text: string | null;
  occurred_timezone: string | null;
  dates: TimelineDate[];
  observations: TimelineObservation[];
};

function boundedInteger(value: string | null, fallback: number, maximum: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  return Math.min(Number.parseInt(value, 10), maximum);
}

type TimelineDirection = "asc" | "desc";

async function getNormalizedTimeline(request: NextRequest) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const directionParam = request.nextUrl.searchParams.get("direction") ?? "asc";
  if (directionParam !== "asc" && directionParam !== "desc") {
    return NextResponse.json({ error: "Invalid timeline direction" }, { status: 400 });
  }
  const direction: TimelineDirection = directionParam;
  const ascending = direction === "asc";
  const limit = Math.max(
    1,
    boundedInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT),
  );
  const offset = boundedInteger(request.nextUrl.searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("medical_event_timeline")
    .select(
      "event_id, profile_id, event_type, document_id, event_created_at, original_filename, document_type, document_status, processing_status, lab_name, uploaded_at, occurred_precision, occurred_value, occurred_raw_text, occurred_timezone",
    )
    .eq("profile_id", profileId)
    // Unknown events stay after known events in either direction.
    .order("occurred_unknown_rank", { ascending: true })
    .order("occurred_sort_start_on", { ascending, nullsFirst: false })
    // Nullable instants sort after calendar dates, matching the shared comparator.
    .order("occurred_sort_at", { ascending, nullsFirst: false })
    .order("occurred_sort_end_on", { ascending, nullsFirst: false })
    .order("event_type", { ascending: true })
    .order("document_id", { ascending: true })
    .order("event_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<Omit<TimelineRow, "dates" | "observations">>;
  const eventIds = rows.map((row) => row.event_id);
  const datesByEvent = new Map<string, TimelineDate[]>();
  const observationsByEvent = new Map<string, TimelineObservation[]>();

  if (eventIds.length > 0) {
    const [observations, eventDates] = await Promise.all([
      supabase
        .from("observations")
        .select(
          "id, medical_event_id, name, value, unit, observed_at, observation_kind, value_kind",
        )
        .eq("profile_id", profileId)
        .in("medical_event_id", eventIds)
        .order("observed_at", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true }),
      supabase
        .from("medical_event_dates")
        .select("medical_event_id, date_role, precision, value_text, raw_text, timezone")
        .in("medical_event_id", eventIds)
        .order("medical_event_id", { ascending: true })
        .order("date_role", { ascending: true }),
    ]);

    if (observations.error) {
      return NextResponse.json({ error: observations.error.message }, { status: 500 });
    }
    if (eventDates.error) {
      return NextResponse.json({ error: eventDates.error.message }, { status: 500 });
    }

    for (const observation of observations.data ?? []) {
      const eventObservations = observationsByEvent.get(observation.medical_event_id) ?? [];
      eventObservations.push({
        id: observation.id,
        name: observation.name,
        value: observation.value,
        unit: observation.unit,
        observed_at: observation.observed_at,
        observation_kind: observation.observation_kind,
        value_kind: observation.value_kind,
      });
      observationsByEvent.set(observation.medical_event_id, eventObservations);
    }

    for (const eventDate of eventDates.data ?? []) {
      const dates = datesByEvent.get(eventDate.medical_event_id) ?? [];
      dates.push({
        date_role: eventDate.date_role,
        precision: eventDate.precision,
        value_text: eventDate.value_text,
        raw_text: eventDate.raw_text,
        timezone: eventDate.timezone,
      });
      datesByEvent.set(eventDate.medical_event_id, dates);
    }
  }

  return NextResponse.json(
    {
      timeline: rows.map((row) => ({
        ...row,
        dates: datesByEvent.get(row.event_id) ?? [],
        observations: observationsByEvent.get(row.event_id) ?? [],
      })),
      direction,
      limit,
      offset,
      has_more: rows.length === limit,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  if (isHealthTimelinePageRequest(request)) {
    return getHealthTimelinePage(request);
  }
  return getNormalizedTimeline(request);
}
