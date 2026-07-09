import { validateNebiusModelCatalog } from "../../src/lib/ai/model-catalog.js";
import {
  coreAllowCrossProviderFallback,
  coreIsNebiusConfigured,
  coreModelIdForStage,
  coreResolveLanguageModel,
  coreResolveModelForStage,
  coreResolveOpenAiVisionModel,
} from "../../src/lib/ai/resolve-model-core.js";
import { workerEnv } from "./env.js";

export type AiProviderId =
  | "openai"
  | "deepseek"
  | "owl_alpha"
  | "nebius_fast"
  | "nebius_quality";

export type AiPipelineStage =
  | "classify"
  | "extract_text"
  | "extract_vision"
  | "summarize"
  | "report"
  | "synthesis";

export const allowCrossProviderFallback = coreAllowCrossProviderFallback;
export const resolveLanguageModel = coreResolveLanguageModel;
export const resolveModelForStage = coreResolveModelForStage;
export const resolveOpenAiVisionModel = coreResolveOpenAiVisionModel;
export const modelIdForStage = coreModelIdForStage;

export function modelIdForProvider(provider: AiProviderId): string {
  return coreModelIdForStage(provider, "extract_text");
}

export async function ensureWorkerAiReady(): Promise<void> {
  if (workerEnv.nebiusApiKey || coreIsNebiusConfigured()) {
    await validateNebiusModelCatalog({
      failInProduction: process.env.NODE_ENV === "production",
    });
  }
}
