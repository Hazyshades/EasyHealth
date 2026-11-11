import { z } from "zod";

export const ASSISTANT_MODES = [
  "personal_facts",
  "grounded_summary",
  "general_education",
  "refusal",
] as const;
export type AssistantMode = (typeof ASSISTANT_MODES)[number];

export const ASSISTANT_LIMITATION_CODES = [
  "NO_PERSONAL_EVIDENCE",
  "UNSUPPORTED_CLAIM",
  "UNSAFE_REQUEST",
  "MEDICATION_SAFETY",
  "GENERAL_INFORMATION",
  "SEMANTIC_RETRIEVAL_UNAVAILABLE",
  "SOURCE_UNAVAILABLE",
  "QUOTA_EXCEEDED",
  "PROVIDER_UNAVAILABLE",
  "BETA_ACCESS_REQUIRED",
  "CONSENT_REQUIRED",
] as const;
export type AssistantLimitationCode = (typeof ASSISTANT_LIMITATION_CODES)[number];

export const ASSISTANT_SOURCE_KINDS = [
  "verified_structured",
  "accepted_document_text",
  "synthetic_example",
] as const;
export type AssistantSourceKind = (typeof ASSISTANT_SOURCE_KINDS)[number];

export const ASSISTANT_CLAIM_KINDS = ["personal", "general"] as const;
export type AssistantClaimKind = (typeof ASSISTANT_CLAIM_KINDS)[number];

export const ASSISTANT_FEEDBACK_RATINGS = ["positive", "negative"] as const;
export type AssistantFeedbackRating = (typeof ASSISTANT_FEEDBACK_RATINGS)[number];

export const ASSISTANT_FEEDBACK_CATEGORIES = [
  "answer_quality",
  "missing_evidence",
  "safety",
  "latency",
  "other",
] as const;
export type AssistantFeedbackCategory = (typeof ASSISTANT_FEEDBACK_CATEGORIES)[number];
export const assistantFeedbackRequestSchema = z
  .object({
    request_id: z.string().uuid(),
    rating: z.enum(ASSISTANT_FEEDBACK_RATINGS),
    category: z.enum(ASSISTANT_FEEDBACK_CATEGORIES).nullable().optional(),
    comment: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

export type AssistantFeedbackRequest = z.infer<typeof assistantFeedbackRequestSchema>;


const documentTypes = [
  "lab_result",
  "instrumental_report",
  "consultation_note",
  "discharge_summary",
  "prescription",
  "referral",
  "dicom",
] as const;

const assistantFiltersSchema = z
  .object({
    document_ids: z.array(z.string().uuid()).max(20).optional(),
    document_types: z.array(z.enum(documentTypes)).max(documentTypes.length).optional(),
    measurement_keys: z
      .array(z.string().trim().min(1).max(128))
      .max(20)
      .optional(),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.start_date && value.end_date && value.start_date > value.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "end_date_before_start_date",
      });
    }
  });

export const assistantRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(2_000),
    filters: assistantFiltersSchema.optional(),
    synthetic_example: z.boolean().optional().default(false),
  })
  .strict();

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantFilters = z.infer<typeof assistantFiltersSchema>;

export const assistantClaimCandidateSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,96}$/u),
    kind: z.enum(ASSISTANT_CLAIM_KINDS),
    text: z.string().trim().min(1).max(1_000),
    source_ids: z
      .array(z.string().regex(/^asrc_[0-9a-f]{32}$/u))
      .max(8)
      .default([]),
  })
  .strict();

export const assistantModelResponseSchema = z
  .object({
    answer: z.string().trim().min(1).max(8_000),
    claims: z.array(assistantClaimCandidateSchema).max(32).default([]),
  })
  .strict();

export type AssistantClaimCandidate = z.infer<typeof assistantClaimCandidateSchema>;
export type AssistantModelResponse = Readonly<{
  answer: string;
  claims: readonly AssistantClaimCandidate[];
}>;

export type AssistantSource = Readonly<{
  source_id: string;
  source_kind: AssistantSourceKind;
  source_row_id: string;
  document_id: string | null;
  document_type: string | null;
  filename: string;
  page_number: number | null;
  observed_at: string | null;
  label: string;
  excerpt: string;
  href: string | null;
  profile_id: string;
}>;

export type AssistantCitation = Readonly<{
  source_id: string;
  source_kind: AssistantSourceKind;
  document_id: string | null;
  label: string;
  page_number: number | null;
  observed_at: string | null;
  href: string | null;
}>;

export type AssistantCoverage = Readonly<{
  personal_claims: number;
  supported_claims: number;
  rejected_claims: number;
  structured_sources: number;
  semantic_sources: number;
}>;

export type AssistantResponse = Readonly<{
  request_id: string;
  mode: AssistantMode;
  answer: string;
  citations: readonly AssistantCitation[];
  limitations: readonly AssistantLimitationCode[];
  coverage: AssistantCoverage;
  safety: {
    disclaimer: string;
    clinician_boundary: boolean;
  };
}>;

export const ASSISTANT_DISCLAIMER =
  "This is educational information, not medical advice. A qualified healthcare professional must make diagnosis and treatment decisions.";

export const ASSISTANT_SOURCE_ID_PATTERN = /^asrc_[0-9a-f]{32}$/u;

export function isAssistantMode(value: unknown): value is AssistantMode {
  return typeof value === "string" && ASSISTANT_MODES.includes(value as AssistantMode);
}

export function isAssistantLimitationCode(
  value: unknown,
): value is AssistantLimitationCode {
  return (
    typeof value === "string" &&
    ASSISTANT_LIMITATION_CODES.includes(value as AssistantLimitationCode)
  );
}
