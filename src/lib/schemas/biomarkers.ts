import { z } from "zod";

export const biomarkerSchema = z.object({
  key: z.string(),
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  ref_low: z.number().nullable().optional(),
  ref_high: z.number().nullable().optional(),
});

export const extractionSchema = z.object({
  lab_name: z.string().nullable(),
  observed_at: z.string().nullable(),
  biomarkers: z.array(biomarkerSchema),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;

export function normalizeBiomarkerKey(key: string, name: string): string {
  const raw = (key || name).trim().toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export const doctorSummarySchema = z.object({
  overview: z.string(),
  key_findings: z.array(z.string()),
  changes: z.array(z.string()),
  questions_for_clinician: z.array(z.string()),
  when_to_seek_care: z.string(),
  disclaimer: z.literal("This is not medical advice. Consult a healthcare professional."),
});

export type DoctorSummary = z.infer<typeof doctorSummarySchema>;

export const MEDICAL_DISCLAIMER =
  "This is not medical advice. Consult a healthcare professional.";
