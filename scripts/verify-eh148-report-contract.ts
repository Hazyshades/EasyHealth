import assert from "node:assert/strict";
import {
  assertDoctorVisitBrief,
  assertDoctorVisitBriefCandidate,
  normalizeUserSelectedQuestions,
  parseReportDateRange,
  isDateInInclusiveRange,
  type DoctorVisitBrief,
} from "@/lib/report-contract";
import {
  buildReportEvidenceProjection,
  materializeReportEvidenceMappings,
  type ReportEvidenceProjection,
} from "@/lib/report-evidence";
import { prepareDoctorVisitBrief } from "@/lib/report-safety-policy";
import type { MultiSourceReportContext } from "@/lib/reports";
import type { ReportSourceKind } from "@/lib/report-contract";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

const documentIds = {
  lab: "00000000-0000-4000-8000-000000000101",
  imaging: "00000000-0000-4000-8000-000000000102",
  consultation: "00000000-0000-4000-8000-000000000103",
  prescription: "00000000-0000-4000-8000-000000000104",
  referral: "00000000-0000-4000-8000-000000000105",
  summary: "00000000-0000-4000-8000-000000000106",
};

const context: MultiSourceReportContext = {
  biomarkers: [
    {
      source_row_id: "00000000-0000-4000-8000-000000000201",
      document_id: documentIds.lab,
      biomarker: "Glucose",
      analyte_key: "glucose",
      measurement_definition_key: "glucose.serum.numeric",
      resolution_status: "resolved",
      verification_status: "verified",
      decision_source: "persisted",
      decision_quality: "available",
      decision_not_persisted: false,
      decision_quality_codes: [],
      registry_binding_ready: true,
      value_kind: "numeric",
      value_text: "5.4",
      value: 5.4,
      unit: "mmol/L",
      ref_low: 3.9,
      ref_high: 5.5,
      observed_at: "2026-09-10",
      source: "lab.pdf",
    },
  ],
  instrumental_findings: [
    {
      source_row_id: "00000000-0000-4000-8000-000000000202",
      document_id: documentIds.imaging,
      filename: "imaging.pdf",
      modality: "MRI",
      body_region: "knee",
      finding_text: "Synthetic finding",
      impression: "Synthetic impression",
      study_date: "2026-09-11",
    },
  ],
  consultation_notes: [
    {
      source_row_id: "00000000-0000-4000-8000-000000000203",
      document_id: documentIds.consultation,
      filename: "consultation.pdf",
      provider_name: "Synthetic clinic",
      visit_date: "2026-09-12",
      chief_complaint: "Synthetic complaint",
      documented_problems: [],
      recommendations: [],
      follow_up_plan: null,
      summary: "Synthetic consultation summary",
    },
  ],
  discharge_summaries: [],
  prescriptions: [
    {
      source_row_id: "00000000-0000-4000-8000-000000000204",
      document_id: documentIds.prescription,
      filename: "prescription.pdf",
      prescriber_name: "Synthetic prescriber",
      prescribed_at: "2026-09-13",
      medications: [],
      summary: "Synthetic prescription summary",
    },
  ],
  referrals: [
    {
      source_row_id: "00000000-0000-4000-8000-000000000205",
      document_id: documentIds.referral,
      filename: "referral.pdf",
      referring_provider: "Synthetic provider",
      referred_to_specialty: "Synthetic specialty",
      referred_to_provider: null,
      referral_date: "2026-09-14",
      reason_for_referral: "Synthetic reason",
      clinical_summary: "Synthetic referral summary",
      urgency: null,
    },
  ],
  document_summaries: [
    {
      source_row_id: documentIds.summary,
      document_id: documentIds.summary,
      filename: "summary.pdf",
      document_type: "lab_result",
      observed_at: "2026-09-16",
      summary: "Synthetic document summary",
    },
  ],
};

const projection: ReportEvidenceProjection =
  buildReportEvidenceProjection(context);
assert.equal(projection.sources.length, 6);
assert.equal(projection.mappings.length, 6);
const materializedMappings = materializeReportEvidenceMappings(
  "00000000-0000-4000-8000-000000000199",
  projection,
);
assert(
  materializedMappings.every((mapping) => mapping.report_id.endsWith("0199")),
);
assert.deepEqual(projection.source_document_ids, Object.values(documentIds));
assert(
  projection.sources.every((source) =>
    /^src_[0-9a-f]{32}$/u.test(source.source_id),
  ),
);
assert(
  projection.sources.every(
    (source) => !JSON.stringify(source).includes("profile_id"),
  ),
);
assert(
  projection.sources.every(
    (source) => !JSON.stringify(source).includes("storage_path"),
  ),
);

