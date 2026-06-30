import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { workerEnv } from "./env.js";

export type AiProviderId = "openai" | "deepseek" | "owl_alpha";

export function resolveLanguageModel(provider: AiProviderId): LanguageModel {
  if (provider === "deepseek") {
    if (!workerEnv.deepseekApiKey) throw new Error("DeepSeek is not configured");
    const deepseek = createOpenAI({
      apiKey: workerEnv.deepseekApiKey,
      baseURL: workerEnv.deepseekBaseUrl,
    });
    return deepseek(workerEnv.deepseekModel);
  }

  if (provider === "owl_alpha") {
    if (!workerEnv.owlAlphaApiKey) throw new Error("Owl Alpha is not configured");
    const openrouter = createOpenAI({
      apiKey: workerEnv.owlAlphaApiKey,
      baseURL: workerEnv.openrouterBaseUrl,
      headers: {
        "HTTP-Referer": "https://easyhealth.app",
        "X-Title": "EasyHealth Worker",
      },
    });
    return openrouter(workerEnv.owlAlphaModel);
  }

  return openai("gpt-4o-mini");
}

export function modelIdForProvider(provider: AiProviderId): string {
  if (provider === "deepseek") return workerEnv.deepseekModel;
  if (provider === "owl_alpha") return workerEnv.owlAlphaModel;
  return "gpt-4o-mini";
}
