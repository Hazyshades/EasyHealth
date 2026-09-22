import { z } from "zod";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

export const REPORT_CONTRACT_VERSION = "eh148.v1" as const;
export const REPORT_KIND = "doctor_visit_brief" as const;
export const REPORT_VALIDATION_VERSION = "eh150.v1" as const;

export const REPORT_SECTION_IDS = [
  "document_summary",
  "latest_measurements",
  "changes",
  "clinician_questions",
  "limitations",
  "source_ledger",
] as const;
export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number];

export const REPORT_SOURCE_KINDS = [
  "observation",
  "finding",
  "clinical_note",
  "prescription",
  "referral",
  "document_summary",
] as const;
export type ReportSourceKind = (typeof REPORT_SOURCE_KINDS)[number];

export const REPORT_CLAIM_KINDS = [
  "source_fact",
  "numeric_observation",
  "clinician_question",
] as const;
export type ReportClaimKind = (typeof REPORT_CLAIM_KINDS)[number];

export const REPORT_EMPTY_STATES = [
  "no_data",
  "not_applicable",
  "insufficient_evidence",
] as const;
export type ReportEmptyState = (typeof REPORT_EMPTY_STATES)[number];

export const REPORT_CLAIM_STATUSES = ["supported", "limited"] as const;
export type ReportClaimStatus = (typeof REPORT_CLAIM_STATUSES)[number];

export const REPORT_QUESTION_ORIGINS = ["generated", "user_selected"] as const;
export type ReportQuestionOrigin = (typeof REPORT_QUESTION_ORIGINS)[number];

export const REPORT_TEMPLATE_IDS = [
  "source_fact_snapshot",
  "numeric_observation_snapshot",
] as const;
export type ReportTemplateId = (typeof REPORT_TEMPLATE_IDS)[number];

export const REPORT_DETAIL_LEVELS = [
  "compact",
  "standard",
  "detailed",
  "full",
] as const;
export type ReportDetailLevel = (typeof REPORT_DETAIL_LEVELS)[number];

export const REPORT_VALIDATION_STATUSES = ["valid", "limited"] as const;
export type ReportValidationStatus =
  (typeof REPORT_VALIDATION_STATUSES)[number];

export const REPORT_VALIDATION_ISSUE_CODES = [
  "SCHEMA_INVALID",
  "SOURCE_NOT_FOUND",
  "SOURCE_UNAVAILABLE",
  "TEMPLATE_INVALID",
  "EMPTY_FACTUAL_CLAIM",
  "UNSAFE_CONTENT",
  "SCOPE_CONFLICT",
  "VALIDATION_ENVELOPE_INVALID",
] as const;
export type ReportValidationIssueCode =
  (typeof REPORT_VALIDATION_ISSUE_CODES)[number];

export type ReportRequestedScope =
  | { kind: "all_eligible"; document_ids: null }
  | { kind: "explicit"; document_ids: string[] };

export type ReportEvidenceRef = {
  source_id: string;
  document_id: string;
};

export type ObservationSourceSnapshot = {
  kind: "observation";
  label: string;
  observed_at: string | null;
  value: number | null;
  value_text: string | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
};

export type FindingSourceSnapshot = {
  kind: "finding";
  label: string;
  observed_at: string | null;
  finding_text: string;
  impression: string | null;
};

export type ClinicalNoteSourceSnapshot = {
  kind: "clinical_note";
  label: string;
  observed_at: string | null;
  provider_name: string | null;
  summary: string | null;
};

export type PrescriptionSourceSnapshot = {
  kind: "prescription";
  label: string;
  observed_at: string | null;
  prescriber_name: string | null;
  summary: string | null;
};

export type ReferralSourceSnapshot = {
  kind: "referral";
  label: string;
  observed_at: string | null;
  referring_provider: string | null;
  referred_to_specialty: string | null;
  summary: string | null;
};

export type DocumentSummarySourceSnapshot = {
  kind: "document_summary";
  label: string;
  observed_at: string | null;
  document_type: string;
  summary: string;
};

export type ReportSourceSnapshot =
  | ObservationSourceSnapshot
  | FindingSourceSnapshot
  | ClinicalNoteSourceSnapshot
  | PrescriptionSourceSnapshot
  | ReferralSourceSnapshot
  | DocumentSummarySourceSnapshot;

