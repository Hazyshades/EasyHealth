import type { LanguageModel } from "ai";
import { generateStructuredJson } from "@/lib/ai/structured-llm";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
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
  trace?: PipelineLlmContext;
}) {
  const messages = [
    {
      role: "system" as const,
      content: `${options.system}\n\n${REPORT_JSON_INSTRUCTIONS}`,
    },
    { role: "user" as const, content: options.prompt },
  ];

  if (options.trace) {
    const raw = await generateStructuredJson({
      trace: {
        model: options.model,
        modelId: options.trace.modelId,
        provider: options.trace.provider,
        stage: "report",
        profileId: options.trace.profileId,
        documentId: options.trace.documentId,
        providerSwitch: options.trace.providerSwitch ?? false,
        supabase: options.trace.supabase,
        temperature: 0.3,
        messages,
      },
      parse: (text) => parseJsonFromModelText(text),
    });
    return parseDoctorSummary(raw);
  }

  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: options.model,
    maxRetries: 2,
    temperature: 0.3,
    messages,
  });

  const raw = parseJsonFromModelText(text);
  return parseDoctorSummary(raw);
}
