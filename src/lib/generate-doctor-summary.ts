import { generateText, type LanguageModel } from "ai";
import { generateStructuredJson } from "@/lib/ai/structured-llm";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
import { parseJsonFromModelText } from "@/lib/schemas/biomarkers";

const REPORT_CANDIDATE_JSON_INSTRUCTIONS = `Return this exact candidate envelope:
{
  "schema_version": "eh148.v1",
  "report_kind": "doctor_visit_brief",
  "generated_at": "ISO-8601 timestamp with offset",
  "detail_level": "compact|standard|detailed|full",
  "requested_scope": {"kind": "all_eligible", "document_ids": null},
  "source_document_ids": ["UUID"],
  "sections": [
    {"id": "document_summary", "items": []},
    {"id": "latest_measurements", "items": []},
    {"id": "changes", "items": []},
    {"id": "clinician_questions", "items": []},
    {"id": "limitations", "items": []},
    {"id": "source_ledger", "items": []}
  ],
  "claims": [],
  "sources": [],
  "limitations": []
}
Populate claims with only approved closed templates and opaque source IDs from
the catalog. Factual claims must omit text. Add source_ref items for every
catalog source and use machine limitation codes without messages.`;

export async function generateDoctorVisitBriefCandidate(options: {
  model: LanguageModel;
  system: string;
  prompt: string;
  trace?: PipelineLlmContext;
}): Promise<unknown> {
  const messages = [
    {
      role: "system" as const,
      content: `${options.system}\n\n${REPORT_CANDIDATE_JSON_INSTRUCTIONS}`,
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
