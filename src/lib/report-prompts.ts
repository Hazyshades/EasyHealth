import { z } from "zod";

export const REPORT_TYPES = [
  "general_practice",
  "cardiology",
  "endocrinology",
  "gastroenterology",
  "hematology",
  "nephrology",
  "neurology",
  "pulmonology",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const DETAIL_LEVELS = [
  "compact",
  "standard",
  "detailed",
  "full",
] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const REPORT_RANGE_OPTIONS = ["all", "30d", "90d", "year"] as const;
export type ReportRange = (typeof REPORT_RANGE_OPTIONS)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  general_practice: "Primary care (general practice)",
  cardiology: "Cardiology",
  endocrinology: "Endocrinology",
  gastroenterology: "Gastroenterology",
  hematology: "Hematology",
  nephrology: "Nephrology",
  neurology: "Neurology",
  pulmonology: "Pulmonology",
};

export const DETAIL_LEVEL_LABELS: Record<DetailLevel, string> = {
  compact: "Compact",
  standard: "Standard",
  detailed: "Detailed",
  full: "Full",
};

export const DETAIL_LEVEL_HINTS: Partial<Record<DetailLevel, string>> = {
  compact: "~1 page",
  standard: "2–3 pages",
  detailed: "4–5 pages",
  full: "Comprehensive",
};

export const REPORT_RANGE_LABELS: Record<ReportRange, string> = {
  all: "All time",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
};

export const createReportBodySchema = z.object({
  title: z.string().min(1).max(200),
  report_type: z.enum(REPORT_TYPES),
  detail_level: z.enum(DETAIL_LEVELS),
  document_ids: z.array(z.string().uuid()).nullable().optional(),
  abnormal_only: z.boolean().optional().default(false),
  questions: z.array(z.string()).optional(),
  report_date_range: z
    .object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    })
    .strict()
    .nullable()
    .optional(),
  /** Optional inclusive UTC calendar period for the EH-149 frozen dynamics extension. */
  biomarker_dynamics_period: z
    .object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    })
    .strict()
    .nullable()
    .optional(),
});

export type CreateReportBody = z.infer<typeof createReportBodySchema>;

export const STRUCTURED_REPORT_SAFETY_PROMPT = `You are an educational health literacy assistant for EasyHealth.
You choose which server-supplied evidence appears in a clinician-ready brief. The
server owns scope, source snapshots, dates, validation, rendering, and the
medical disclaimer.
Rules:
- Select only opaque source_id values from the supplied source catalog.
- Each selected item names one section, one kind, and one catalog source_id.
- Use kind numeric_observation only for observation sources; use source_fact for
  every other source kind.
- Never write values, ranges, dates, prose, diagnoses, treatments, urgency
  guidance, or recommendations: the server renders every factual line.
- Questions are non-factual and must end with a question mark. Do not answer
  them and never phrase them as instructions.
- Never include storage paths, filenames as identity, profile identifiers,
  access tokens, or any field outside the selection shape.
- Prefer one item per source. Omit anything the catalog does not support.
- Return valid JSON only; no markdown fences or commentary.`;

const SPECIALTY_PROMPTS: Record<ReportType, string> = {
  general_practice: `Focus on holistic wellness and preventive health literacy across all provided biomarkers.
Highlight patterns a primary care clinician might discuss at a routine visit.`,
  cardiology: `Emphasize cardiovascular-related biomarkers (lipids, blood pressure markers, cardiac risk factors when present).
Frame findings in terms of heart health literacy without diagnosing cardiovascular disease.`,
  endocrinology: `Emphasize metabolic and endocrine-related biomarkers (glucose, HbA1c, thyroid markers when present).
Frame findings in terms of metabolic health literacy without diagnosing endocrine disorders.`,
  gastroenterology: `Emphasize liver enzymes and gastrointestinal-related biomarkers when present.
Frame findings in terms of digestive health literacy without diagnosing GI disease.`,
  hematology: `Emphasize blood count components, iron studies, and coagulation-related markers when present.
Frame findings in terms of blood health literacy without diagnosing hematologic conditions.`,
  nephrology: `Emphasize kidney-related biomarkers (creatinine, eGFR, electrolytes, urine markers when present).
Frame findings in terms of kidney health literacy without diagnosing renal disease.`,
  neurology: `Emphasize neurologically relevant biomarkers (B12, folate, inflammatory markers when present).
Frame findings in terms of neurological health literacy without diagnosing neurological conditions.`,
  pulmonology: `Emphasize respiratory-related biomarkers and oxygenation markers when present.
Frame findings in terms of lung health literacy without diagnosing pulmonary disease.`,
};

const DETAIL_INSTRUCTIONS: Record<DetailLevel, string> = {
  compact:
    "Keep the report brief (~1 page). Use short bullet points and minimal prose.",
  standard:
    "Provide a balanced report (2–3 pages equivalent). Moderate detail in each section.",
  detailed:
    "Provide an expanded report (4–5 pages equivalent). More context per finding.",
  full: "Provide the most comprehensive educational summary possible within safety rules.",
};

export function buildStructuredReportSystemPrompt(
  reportType: ReportType,
  detailLevel: DetailLevel,
): string {
  return `${STRUCTURED_REPORT_SAFETY_PROMPT}

Specialty focus:
${SPECIALTY_PROMPTS[reportType]}

Detail level:
${DETAIL_INSTRUCTIONS[detailLevel]}`;
}

export function buildDefaultReportTitle(): string {
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Report from ${date}`;
}

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

export function isReportRange(value: string): value is ReportRange {
  return (REPORT_RANGE_OPTIONS as readonly string[]).includes(value);
}
