import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import {
  buildNebiusEnvConfig,
  resolveFastFlavorModelId,
} from "@/lib/ai/nebius-config";
import { getNebiusCatalogIds } from "@/lib/ai/model-catalog";
import type { AiPipelineStage, AiProviderId } from "@/lib/ai/types";
import { isNebiusProvider } from "@/lib/ai/types";

function envOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function coreIsNebiusConfigured(): boolean {
  return Boolean(envOptional("NEBIUS_API_KEY"));
}

export function coreAllowCrossProviderFallback(): boolean {
  const raw = envOptional("ALLOW_CROSS_PROVIDER_FALLBACK");
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

type OpenAiFetch = NonNullable<
  NonNullable<Parameters<typeof createOpenAI>[0]>["fetch"]
>;

/** Nebius Llama models may return tool-calls with empty text unless tool_choice is set. */
const nebiusFetch: OpenAiFetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        if (body.tool_choice == null) {
          body.tool_choice = "none";
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {
        // Keep the original request body if it is not JSON.
      }
    }
    return globalThis.fetch(input, init);
  },
  // The AI SDK fetch contract includes preconnect, which Node's global fetch does not expose.
  { preconnect: async () => undefined }
);

function createNebiusClient() {
  const config = buildNebiusEnvConfig();
  if (!config.apiKey) throw new Error("Nebius is not configured on the server");
  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    fetch: nebiusFetch,
  });
}

export function coreModelIdForStage(provider: AiProviderId, stage: AiPipelineStage): string {
  if (provider === "deepseek") return envOptional("DEEPSEEK_MODEL") ?? "deepseek-chat";
  if (provider === "owl_alpha") return envOptional("OWL_ALPHA_MODEL") ?? "tencent/hy3:free";
  if (provider === "openai") return "gpt-4o-mini";

  const config = buildNebiusEnvConfig();
  const baseId = config.models[provider][stage];
  const catalog = getNebiusCatalogIds();

  if (provider === "nebius_fast" && stage !== "extract_vision") {
    return resolveFastFlavorModelId(baseId, catalog, config.fastFlavorSuffix);
  }

  return baseId;
}

export function coreResolveLanguageModel(provider: AiProviderId, modelId?: string): LanguageModel {
  if (provider === "deepseek") {
    const apiKey = envOptional("DEEPSEEK_API_KEY");
    if (!apiKey) throw new Error("DeepSeek is not configured on the server");
    const client = createOpenAI({
      apiKey,
      baseURL: envOptional("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
    });
    return client(modelId ?? envOptional("DEEPSEEK_MODEL") ?? "deepseek-chat");
  }

  if (provider === "owl_alpha") {
    const apiKey = envOptional("OWL_ALPHA_API_KEY");
    if (!apiKey) throw new Error("Tencent Hy3 (OpenRouter) is not configured on the server");
    const client = createOpenAI({
      apiKey,
      baseURL: envOptional("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": envOptional("URL") ?? "https://easyhealth.app",
        "X-Title": "EasyHealth Worker",
      },
    });
    return client(modelId ?? envOptional("OWL_ALPHA_MODEL") ?? "tencent/hy3:free");
  }

  if (isNebiusProvider(provider)) {
    const client = createNebiusClient();
    return client(modelId ?? coreModelIdForStage(provider, "extract_text"));
  }

  return openai(modelId ?? "gpt-4o-mini");
}

export function coreResolveModelForStage(
  provider: AiProviderId,
  stage: AiPipelineStage
): LanguageModel {
  return coreResolveLanguageModel(provider, coreModelIdForStage(provider, stage));
}

export function coreResolveOpenAiVisionModel(): LanguageModel {
  return openai("gpt-4o-mini");
}
