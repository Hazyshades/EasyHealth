import type {
  AuthorizedReportSource,
  ReportCitationValidationContext,
  ReportCandidateContent,
} from "../../src/lib/report-citation-validator";

export const PROFILE_A = "profile-a";
export const PROFILE_B = "profile-b";
export const DOCUMENT_A = "document-a";
export const DOCUMENT_B = "document-b";

export const SOURCE_SUMMARY = "source-summary";
export const SOURCE_OBSERVATION = "source-observation";

export const VALID_REPORT_CONTENT: ReportCandidateContent = {
  schema_version: "eh148.v1",
  report_kind: "doctor_visit_brief",
  generated_at: "2026-09-22T12:00:00.000Z",
  detail_level: "standard",
  source_document_ids: [DOCUMENT_A],
  sections: [
    {
      id: "document_summary",
      items: [{ type: "claim_ref", claim_id: "claim-summary" }],
    },
    {
      id: "latest_measurements",
      items: [{ type: "claim_ref", claim_id: "claim-observation" }],
    },
    {
      id: "changes",
      items: [],
      empty_state: "insufficient_evidence",
    },
    {
      id: "clinician_questions",
      items: [{ type: "claim_ref", claim_id: "claim-question" }],
    },
    {
      id: "limitations",
      items: [],
      empty_state: "no_data",
    },
    {
      id: "source_ledger",
      items: [
        { type: "source_ref", source_id: SOURCE_SUMMARY },
        { type: "source_ref", source_id: SOURCE_OBSERVATION },
      ],
    },
  ],
  claims: [
    {
      id: "claim-summary",
      section: "document_summary",
      kind: "source_fact",
      origin: "generated",
      citations: [{ source_id: SOURCE_SUMMARY, document_id: DOCUMENT_A }],
      factual: true,
      status: "supported",
      template_id: "source_fact_snapshot",
      template_params: { source_id: SOURCE_SUMMARY, include_date: true },
    },
    {
      id: "claim-observation",
      section: "latest_measurements",
      kind: "numeric_observation",
      origin: "generated",
      citations: [{ source_id: SOURCE_OBSERVATION, document_id: DOCUMENT_A }],
      factual: true,
      status: "supported",
      template_id: "numeric_observation_snapshot",
      template_params: { source_id: SOURCE_OBSERVATION, include_range: true },
    },
    {
      id: "claim-question",
      section: "clinician_questions",
      kind: "clinician_question",
      origin: "user_selected",
      citations: [],
      factual: false,
      status: "supported",
      question_text: "What should I ask about this result?",
    },
  ],
  sources: [
    {
      source_id: SOURCE_SUMMARY,
      kind: "document_summary",
      document_id: DOCUMENT_A,
    },
    {
      source_id: SOURCE_OBSERVATION,
      kind: "observation",
      document_id: DOCUMENT_A,
    },
  ],
  limitations: [],
  disclaimer:
    "Educational information only. Discuss this report with a clinician.",
};

export const VALID_AUTHORIZED_SOURCES: readonly AuthorizedReportSource[] = [
  {
    source_id: SOURCE_SUMMARY,
    source_row_id: "row-summary",
    profile_id: PROFILE_A,
    kind: "document_summary",
    document_id: DOCUMENT_A,
    snapshot: { text: "Trusted synthetic document summary." },
    source_status: "active",
    document_status: "active",
  },
  {
    source_id: SOURCE_OBSERVATION,
    source_row_id: "row-observation",
    profile_id: PROFILE_A,
    kind: "observation",
    document_id: DOCUMENT_A,
    snapshot: {
      label: "Trusted synthetic observation",
      value: 5,
      unit: "units",
    },
    source_status: "active",
    document_status: "active",
  },
];

export function makeValidationContext(
  rows: readonly AuthorizedReportSource[] = VALID_AUTHORIZED_SOURCES,
  options: {
    profileId?: string;
    documentScope?: readonly string[] | null;
  } = {},
): ReportCitationValidationContext {
  const profileId = options.profileId ?? PROFILE_A;
  const documentScope =
    options.documentScope === undefined ? [DOCUMENT_A] : options.documentScope;
  return {
    profile_id: profileId,
    document_scope: documentScope,
    resolve_sources: (sourceIds) =>
      rows.filter((row) => sourceIds.includes(row.source_id)),
  };
}

export function cloneReportContent(): ReportCandidateContent {
  return JSON.parse(
    JSON.stringify(VALID_REPORT_CONTENT),
  ) as ReportCandidateContent;
}
