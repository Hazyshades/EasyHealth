import { generateText, type LanguageModel } from "ai";
import type { DocumentType } from "@/lib/health-systems";

const TYPE_LABELS: Record<string, string> = {
  lab_result: "laboratory results",
  instrumental_report: "instrumental/imaging study report",
  consultation_note: "clinical consultation note",
  discharge_summary: "hospital discharge summary",
  prescription: "medical prescription",
  referral: "medical referral letter",
};

const CONSULTATION_SUMMARY_EXTRA = `
For consultation notes: cite specific plan items, tests ordered, and follow-up actions when present in the data.
Avoid generic phrasing like "monitoring for heart issues" when specific plan details are available.`;

export async function generateDocumentSummary(
  model: LanguageModel,
  documentType: DocumentType,
  structuredPayload: unknown,
  filename: string
): Promise<string> {
  const label = TYPE_LABELS[documentType] ?? "medical document";
  const extra =
    documentType === "consultation_note" ? CONSULTATION_SUMMARY_EXTRA : "";

  const { text } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      {
        role: "system",
        content: `Write a brief educational summary (2-3 sentences max) of this ${label}.
Use plain English. Cite specific values or findings from the structured data when present.
Do not diagnose, prescribe, or add information not supported by the data.
End without a disclaimer (the app adds one separately).${extra}`,
      },
      {
        role: "user",
        content: `Filename: ${filename}\nStructured extraction:\n${JSON.stringify(structuredPayload, null, 2)}`,
      },
    ],
  });

  return text.trim();
}
