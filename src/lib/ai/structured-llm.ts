import { generateText, type LanguageModel, type ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiInvocation } from "@/lib/ai/invocation-log";
import type { AiInvocationRow, AiPipelineStage, AiProviderId } from "@/lib/ai/types";
import { isNebiusProvider } from "@/lib/ai/types";
import { temperatureForModel } from "@/lib/ai/model-capabilities";

export type TraceGenerateOptions = {
  model: LanguageModel;
  modelId: string;
  provider: AiProviderId;
  stage: AiPipelineStage | string;
  profileId: string;
  documentId?: string | null;
  providerSwitch?: boolean;
  temperature?: number;
  structuredJson?: boolean;
  messages: ModelMessage[];
  supabase?: SupabaseClient;
};

function nebiusUserMetadata(documentId: string | null | undefined, stage: string): string | undefined {
  if (!documentId) return undefined;
  return `easyhealth:${documentId}:${stage}`;
}

function splitSystemMessage(messages: ModelMessage[]): {
  system?: string;
  messages: ModelMessage[];
} {
  const systemParts: string[] = [];
  const rest: ModelMessage[] = [];

  for (const message of messages) {
    if (message.role === "system" && typeof message.content === "string") {
      systemParts.push(message.content);
      continue;
    }
    rest.push(message);
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: rest,
  };
}

export async function traceGenerateText(options: TraceGenerateOptions): Promise<string> {
  const started = Date.now();
  const providerSwitch = options.providerSwitch ?? false;
  const useNebius = isNebiusProvider(options.provider);
  const { system, messages } = splitSystemMessage(options.messages);
  const temperature = temperatureForModel(
    options.provider,
    options.modelId,
    options.temperature,
  );

  try {
    const userMeta = useNebius ? nebiusUserMetadata(options.documentId, String(options.stage)) : undefined;
    // Nebius models (incl. DeepSeek-V4-Pro) may return HTTP 400 with response_format json_object.
    const useJsonResponseFormat = options.structuredJson && !useNebius;

    const { text, usage } = await generateText({
      model: options.model,
      system,
      ...(temperature !== undefined ? { temperature } : {}),
      maxRetries: 1,
      messages,
      providerOptions: {
        openai: {
          ...(useJsonResponseFormat ? { responseFormat: { type: "json_object" as const } } : {}),
          ...(userMeta ? { user: userMeta } : {}),
        },
      },
    });

    if (options.supabase) {
      const row: AiInvocationRow = {
        profile_id: options.profileId,
        document_id: options.documentId ?? null,
        stage: options.stage,
        provider: options.provider,
        model_id: options.modelId,
        latency_ms: Date.now() - started,
        input_tokens: usage?.inputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
        success: true,
        error_code: null,
        provider_switch: providerSwitch,
      };
      await logAiInvocation(options.supabase, row);
    }

    return text;
  } catch (error) {
    if (options.supabase) {
      const row: AiInvocationRow = {
        profile_id: options.profileId,
        document_id: options.documentId ?? null,
        stage: options.stage,
        provider: options.provider,
        model_id: options.modelId,
        latency_ms: Date.now() - started,
        input_tokens: null,
        output_tokens: null,
        success: false,
        error_code: error instanceof Error ? error.message.slice(0, 240) : "llm_error",
        provider_switch: providerSwitch,
      };
      await logAiInvocation(options.supabase, row);
    }
    throw error;
  }
}

export async function generateStructuredJson<T>(options: {
  trace: TraceGenerateOptions;
  parse: (rawText: string) => T;
}): Promise<T> {
  const firstPass = await traceGenerateText({
    ...options.trace,
    structuredJson: true,
    temperature: options.trace.temperature ?? 0,
  });

  try {
    return options.parse(firstPass);
  } catch {
    const retryText = await traceGenerateText({
      ...options.trace,
      structuredJson: true,
      temperature: 0,
    });
    return options.parse(retryText);
  }
}
