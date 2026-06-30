import { generateText, type LanguageModel } from "ai";
import { parseDoctorSummary, parseJsonFromModelText } from "@/lib/schemas/biomarkers";

const REPORT_JSON_INSTRUCTIONS = `Respond with a single JSON object only. No markdown fences, no commentary.
Shape:
{
  "overview": "plain-text paragraph",
  "key_findings": ["string", "..."],
  "changes": ["string", "..."],
  "questions_for_clinician": ["string", "...", "..."],
  "when_to_seek_care": "plain-text guidance for urgent symptoms"
}
Do not include a disclaimer field; the server adds it automatically.`;

export async function generateDoctorSummary(options: {
  model: LanguageModel;
  system: string;
  prompt: string;
}) {
  const { text } = await generateText({
    model: options.model,
    maxRetries: 2,
    messages: [
      {
        role: "system",
        content: `${options.system}\n\n${REPORT_JSON_INSTRUCTIONS}`,
      },
      { role: "user", content: options.prompt },
    ],
  });

  const raw = parseJsonFromModelText(text);
  return parseDoctorSummary(raw);
}
