import { z } from "zod";

export const REPORT_TYPES = ["general_practice", "cardiology", "endocrinology"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const DETAIL_LEVELS = ["compact", "standard", "detailed", "full"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  general_practice: "Primary care (general practice)",
  cardiology: "Cardiology",
  endocrinology: "Endocrinology",
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

export const createReportBodySchema = z.object({
  title: z.string().min(1).max(200),
  report_type: z.enum(REPORT_TYPES),
  detail_level: z.enum(DETAIL_LEVELS),
  document_ids: z.array(z.string().uuid()).nullable().optional(),
});

export type CreateReportBody = z.infer<typeof createReportBodySchema>;

export const SAFETY_PROMPT = `You are an educational health literacy assistant for EasyHealth.
Generate a clinician-ready SUMMARY for discussion with a healthcare professional.
Rules:
- Educational language only. NO diagnoses, prescriptions, or treatment plans.
- Cite specific biomarker values and dates from the provided data.
- Include when_to_seek_care for urgent symptoms only (general guidance).
- Always set disclaimer to exactly: "This is not medical advice. Consult a healthcare professional."`;

const SPECIALTY_PROMPTS: Record<ReportType, string> = {
  general_practice: `Focus on holistic wellness and preventive health literacy across all provided biomarkers.
Highlight patterns a primary care clinician might discuss at a routine visit.`,
  cardiology: `Emphasize cardiovascular-related biomarkers (lipids, blood pressure markers, cardiac risk factors when present).
Frame findings in terms of heart health literacy without diagnosing cardiovascular disease.`,
  endocrinology: `Emphasize metabolic and endocrine-related biomarkers (glucose, HbA1c, thyroid markers when present).
Frame findings in terms of metabolic health literacy without diagnosing endocrine disorders.`,
};

const DETAIL_INSTRUCTIONS: Record<DetailLevel, string> = {
  compact: "Keep the report brief (~1 page). Use short bullet points and minimal prose.",
  standard: "Provide a balanced report (2–3 pages equivalent). Moderate detail in each section.",
  detailed: "Provide an expanded report (4–5 pages equivalent). More context per finding.",
  full: "Provide the most comprehensive educational summary possible within safety rules.",
};

export function buildReportSystemPrompt(reportType: ReportType, detailLevel: DetailLevel): string {
  return `${SAFETY_PROMPT}

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
