import { generateText, type LanguageModel } from "ai";
import type { DocumentType } from "@/lib/health-systems";

const TYPE_LABELS: Record<string, string> = {
  lab_result: "laboratory results",
  instrumental_report: "instrumental/imaging study report",
  consultation_note: "clinical consultation note",
};

export async function generateDocumentSummary(
  model: LanguageModel,
  documentType: DocumentType,
  structuredPayload: unknown,
  filename: string
): Promise<string> {
  const label = TYPE_LABELS[documentType] ?? "medical document";

  const { text } = await generateText({
    model,
    maxRetries: 2,
    messages: [
      {
        role: "system",
        content: `Write a brief educational summary (2-3 sentences max) of this ${label}.
Use plain English. Cite specific values or findings from the structured data when present.
Do not diagnose, prescribe, or add information not supported by the data.
End without a disclaimer (the app adds one separately).`,
      },
      {
        role: "user",
        content: `Filename: ${filename}\nStructured extraction:\n${JSON.stringify(structuredPayload, null, 2)}`,
      },
    ],
  });

  return text.trim();
}
