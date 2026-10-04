import { generateText, type LanguageModel } from "ai";
import { generateStructuredJson } from "@/lib/ai/structured-llm";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
import { parseJsonFromModelText } from "@/lib/schemas/biomarkers";

const REPORT_SELECTION_JSON_INSTRUCTIONS = `Choose which evidence to render. Return only JSON in this shape:
{
  "claims": [
    { "section": "latest_measurements", "kind": "numeric_observation", "source_id": "src_example", "include_range": true },
    { "section": "document_summary", "kind": "source_fact", "source_id": "src_example", "include_date": true },
    { "section": "changes", "kind": "numeric_observation", "source_id": "src_example", "include_range": true }
  ],
  "questions": ["Which of these results should I discuss?"]
}
Copy single values from the lists below; never copy a list into a field.
- section must be exactly one of: document_summary, latest_measurements, changes
- kind must be exactly one of: source_fact, numeric_observation
- use kind numeric_observation only for observation sources
- source_id must be copied verbatim from the supplied source catalog
- include_date and include_range are true or false booleans
- questions must end with a question mark and must not read as instructions
Never write factual prose, values, ranges, dates, diagnoses, treatments, urgency
guidance, storage paths, filenames as identity, or identifiers.
Coverage: select a numeric_observation item in latest_measurements for the most
recent observation of each measured marker, repeat numeric_observation items in
changes when two or more observations of the same marker and unit fall on
different dates, and use source_fact in document_summary for every other source.`;

export async function generateReportSelection(options: {
  model: LanguageModel;
  system: string;
  prompt: string;
  trace?: PipelineLlmContext;
}): Promise<unknown> {
  const messages = [
    {
      role: "system" as const,
      content: `${options.system}\n\n${REPORT_SELECTION_JSON_INSTRUCTIONS}`,
    },
    { role: "user" as const, content: options.prompt },
  ];

  if (options.trace) {
    return generateStructuredJson({
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
  }

  const { text } = await generateText({
    model: options.model,
    maxRetries: 2,
    temperature: 0.3,
    messages,
  });
  return parseJsonFromModelText(text);
}
