import type { LanguageModel, ModelMessage } from "ai";
import { generateStructuredJson } from "@/lib/ai/structured-llm";
import type { PipelineLlmContext } from "@/lib/ai/pipeline-trace";
import { parseJsonFromModelText } from "@/lib/schemas/biomarkers";

export async function runStructuredTextExtraction<T>(options: {
  model: LanguageModel;
  system: string;
  userText: string;
  parse: (raw: unknown) => T;
  ctx?: PipelineLlmContext;
}): Promise<T> {
  const messages: ModelMessage[] = [
    { role: "system", content: options.system },
    { role: "user", content: options.userText },
  ];

  if (options.ctx) {
    return generateStructuredJson({
      trace: {
        model: options.model,
        modelId: options.ctx.modelId,
        provider: options.ctx.provider,
        stage: options.ctx.stage,
        profileId: options.ctx.profileId,
        documentId: options.ctx.documentId,
        providerSwitch: options.ctx.providerSwitch ?? false,
        supabase: options.ctx.supabase,
        temperature: 0,
        messages,
      },
      parse: (raw) => options.parse(parseJsonFromModelText(raw)),
    });
  }

  const { generateText } = await import("ai");
  const { text: response } = await generateText({
    model: options.model,
    maxRetries: 2,
    messages,
  });
  return options.parse(parseJsonFromModelText(response));
}

export async function runStructuredImageExtraction<T>(options: {
  model: LanguageModel;
  system: string;
  imageBuffer: Buffer;
  mimeType: string;
  promptText: string;
  parse: (raw: unknown) => T;
  ctx?: PipelineLlmContext;
}): Promise<T> {
  const messages: ModelMessage[] = [
    { role: "system", content: options.system },
    {
      role: "user",
      content: [
        { type: "text", text: options.promptText },
        { type: "image", image: options.imageBuffer, mediaType: options.mimeType },
      ],
    },
  ];

  if (options.ctx) {
    return generateStructuredJson({
      trace: {
        model: options.model,
        modelId: options.ctx.modelId,
        provider: options.ctx.provider,
        stage: options.ctx.stage,
        profileId: options.ctx.profileId,
        documentId: options.ctx.documentId,
        providerSwitch: options.ctx.providerSwitch ?? false,
        supabase: options.ctx.supabase,
        temperature: 0,
        messages,
      },
      parse: (raw) => options.parse(parseJsonFromModelText(raw)),
    });
  }

  const { generateText } = await import("ai");
  const { text: response } = await generateText({
    model: options.model,
    maxRetries: 2,
    messages,
  });
  return options.parse(parseJsonFromModelText(response));
}
