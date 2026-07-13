import type { LanguageModel } from "ai";
import {
  runStructuredImageExtraction,
  runStructuredTextExtraction,
} from "@/lib/ai/extract-with-trace";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";

export type DischargeExtractionResult = {
  provider_name: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  hospital_course: string | null;
  discharge_diagnoses: string[];
  discharge_medications: string[];
  follow_up_instructions: string | null;
  history_summary: string | null;
  exam_findings: string | null;
  documented_problems: string[];
  recommendations: string[];
  follow_up_plan: string | null;
};

const DISCHARGE_INSTRUCTIONS = `You extract structured data from hospital discharge summaries.
Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "provider_name": string | null,
  "admission_date": "YYYY-MM-DD" | null,
  "discharge_date": "YYYY-MM-DD" | null,
  "hospital_course": string | null,
  "discharge_diagnoses": ["string"],
  "discharge_medications": ["string"],
  "follow_up_instructions": string | null,
  "history_summary": string | null,
  "exam_findings": string | null,
  "documented_problems": ["string"],
  "recommendations": ["string"],
  "follow_up_plan": string | null
}
Rules:
- Extract only what appears in the document. Do not diagnose or prescribe.
- discharge_diagnoses: final diagnoses listed at discharge.
- discharge_medications: medications at discharge with dose/frequency when stated.
- documented_problems: active problems addressed during hospitalization as written.
- Use ISO dates YYYY-MM-DD when visible.`;

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function parseDischargeExtraction(raw: unknown): DischargeExtractionResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const nullableString = (key: string) => {
    const v = data[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  return {
    provider_name: nullableString("provider_name"),
    admission_date: nullableString("admission_date"),
    discharge_date: nullableString("discharge_date"),
    hospital_course: nullableString("hospital_course"),
    discharge_diagnoses: parseStringList(data.discharge_diagnoses),
    discharge_medications: parseStringList(data.discharge_medications),
    follow_up_instructions: nullableString("follow_up_instructions"),
    history_summary: nullableString("history_summary"),
    exam_findings: nullableString("exam_findings"),
    documented_problems: parseStringList(data.documented_problems),
    recommendations: parseStringList(data.recommendations),
    follow_up_plan: nullableString("follow_up_plan"),
  };
}

export async function extractDischargeFromText(
  text: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<DischargeExtractionResult> {
  return runStructuredTextExtraction({
    model,
    system: DISCHARGE_INSTRUCTIONS,
    userText: `Extract discharge summary data from this document (${filename}):\n\n${text.slice(0, 120000)}`,
    parse: parseDischargeExtraction,
    ctx,
  });
}

export async function extractDischargeFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<DischargeExtractionResult> {
  return runStructuredImageExtraction({
    model,
    system: DISCHARGE_INSTRUCTIONS,
    imageBuffer,
    mimeType,
    promptText: `Extract discharge summary data from this image: ${filename}`,
    parse: parseDischargeExtraction,
    ctx,
  });
}
