import type { LanguageModel } from "ai";
import {
  runStructuredImageExtraction,
  runStructuredTextExtraction,
} from "@/lib/ai/extract-with-trace";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";

export type PrescriptionMedication = {
  name: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
};

export type PrescriptionExtractionResult = {
  prescriber_name: string | null;
  prescribed_at: string | null;
  medications: PrescriptionMedication[];
};

const PRESCRIPTION_INSTRUCTIONS = `You extract structured data from medical prescriptions.
Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "prescriber_name": string | null,
  "prescribed_at": "YYYY-MM-DD" | null,
  "medications": [
    {
      "name": "medication name",
      "dose": string | null,
      "frequency": string | null,
      "duration": string | null,
      "instructions": string | null
    }
  ]
}
Rules:
- Extract only medications explicitly listed in the prescription.
- Do not add or infer medications not in the document.
- Use ISO date YYYY-MM-DD for prescribed_at when visible.`;

function parseMedications(value: unknown): PrescriptionMedication[] {
  if (!Array.isArray(value)) return [];
  const meds: PrescriptionMedication[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : null;
    if (!name) continue;

    const nullable = (key: string) => {
      const v = row[key];
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };

    meds.push({
      name,
      dose: nullable("dose"),
      frequency: nullable("frequency"),
      duration: nullable("duration"),
      instructions: nullable("instructions"),
    });
  }

  return meds;
}

function parsePrescriptionExtraction(raw: unknown): PrescriptionExtractionResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    prescriber_name:
      typeof data.prescriber_name === "string" && data.prescriber_name.trim()
        ? data.prescriber_name.trim()
        : null,
    prescribed_at:
      typeof data.prescribed_at === "string" && data.prescribed_at.trim()
        ? data.prescribed_at.trim()
        : null,
    medications: parseMedications(data.medications),
  };
}

export async function extractPrescriptionFromText(
  text: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<PrescriptionExtractionResult> {
  return runStructuredTextExtraction({
    model,
    system: PRESCRIPTION_INSTRUCTIONS,
    userText: `Extract prescription data from this document (${filename}):\n\n${text.slice(0, 120000)}`,
    parse: parsePrescriptionExtraction,
    ctx,
  });
}

export async function extractPrescriptionFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  model: LanguageModel,
  filename: string,
  ctx?: PipelineLlmContext
): Promise<PrescriptionExtractionResult> {
  return runStructuredImageExtraction({
    model,
    system: PRESCRIPTION_INSTRUCTIONS,
    imageBuffer,
    mimeType,
    promptText: `Extract prescription data from this image: ${filename}`,
    parse: parsePrescriptionExtraction,
    ctx,
  });
}
