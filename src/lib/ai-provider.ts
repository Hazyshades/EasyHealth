import { getProfileById } from "@/lib/auth/profile";
import { env } from "@/lib/env";
import { validateNebiusModelCatalog } from "@/lib/ai/model-catalog";
import type { AiPipelineStage, AiProviderId } from "@/lib/ai/types";
import {
  coreAllowCrossProviderFallback,
  coreIsNebiusConfigured,
  coreModelIdForStage,
  coreResolveLanguageModel,
  coreResolveModelForStage,
  coreResolveOpenAiVisionModel,
} from "@/lib/ai/resolve-model-core";

export type { AiProviderId, AiPipelineStage } from "@/lib/ai/types";

export const AI_PROVIDER_IDS: AiProviderId[] = [
  "openai",
  "deepseek",
  "owl_alpha",
  "nebius_fast",
  "nebius_quality",
];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: "ChatGPT",
  deepseek: "DeepSeek",
  owl_alpha: "Tencent Hy3 (free)",
  nebius_fast: "Nebius Fast",
  nebius_quality: "Nebius Quality",
};

export const AI_PROVIDER_HINTS: Partial<Record<AiProviderId, string>> = {
  nebius_fast: "Faster processing and lower cost on Nebius open models.",
  nebius_quality: "Higher-quality extraction and reports on Nebius open models.",
};

export function isNebiusConfigured(): boolean {
  return Boolean(env.NEBIUS_API_KEY?.trim());
}

export function isDeepSeekConfigured(): boolean {
  return Boolean(env.DEEPSEEK_API_KEY?.trim());
}

export function isOwlAlphaConfigured(): boolean {
  return Boolean(env.OWL_ALPHA_API_KEY?.trim());
}

export function isProviderConfigured(provider: AiProviderId): boolean {
  if (provider === "openai") return true;
  if (provider === "deepseek") return isDeepSeekConfigured();
  if (provider === "owl_alpha") return isOwlAlphaConfigured();
  return isNebiusConfigured();
}

export function allowCrossProviderFallback(): boolean {
  return env.ALLOW_CROSS_PROVIDER_FALLBACK;
}

export function providerAvailability() {
  const nebius = isNebiusConfigured();
  return {
    openai_available: true,
    deepseek_available: isDeepSeekConfigured(),
    owl_alpha_available: isOwlAlphaConfigured(),
    nebius_fast_available: nebius,
    nebius_quality_available: nebius,
  };
}

export const modelIdForStage = coreModelIdForStage;
export const resolveLanguageModel = coreResolveLanguageModel;
export const resolveModelForStage = coreResolveModelForStage;
export const resolveOpenAiVisionModel = coreResolveOpenAiVisionModel;
export { validateNebiusModelCatalog };

export async function resolveModelForProfile(profileId: string) {
  const profile = await getProfileById(profileId);
  const provider = (profile.ai_provider as AiProviderId | null) ?? "openai";
  return resolveLanguageModel(provider);
}

export async function resolveModelForProfileStage(profileId: string, stage: AiPipelineStage) {
  const profile = await getProfileById(profileId);
  const provider = (profile.ai_provider as AiProviderId | null) ?? "openai";
  return resolveModelForStage(provider, stage);
}

export function modelIdForProvider(provider: AiProviderId): string {
  return modelIdForStage(provider, "extract_text");
}

// Ensure worker-side catalog validation can call the same helper
export function isNebiusConfiguredCore(): boolean {
  return coreIsNebiusConfigured();
}

export function allowCrossProviderFallbackCore(): boolean {
  return coreAllowCrossProviderFallback();
}
