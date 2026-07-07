import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getProfileById } from "@/lib/auth/profile";
import { env } from "@/lib/env";

export type AiProviderId = "openai" | "deepseek" | "owl_alpha";

export const AI_PROVIDER_IDS: AiProviderId[] = ["openai", "deepseek", "owl_alpha"];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: "ChatGPT",
  deepseek: "DeepSeek",
  owl_alpha: "Owl Alpha",
};

export const AI_PROVIDER_HINTS: Partial<Record<AiProviderId, string>> = {
};

export function isDeepSeekConfigured(): boolean {
  return Boolean(env.DEEPSEEK_API_KEY?.trim());
}

export function isOwlAlphaConfigured(): boolean {
  return Boolean(env.OWL_ALPHA_API_KEY?.trim());
}

export function isProviderConfigured(provider: AiProviderId): boolean {
  if (provider === "openai") return true;
  if (provider === "deepseek") return isDeepSeekConfigured();
  return isOwlAlphaConfigured();
}

export function providerAvailability() {
  return {
    openai_available: true,
    deepseek_available: isDeepSeekConfigured(),
    owl_alpha_available: isOwlAlphaConfigured(),
  };
}

export function resolveLanguageModel(provider: AiProviderId): LanguageModel {
  if (provider === "deepseek") {
    if (!isDeepSeekConfigured()) {
      throw new Error("DeepSeek is not configured on the server");
    }
    const deepseek = createOpenAI({
      apiKey: env.DEEPSEEK_API_KEY!,
      baseURL: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    });
    return deepseek(env.DEEPSEEK_MODEL ?? "deepseek-chat");
  }

  if (provider === "owl_alpha") {
    if (!isOwlAlphaConfigured()) {
      throw new Error("Owl Alpha is not configured on the server");
    }
    const openrouter = createOpenAI({
      apiKey: env.OWL_ALPHA_API_KEY!,
      baseURL: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": env.URL,
        "X-Title": "EasyHealth",
      },
    });
    return openrouter(env.OWL_ALPHA_MODEL ?? "openrouter/owl-alpha");
  }

  return openai("gpt-4o-mini");
}

export async function resolveModelForProfile(profileId: string): Promise<LanguageModel> {
  const profile = await getProfileById(profileId);
  const provider = (profile.ai_provider as AiProviderId | null) ?? "openai";
  return resolveLanguageModel(provider);
}

/** Default model for stateless agent-facing insight endpoints (no profile). */
export function resolveAgentModel(): LanguageModel {
  return resolveLanguageModel("openai");
}