const sourceByKind = new Map(
  projection.sources.map((source) => [source.kind, source]),
);
const referenceFor = (kind: ReportSourceKind) => {
  const source = sourceByKind.get(kind);
  assert(source);
  return { source_id: source.source_id, document_id: source.document_id };
};

const observationRef = referenceFor("observation");
const findingRef = referenceFor("finding");
const noteRef = referenceFor("clinical_note");
const prescriptionRef = referenceFor("prescription");
const referralRef = referenceFor("referral");
const summaryRef = referenceFor("document_summary");

const brief: DoctorVisitBrief = {
  schema_version: "eh148.v1",
  report_kind: "doctor_visit_brief",
  generated_at: "2026-09-18T12:00:00.000Z",
  detail_level: "standard",
  requested_scope: { kind: "all_eligible", document_ids: null },
  source_document_ids: projection.source_document_ids,
  sources: projection.sources,
  claims: [
    {
      id: "claim-glucose",
      section: "latest_measurements",
      kind: "numeric_observation",
      origin: "generated",
      factual: true,
      citations: [observationRef],
      status: "supported",
      template_id: "numeric_observation_snapshot",
      template_params: {
        source_id: observationRef.source_id,
        include_range: true,
      },
      text: "Glucose: 5.4 mmol/L (reference 3.9–5.5).",
    },
    {
      id: "claim-finding",
      section: "document_summary",
      kind: "source_fact",
      origin: "generated",
      factual: true,
      citations: [findingRef],
      status: "supported",
      template_id: "source_fact_snapshot",
      template_params: { source_id: findingRef.source_id, include_date: true },
      text: "Synthetic finding.",
    },
    {
      id: "claim-note",
      section: "document_summary",
      kind: "source_fact",
      origin: "generated",
      factual: true,
      citations: [noteRef],
      status: "supported",
      template_id: "source_fact_snapshot",
      template_params: { source_id: noteRef.source_id, include_date: true },
      text: "Synthetic consultation summary.",
    },
    {
      id: "claim-prescription",
      section: "document_summary",
      kind: "source_fact",
      origin: "generated",
      factual: true,
      citations: [prescriptionRef],
      status: "supported",
      template_id: "source_fact_snapshot",
      template_params: {
        source_id: prescriptionRef.source_id,
        include_date: true,
      },
      text: "Synthetic prescription summary.",
    },
    {
      id: "claim-referral",
      section: "changes",
      kind: "source_fact",
      origin: "generated",
      factual: true,
      citations: [referralRef],
      status: "supported",
      template_id: "source_fact_snapshot",
      template_params: { source_id: referralRef.source_id, include_date: true },
      text: "Synthetic referral summary.",
    },
    {
      id: "claim-summary",
      section: "document_summary",
      kind: "source_fact",
      origin: "generated",
      factual: true,
      citations: [summaryRef],
      status: "supported",
      template_id: "source_fact_snapshot",
      template_params: { source_id: summaryRef.source_id, include_date: false },
      text: "Synthetic document summary.",
    },
    {
      id: "question-user",
      section: "clinician_questions",
      kind: "clinician_question",
      origin: "user_selected",
      factual: false,
      citations: [],
      status: "supported",
      question_text: "What should I discuss about these results?",
    },
  ],
  sections: [
    {
      id: "document_summary",
      items: [
        { type: "claim_ref", claim_id: "claim-finding" },
        { type: "claim_ref", claim_id: "claim-note" },
        { type: "claim_ref", claim_id: "claim-prescription" },
        { type: "claim_ref", claim_id: "claim-summary" },
      ],
    },
    {
      id: "latest_measurements",
      items: [{ type: "claim_ref", claim_id: "claim-glucose" }],
    },
    {
      id: "changes",
      items: [{ type: "claim_ref", claim_id: "claim-referral" }],
    },
    {
      id: "clinician_questions",
      items: [{ type: "claim_ref", claim_id: "question-user" }],
    },
    {
      id: "limitations",
      items: [{ type: "limitation_ref", limitation_id: "lim-no-trend" }],
    },
    {
      id: "source_ledger",
      items: projection.sources.map((source) => ({
        type: "source_ref" as const,
        source_id: source.source_id,
      })),
    },
  ],
  limitations: [
    {
      id: "lim-no-trend",
      code: "INSUFFICIENT_HISTORY",
      message: "A longitudinal comparison is unavailable for this scope.",
    },
  ],
  disclaimer: MEDICAL_DISCLAIMER,
  validation: { status: "valid", version: "eh150.v1", issue_codes: [] },
  overview: "Synthetic source-grounded overview.",
};