export type ReportSource = {
  source_id: string;
  kind: ReportSourceKind;
  document_id: string;
  snapshot: ReportSourceSnapshot;
};

type ClaimBase = {
  id: string;
  section: Exclude<ReportSectionId, "limitations" | "source_ledger">;
  citations: ReportEvidenceRef[];
  status: ReportClaimStatus;
};

export type SourceFactClaim = ClaimBase & {
  kind: "source_fact";
  origin: "generated";
  factual: true;
  template_id: "source_fact_snapshot";
  template_params: {
    source_id: string;
    include_date: boolean;
  };
  text: string;
};

export type NumericObservationClaim = ClaimBase & {
  kind: "numeric_observation";
  origin: "generated";
  factual: true;
  template_id: "numeric_observation_snapshot";
  template_params: {
    source_id: string;
    include_range: boolean;
  };
  text: string;
};

export type ClinicianQuestionClaim = ClaimBase & {
  section: "clinician_questions";
  kind: "clinician_question";
  origin: ReportQuestionOrigin;
  factual: false;
  citations: [];
  question_text: string;
};

export type ReportClaim =
  | SourceFactClaim
  | NumericObservationClaim
  | ClinicianQuestionClaim;

type ClaimCandidateBase = Omit<ClaimBase, never>;

export type SourceFactClaimCandidate = ClaimCandidateBase & {
  kind: "source_fact";
  origin: "generated";
  factual: true;
  template_id: "source_fact_snapshot";
  template_params: {
    source_id: string;
    include_date: boolean;
  };
};

export type NumericObservationClaimCandidate = ClaimCandidateBase & {
  kind: "numeric_observation";
  origin: "generated";
  factual: true;
  template_id: "numeric_observation_snapshot";
  template_params: {
    source_id: string;
    include_range: boolean;
  };
};

export type ClinicianQuestionClaimCandidate = Omit<
  ClinicianQuestionClaim,
  "question_text"
> & {
  question_text: string;
};

export type ReportClaimCandidate =
  | SourceFactClaimCandidate
  | NumericObservationClaimCandidate
  | ClinicianQuestionClaimCandidate;

export type ReportSectionItem =
  | { type: "claim_ref"; claim_id: string }
  | { type: "limitation_ref"; limitation_id: string }
  | { type: "source_ref"; source_id: string };

export type ReportSection = {
  id: ReportSectionId;
  items: ReportSectionItem[];
  empty_state?: ReportEmptyState;
};

export type ReportLimitation = {
  id: string;
  code: string;
  message: string;
};

export type ReportValidationEnvelope = {
  status: ReportValidationStatus;
  version: string;
  issue_codes: ReportValidationIssueCode[];
};

export type DoctorVisitBrief = {
  schema_version: typeof REPORT_CONTRACT_VERSION;
  report_kind: typeof REPORT_KIND;
  generated_at: string;
  detail_level: ReportDetailLevel;
  requested_scope: ReportRequestedScope;
  source_document_ids: string[];
  sections: ReportSection[];
  claims: ReportClaim[];
  sources: ReportSource[];
  limitations: ReportLimitation[];
  disclaimer: typeof MEDICAL_DISCLAIMER;
  validation: ReportValidationEnvelope;
  overview: string;
  extensions?: {
    biomarker_dynamics?: unknown;
  };
};

const uuidSchema = z.string().uuid();
const sourceIdSchema = z.string().min(8).max(128);
const claimIdSchema = z.string().min(1).max(128);
const sectionIdSchema = z.enum(REPORT_SECTION_IDS);
const sourceKindSchema = z.enum(REPORT_SOURCE_KINDS);
const emptyStateSchema = z.enum(REPORT_EMPTY_STATES);
const claimStatusSchema = z.enum(REPORT_CLAIM_STATUSES);
const questionOriginSchema = z.enum(REPORT_QUESTION_ORIGINS);
const detailLevelSchema = z.enum(REPORT_DETAIL_LEVELS);

const evidenceRefSchema = z.object({
  source_id: sourceIdSchema,
  document_id: uuidSchema,
});

const sourceSnapshotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("observation"),
    label: z.string().min(1),
    observed_at: z.string().nullable(),
    value: z.number().finite().nullable(),
    value_text: z.string().nullable(),
    unit: z.string(),
    ref_low: z.number().finite().nullable(),
    ref_high: z.number().finite().nullable(),
  }),
  z.object({
    kind: z.literal("finding"),
    label: z.string().min(1),
    observed_at: z.string().nullable(),
    finding_text: z.string().min(1),
    impression: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("clinical_note"),
    label: z.string().min(1),
    observed_at: z.string().nullable(),
    provider_name: z.string().nullable(),
    summary: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("prescription"),
    label: z.string().min(1),
    observed_at: z.string().nullable(),
    prescriber_name: z.string().nullable(),
    summary: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("referral"),
    label: z.string().min(1),
    observed_at: z.string().nullable(),
    referring_provider: z.string().nullable(),
    referred_to_specialty: z.string().nullable(),
    summary: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("document_summary"),
    label: z.string().min(1),
    observed_at: z.string().nullable(),
    document_type: z.string().min(1),
    summary: z.string().min(1),
  }),
]);

const sourceSchema = z.object({
  source_id: sourceIdSchema,
  kind: sourceKindSchema,
  document_id: uuidSchema,
  snapshot: sourceSnapshotSchema,
});

const sourceFactTemplateSchema = z.object({
  source_id: sourceIdSchema,
  include_date: z.boolean(),
});

const numericObservationTemplateSchema = z.object({
  source_id: sourceIdSchema,
  include_range: z.boolean(),
});

const claimCandidateSchema = z.discriminatedUnion("kind", [
  z.object({
    id: claimIdSchema,
    section: sectionIdSchema,
    kind: z.literal("source_fact"),
    origin: z.literal("generated"),
    factual: z.literal(true),
    citations: z.array(evidenceRefSchema),
    status: claimStatusSchema,
    template_id: z.literal("source_fact_snapshot"),
    template_params: sourceFactTemplateSchema,
  }),
  z.object({
    id: claimIdSchema,
    section: sectionIdSchema,
    kind: z.literal("numeric_observation"),
    origin: z.literal("generated"),
    factual: z.literal(true),
    citations: z.array(evidenceRefSchema),
    status: claimStatusSchema,
    template_id: z.literal("numeric_observation_snapshot"),
    template_params: numericObservationTemplateSchema,
  }),
  z.object({
    id: claimIdSchema,
    section: z.literal("clinician_questions"),
    kind: z.literal("clinician_question"),
    origin: questionOriginSchema,
    factual: z.literal(false),
    citations: z.array(evidenceRefSchema).length(0),
    status: claimStatusSchema,
    question_text: z.string().min(1).max(240),
  }),
]);

const claimSchema = z.discriminatedUnion("kind", [
  z.object({
    id: claimIdSchema,
    section: sectionIdSchema,
    kind: z.literal("source_fact"),
    origin: z.literal("generated"),
    factual: z.literal(true),
    citations: z.array(evidenceRefSchema),
    status: claimStatusSchema,
    template_id: z.literal("source_fact_snapshot"),
    template_params: sourceFactTemplateSchema,
    text: z.string().min(1),
  }),
  z.object({
    id: claimIdSchema,
    section: sectionIdSchema,
    kind: z.literal("numeric_observation"),
    origin: z.literal("generated"),
    factual: z.literal(true),
    citations: z.array(evidenceRefSchema),
    status: claimStatusSchema,
    template_id: z.literal("numeric_observation_snapshot"),
    template_params: numericObservationTemplateSchema,
    text: z.string().min(1),
  }),
  z.object({
    id: claimIdSchema,
    section: z.literal("clinician_questions"),
    kind: z.literal("clinician_question"),
    origin: questionOriginSchema,
    factual: z.literal(false),
    citations: z.array(evidenceRefSchema).length(0),
    status: claimStatusSchema,
    question_text: z.string().min(1).max(240),
  }),
]);

const sectionItemSchema = z.union([
  z.object({ type: z.literal("claim_ref"), claim_id: claimIdSchema }),
  z.object({ type: z.literal("limitation_ref"), limitation_id: claimIdSchema }),
  z.object({ type: z.literal("source_ref"), source_id: sourceIdSchema }),
]);

