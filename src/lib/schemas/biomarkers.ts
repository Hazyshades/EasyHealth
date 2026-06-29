import { z } from "zod";

function parseLabNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const cleaned = value
    .trim()
    .replace(/^[<>≤≥]+\s*/, "")
    .replace(/,/g, "");
  if (!cleaned || /^negative$/i.test(cleaned) || /^positive$/i.test(cleaned)) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRefBound(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const rangeMatch = value.match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return parseLabNumber(rangeMatch[1]);
  }

  return parseLabNumber(value);
}

function parseRefHigh(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const rangeMatch = value.match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return parseLabNumber(rangeMatch[2]);
  }

  return parseLabNumber(value);
}

/** Permissive schema used only if generateObject is retried. */
export const extractionSchema = z.object({
  lab_name: z.any().optional(),
  observed_at: z.any().optional(),
  biomarkers: z.any().optional(),
});

export const biomarkerSchema = z.object({
  key: z.string(),
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  ref_low: z.number().nullable().optional(),
  ref_high: z.number().nullable().optional(),
});

export type Biomarker = z.infer<typeof biomarkerSchema>;

export type ExtractionResult = {
  lab_name: string | null;
  observed_at: string | null;
  biomarkers: Biomarker[];
};

export function parseRawExtraction(raw: unknown): ExtractionResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const list = Array.isArray(data.biomarkers) ? data.biomarkers : [];
  const biomarkers: Biomarker[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const row = item as Record<string, unknown>;
    const value = parseLabNumber(row.value);
    if (value === null) continue;

    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Unknown test";
    const keySource = typeof row.key === "string" && row.key.trim() ? row.key : name;
    const unit = typeof row.unit === "string" ? row.unit.trim() : "";

    biomarkers.push({
      key: normalizeBiomarkerKey(keySource, name),
      name,
      value,
      unit,
      ref_low: parseRefBound(row.ref_low),
      ref_high: parseRefHigh(row.ref_high),
    });
  }

  return {
    lab_name: typeof data.lab_name === "string" && data.lab_name.trim() ? data.lab_name.trim() : null,
    observed_at:
      typeof data.observed_at === "string" && data.observed_at.trim() ? data.observed_at.trim() : null,
    biomarkers,
  };
}

export function sanitizeExtraction(raw: unknown): ExtractionResult {
  return parseRawExtraction(raw);
}

export function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error("Model did not return JSON");
  }
}

export function normalizeBiomarkerKey(key: string, name: string): string {
  const raw = (key || name).trim().toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export const MEDICAL_DISCLAIMER =
  "This is not medical advice. Consult a healthcare professional.";

/** Permissive schema for LLM structured output; disclaimer is injected server-side. */
export const doctorSummaryGenerationSchema = z.object({
  overview: z.string().min(1).describe("Plain-text overview paragraph, no markdown"),
  key_findings: z
    .array(z.string().min(1))
    .min(1)
    .describe("At least one key finding with values and dates"),
  changes: z
    .array(z.string().min(1))
    .min(1)
    .describe("At least two change-over-time notes or a note that only one date is available"),
  questions_for_clinician: z
    .array(z.string().min(1))
    .min(3)
    .describe("At least three clinician questions referencing specific results"),
  when_to_seek_care: z.string().min(1).describe("Plain-text urgent care guidance"),
  disclaimer: z.string().optional(),
});

export const doctorSummarySchema = z.object({
  overview: z.string(),
  key_findings: z.array(z.string()),
  changes: z.array(z.string()),
  questions_for_clinician: z.array(z.string()),
  when_to_seek_care: z.string(),
  disclaimer: z.literal(MEDICAL_DISCLAIMER),
});

export type DoctorSummary = z.infer<typeof doctorSummarySchema>;
