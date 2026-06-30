import { generateText, type LanguageModel } from "ai";
import { parseJsonFromModelText } from "@/lib/schemas/biomarkers";

export type ConsultationExtractionResult = {
  provider_name: string | null;
  visit_date: string | null;
  chief_complaint: string | null;
  history_summary: string | null;
  exam_findings: string | null;
  documented_diagnoses: string[];
  recommendations: string[];
  follow_up_plan: string | null;
};

const CONSULTATION_INSTRUCTIONS = `You extract structured data from clinical consultation or visit notes.
Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "provider_name": string | null,
  "visit_date": "YYYY-MM-DD" | null,
  "chief_complaint": string | null,
  "history_summary": string | null,
  "exam_findings": string | null,
  "documented_diagnoses": ["string"],
  "recommendations": ["string"],
  "follow_up_plan": string | null
}
Rules:
- documented_diagnoses must only include diagnoses explicitly stated in the document.
- Do not add new diagnoses, treatments, or clinical conclusions.
- Use educational extraction only; quote document wording where possible.
- visit_date as ISO YYYY-MM-DD when visible.`;

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function parseConsultationExtraction(raw: unknown): ConsultationExtractionResult {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    provider_name:
      typeof data.provider_name === "string" && data.provider_name.trim()
        ? data.provider_name.trim()
        : null,
    visit_date:
      typeof data.visit_date === "string" && data.visit_date.trim() ? data.visit_date.trim() : null,
    chief_complaint:
      typeof data.chief_complaint === "string" && data.chief_complaint.trim()
        ? data.chief_complaint.trim()
        : null,
    history_summary:
      typeof data.history_summary === "string" && data.history_summary.trim()
        ? data.history_summary.trim()
        : null,
    exam_findings:
      typeof data.exam_findings === "string" && data.exam_findings.trim()
        ? data.exam_findings.trim()
        : null,
    documented_diagnoses: parseStringList(data.documented_diagnoses),
    recommendations: parseStringList(data.recommendations),
    follow_up_plan:
      typeof data.follow_up_plan === "string" && data.follow_up_plan.trim()
        ? data.follow_up_plan.trim()
        : null,
  };
}

export async function extractConsultationFromText(
  text: string,
  model: LanguageModel,
  filename: string
): Promise<ConsultationExtractionResult> {
  const { text: response } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      { role: "system", content: CONSULTATION_INSTRUCTIONS },
      {
        role: "user",
        content: `Extract consultation note data from this document text (${filename}):\n\n${text.slice(0, 120000)}`,
      },
    ],
  });

  return parseConsultationExtraction(parseJsonFromModelText(response));
}

export async function extractConsultationFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  model: LanguageModel,
  filename: string
): Promise<ConsultationExtractionResult> {
  const { text: response } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      { role: "system", content: CONSULTATION_INSTRUCTIONS },
      {
        role: "user",
        content: [
          { type: "text", text: `Extract consultation note data from this image: ${filename}` },
          { type: "image", image: imageBuffer, mediaType: mimeType },
        ],
      },
    ],
  });

  return parseConsultationExtraction(parseJsonFromModelText(response));
}