const sectionSchema = z.object({
  id: sectionIdSchema,
  items: z.array(sectionItemSchema),
  empty_state: emptyStateSchema.optional(),
});

const limitationSchema = z.object({
  id: claimIdSchema,
  code: z.string().regex(/^[A-Z0-9_]+$/),
  message: z.string().min(1),
});

const validationSchema = z.object({
  status: z.enum(REPORT_VALIDATION_STATUSES),
  version: z.string().min(1),
  issue_codes: z.array(z.enum(REPORT_VALIDATION_ISSUE_CODES)),
});

const requestedScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_eligible"), document_ids: z.null() }),
  z.object({
    kind: z.literal("explicit"),
    document_ids: z.array(uuidSchema).min(1),
  }),
]);

export const doctorVisitBriefCandidateSchema = z.object({
  schema_version: z.literal(REPORT_CONTRACT_VERSION),
  report_kind: z.literal(REPORT_KIND),
  generated_at: z.string().datetime({ offset: true }),
  detail_level: detailLevelSchema,
  requested_scope: requestedScopeSchema,
  source_document_ids: z.array(uuidSchema),
  sections: z.array(sectionSchema),
  claims: z.array(claimCandidateSchema),
  sources: z.array(sourceSchema),
  limitations: z.array(limitationSchema),
});

export const doctorVisitBriefSchema = doctorVisitBriefCandidateSchema.extend({
  claims: z.array(claimSchema),
  disclaimer: z.literal(MEDICAL_DISCLAIMER),
  validation: validationSchema,
  overview: z.string().min(1),
  extensions: z
    .object({ biomarker_dynamics: z.unknown().optional() })
    .optional(),
});

export function normalizeUserSelectedQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("questions_must_be_an_array");
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") throw new Error("question_must_be_text");
    const question = item.normalize("NFC").trim();
    const scalarLength = [...question].length;
    if (
      scalarLength < 1 ||
      scalarLength > 240 ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(question)
    ) {
      throw new Error("question_is_invalid");
    }
    if (seen.has(question)) throw new Error("questions_must_be_unique");
    seen.add(question);
    normalized.push(question);
  }

  if (normalized.length > 5) throw new Error("too_many_questions");
  return normalized;
}

export function parseInclusiveUtcDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error("date_must_be_canonical_utc_calendar_date");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("date_must_be_canonical_utc_calendar_date");
  }
  return value;
}

export function parseReportDateRange(
  value: unknown,
): { start: string; end: string } | null {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("report_date_range_is_invalid");
  }
  const input = value as { start?: unknown; end?: unknown };
  const start = parseInclusiveUtcDate(input.start);
  const end = parseInclusiveUtcDate(input.end);
  if (start > end) throw new Error("report_date_range_is_reversed");
  return { start, end };
}

