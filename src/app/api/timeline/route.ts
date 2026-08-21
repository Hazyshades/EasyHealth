import { NextRequest } from "next/server";
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

export async function GET(request: NextRequest) {
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
