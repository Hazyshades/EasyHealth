import { z } from "zod";

export function parseLabNumber(value: unknown): number | null {
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

export function parseReferenceRange(value: unknown): {
  ref_low: number | null;
  ref_high: number | null;
} {
  if (typeof value !== "string" || !value.trim()) {
    return { ref_low: null, ref_high: null };
  }

  const rangeMatch = value.match(/(-?\d+(?:\.\d+)?)\s*[-\u2013]\s*(-?\d+(?:\.\d+)?)/);
  if (!rangeMatch) {
    return {
      ref_low: parseRefBound(value),
      ref_high: parseRefHigh(value),
    };
  }

  return {
    ref_low: parseLabNumber(rangeMatch[1]),
    ref_high: parseLabNumber(rangeMatch[2]),
  };
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

/** Strip Qwen/DeepSeek-style reasoning wrappers before JSON parsing. */
function stripModelReasoningPreamble(text: string): string {
  const thinkOpen = "\u003cthink\u003e";
  const thinkClose = "\u003c/think\u003e";
  let cleaned = text.trim();
  cleaned = cleaned.replace(new RegExp(`${thinkOpen}[\\s\\S]*?${thinkClose}`, "gi"), "");
  const closeIdx = cleaned.lastIndexOf(thinkClose);
  if (closeIdx >= 0) {
    cleaned = cleaned.slice(closeIdx + thinkClose.length);
  }
  return cleaned.trim();
}

export function parseJsonFromModelText(text: string): unknown {
  if (!text.trim()) {
    throw new Error(
      "Model did not return JSON (debug:empty=true — provider may have returned tool-calls instead of text)"
    );
  }

  const trimmed = stripModelReasoningPreamble(text);

  // Fast path: the model returned raw JSON.
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // Handle markdown fences: ```json { ... } ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // continue
    }
  }

  // Robust fallback: find the first balanced JSON object/array substring.
  // This is intentionally tolerant to “reasoning” preambles that may include braces.
  function tryParseBalanced(openChar: "{" | "[", closeChar: "}" | "]"): unknown | null {
    for (let start = trimmed.indexOf(openChar); start >= 0; start = trimmed.indexOf(openChar, start + 1)) {
      let depth = 0;
      let inString = false;
      let escape = false;

      for (let i = start; i < trimmed.length; i++) {
        const ch = trimmed[i];

        if (inString) {
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === "\\") {
            escape = true;
            continue;
          }
          if (ch === '"') {
            inString = false;
          }
          continue;
        }

        if (ch === '"') {
          inString = true;
          continue;
        }

        if (ch === openChar) depth++;
        if (ch === closeChar) depth--;

        if (depth === 0) {
          const candidate = trimmed.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  const asObject = tryParseBalanced("{", "}");
  if (asObject !== null) return asObject;

  const asArray = tryParseBalanced("[", "]");
  if (asArray !== null) return asArray;

  const hasFence = /```/.test(trimmed);
  const thinkClose = trimmed.toLowerCase().includes("</think>");
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");

  throw new Error(
    [
      "Model did not return JSON",
      `(debug:fence=${hasFence},thinkClose=${thinkClose},brace=${braceStart}-${braceEnd},array=${arrayStart}-${arrayEnd})`,
    ].join(" ")
  );
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

export type DoctorSummaryGeneration = z.infer<typeof doctorSummaryGenerationSchema>;

function toReportStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

/** Coerce permissive LLM JSON into the report shape (used after generateText). */
export function parseDoctorSummary(raw: unknown): DoctorSummaryGeneration {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const overview =
    typeof data.overview === "string" && data.overview.trim()
      ? data.overview.trim()
      : "Summary based on the provided biomarker history.";

  let key_findings = toReportStringArray(data.key_findings);
  let changes = toReportStringArray(data.changes);
  let questions_for_clinician = toReportStringArray(data.questions_for_clinician);

  if (key_findings.length === 0) {
    key_findings = ["Review the listed biomarker values and dates with your clinician."];
  }
  if (changes.length === 0) {
    changes = ["Only one lab date is available; longitudinal comparison is limited."];
  }
  if (changes.length === 1) {
    changes.push("Additional lab dates would help track trends over time.");
  }
  while (questions_for_clinician.length < 3) {
    questions_for_clinician.push(
      "What follow-up tests or monitoring would you recommend based on these results?"
    );
  }

  const when_to_seek_care =
    typeof data.when_to_seek_care === "string" && data.when_to_seek_care.trim()
      ? data.when_to_seek_care.trim()
      : "Seek urgent care for chest pain, difficulty breathing, severe weakness, or other acute symptoms.";

  return {
    overview,
    key_findings,
    changes,
    questions_for_clinician,
    when_to_seek_care,
  };
}

export const doctorSummarySchema = z.object({
  overview: z.string(),
  key_findings: z.array(z.string()),
  changes: z.array(z.string()),
  questions_for_clinician: z.array(z.string()),
  when_to_seek_care: z.string(),
  disclaimer: z.literal(MEDICAL_DISCLAIMER),
});

export type DoctorSummary = z.infer<typeof doctorSummarySchema>;