export function utcCalendarDate(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function isDateInInclusiveRange(
  value: string | null | undefined,
  range: { start: string; end: string } | null,
): boolean {
  if (!range) return true;
  const date = utcCalendarDate(value);
  return date !== null && date >= range.start && date <= range.end;
}

export function assertDoctorVisitBrief(value: unknown): DoctorVisitBrief {
  const parsed = doctorVisitBriefSchema.safeParse(value);
  if (!parsed.success) throw new Error("REPORT_CONTRACT_INVALID");

  const brief = parsed.data;
  if (
    brief.sections.length !== REPORT_SECTION_IDS.length ||
    brief.sections.some(
      (section, index) => section.id !== REPORT_SECTION_IDS[index],
    )
  ) {
    throw new Error("REPORT_SECTIONS_INVALID");
  }

  const sourceById = new Map(
    brief.sources.map((source) => [source.source_id, source]),
  );
  if (sourceById.size !== brief.sources.length)
    throw new Error("REPORT_SOURCES_DUPLICATED");
  if (
    new Set(brief.source_document_ids).size !== brief.source_document_ids.length
  ) {
    throw new Error("REPORT_SCOPE_DUPLICATED");
  }
  if (brief.requested_scope.kind === "explicit") {
    const requestedIds = new Set(brief.requested_scope.document_ids);
    if (
      requestedIds.size !== brief.requested_scope.document_ids.length ||
      requestedIds.size !== brief.source_document_ids.length ||
      brief.source_document_ids.some(
        (documentId) => !requestedIds.has(documentId),
      )
    ) {
      throw new Error("REPORT_REQUESTED_SCOPE_INVALID");
    }
  }

  const claimById = new Map(brief.claims.map((claim) => [claim.id, claim]));
  if (claimById.size !== brief.claims.length)
    throw new Error("REPORT_CLAIMS_DUPLICATED");
  const claimReferences = new Map<string, number>();
  const limitationReferences = new Map<string, number>();
  const sourceReferences = new Map<string, number>();

  for (const section of brief.sections) {
    if (section.items.length === 0 && !section.empty_state) {
      throw new Error("REPORT_EMPTY_SECTION_STATE_REQUIRED");
    }
    if (section.items.length > 0 && section.empty_state) {
      throw new Error("REPORT_NONEMPTY_SECTION_STATE_FORBIDDEN");
    }

    for (const item of section.items) {
      if (item.type === "claim_ref") {
        const claim = claimById.get(item.claim_id);
        if (!claim) throw new Error("REPORT_CLAIM_REFERENCE_UNKNOWN");
        if (claim.section !== section.id)
          throw new Error("REPORT_CLAIM_SECTION_MISMATCH");
        claimReferences.set(
          item.claim_id,
          (claimReferences.get(item.claim_id) ?? 0) + 1,
        );
      } else if (item.type === "limitation_ref") {
        if (section.id !== "limitations")
          throw new Error("REPORT_LIMITATION_SECTION_MISMATCH");
        if (
          !brief.limitations.some(
            (limitation) => limitation.id === item.limitation_id,
          )
        ) {
          throw new Error("REPORT_LIMITATION_REFERENCE_UNKNOWN");
        }
        limitationReferences.set(
          item.limitation_id,
          (limitationReferences.get(item.limitation_id) ?? 0) + 1,
        );
      } else {
        if (section.id !== "source_ledger")
          throw new Error("REPORT_SOURCE_SECTION_MISMATCH");
        if (!sourceById.has(item.source_id))
          throw new Error("REPORT_SOURCE_REFERENCE_UNKNOWN");
        sourceReferences.set(
          item.source_id,
          (sourceReferences.get(item.source_id) ?? 0) + 1,
        );
      }
    }
  }

  for (const claim of brief.claims) {
    if ((claimReferences.get(claim.id) ?? 0) !== 1) {
      throw new Error("REPORT_CLAIM_REFERENCE_CARDINALITY_INVALID");
    }
    if (claim.kind === "clinician_question") continue;
    if (claim.citations.length === 0)
      throw new Error("REPORT_FACT_CITATION_REQUIRED");
    const citedIds = new Set(
      claim.citations.map((citation) => citation.source_id),
    );
    if (!citedIds.has(claim.template_params.source_id)) {
      throw new Error("REPORT_TEMPLATE_SOURCE_NOT_CITED");
    }
    for (const citation of claim.citations) {
      const source = sourceById.get(citation.source_id);
      if (!source || source.document_id !== citation.document_id) {
        throw new Error("REPORT_CITATION_INVALID");
      }
      if (!brief.source_document_ids.includes(citation.document_id)) {
        throw new Error("REPORT_CITATION_OUT_OF_SCOPE");
      }
    }
    if (claim.kind === "numeric_observation") {
      const source = sourceById.get(claim.template_params.source_id);
      if (!source || source.kind !== "observation") {
        throw new Error("REPORT_TEMPLATE_SOURCE_KIND_INVALID");
      }
    }
  }

  for (const source of brief.sources) {
    if ((sourceReferences.get(source.source_id) ?? 0) !== 1) {
      throw new Error("REPORT_SOURCE_REFERENCE_CARDINALITY_INVALID");
    }
    if (source.kind !== source.snapshot.kind)
      throw new Error("REPORT_SOURCE_SNAPSHOT_KIND_INVALID");
    if (!brief.source_document_ids.includes(source.document_id)) {
      throw new Error("REPORT_SOURCE_OUT_OF_SCOPE");
    }
  }

  for (const limitation of brief.limitations) {
    if ((limitationReferences.get(limitation.id) ?? 0) !== 1) {
      throw new Error("REPORT_LIMITATION_REFERENCE_CARDINALITY_INVALID");
    }
  }

  return brief as DoctorVisitBrief;
}