assert.equal(assertDoctorVisitBrief(brief).overview, brief.overview);
assert.deepEqual(normalizeUserSelectedQuestions(["  What changed?  "]), [
  "What changed?",
]);
assert.throws(
  () => normalizeUserSelectedQuestions(["line\nbreak"]),
  /question_is_invalid/,
);
assert.deepEqual(
  parseReportDateRange({ start: "2026-09-10", end: "2026-09-10" }),
  {
    start: "2026-09-10",
    end: "2026-09-10",
  },
);
assert.equal(
  isDateInInclusiveRange("2026-09-10T23:59:59.999Z", {
    start: "2026-09-10",
    end: "2026-09-10",
  }),
  true,
);

const {
  disclaimer: _disclaimer,
  validation: _validation,
  overview: _overview,
  ...candidateEnvelope
} = brief;
const candidate = {
  ...candidateEnvelope,
  claims: brief.claims.map((claim) => {
    if (claim.kind === "clinician_question") {
      return { ...claim, origin: "generated" as const };
    }
    const { text: _text, ...withoutText } = claim;
    return withoutText;
  }),
  limitations: [{ id: "lim-no-trend", code: "NO_COMPARABLE_HISTORY" }],
};
assert.equal(assertDoctorVisitBriefCandidate(candidate).claims.length, 7);
const prepared = prepareDoctorVisitBrief({
  candidate,
  projection,
  requested_scope: brief.requested_scope,
  detail_level: brief.detail_level,
  generated_at: brief.generated_at,
  user_questions: ["What changed?"],
});
assert.equal(prepared.status, "limited");
assert(prepared.issue_codes.includes("EMPTY_FACTUAL_CLAIM"));
assert.equal(
  prepared.brief.claims.find(
    (claim) =>
      claim.kind === "clinician_question" &&
      claim.question_text === "What changed?",
  )?.origin,
  "user_selected",
);
const sourceFactText = prepared.brief.claims
  .filter(
    (claim): claim is Extract<typeof claim, { kind: "source_fact" }> =>
      claim.kind === "source_fact",
  )
  .map((claim) => claim.text)
  .join("\n");
for (const sourceText of [
  "Synthetic finding",
  "Synthetic consultation summary",
  "Synthetic prescription summary",
  "Synthetic referral summary",
  "Synthetic document summary",
]) {
  assert(!sourceFactText.includes(sourceText));
}

const factualCandidate = candidate.claims.find(
  (claim) => claim.kind !== "clinician_question",
);
assert(factualCandidate);
const unsafeCandidate = {
  ...candidate,
  claims: candidate.claims.map((claim) =>
    claim.id === factualCandidate.id ? { ...claim, text: "model fact" } : claim,
  ),
};
assert.throws(
  () => assertDoctorVisitBriefCandidate(unsafeCandidate),
  /REPORT_CANDIDATE_INVALID/,
);

const imperativeCandidate = structuredClone(candidate);
const imperativeQuestion = imperativeCandidate.claims.find(
  (claim) => claim.kind === "clinician_question",
);
assert(imperativeQuestion && imperativeQuestion.kind === "clinician_question");
imperativeQuestion.question_text = "Start taking a new medicine immediately?";
assert.throws(
  () =>
    prepareDoctorVisitBrief({
      candidate: imperativeCandidate,
      projection,
      requested_scope: brief.requested_scope,
      detail_level: brief.detail_level,
      generated_at: brief.generated_at,
    }),
  /REPORT_CANDIDATE_IMPERATIVE_TEXT/,
);
assert.throws(
  () =>
    prepareDoctorVisitBrief({
      candidate,
      projection,
      requested_scope: brief.requested_scope,
      detail_level: brief.detail_level,
      generated_at: brief.generated_at,
      user_questions: ["Please schedule an appointment?"],
    }),
  /REPORT_USER_QUESTION_IMPERATIVE_TEXT/,
);

const unknownCitation = structuredClone(brief);
const unknownClaim = unknownCitation.claims.find(
  (claim) => claim.id === "claim-glucose",
);
assert(unknownClaim && unknownClaim.kind !== "clinician_question");
unknownClaim.citations = [
  {
    source_id: "src_ffffffffffffffffffffffffffffffff",
    document_id: documentIds.lab,
  },
];
assert.throws(
  () => assertDoctorVisitBrief(unknownCitation),
  /REPORT_(?:TEMPLATE_SOURCE_NOT_CITED|CITATION_INVALID)/,
);

console.log("verify-eh148-report-contract: all checks passed");
