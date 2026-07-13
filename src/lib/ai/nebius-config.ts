import type { AiPipelineStage, NebiusTier } from "@/lib/ai/types";

export type NebiusEnvConfig = {
  apiKey?: string;
  baseUrl: string;
  region: string;
  fastFlavorSuffix: string;
  allowCrossProviderFallback: boolean;
  models: Record<NebiusTier, Record<AiPipelineStage, string>>;
};

const DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1";

const DEFAULT_MODEL_MAP: Record<NebiusTier, Record<AiPipelineStage, string>> = {
  nebius_fast: {
    classify: "meta-llama/Llama-3.3-70B-Instruct",
    extract_text: "meta-llama/Llama-3.3-70B-Instruct",
    extract_vision: "openbmb/MiniCPM-V-4_5",
    summarize: "meta-llama/Llama-3.3-70B-Instruct",
    report: "meta-llama/Llama-3.3-70B-Instruct",
    synthesis: "meta-llama/Llama-3.3-70B-Instruct",
  },
  nebius_quality: {
    classify: "meta-llama/Llama-3.3-70B-Instruct",
    extract_text: "meta-llama/Llama-3.3-70B-Instruct",
    extract_vision: "Qwen/Qwen2.5-VL-72B-Instruct",
    summarize: "meta-llama/Llama-3.3-70B-Instruct",
    report: "deepseek-ai/DeepSeek-V4-Pro",
    synthesis: "deepseek-ai/DeepSeek-V4-Pro",
  },
};

const STAGE_ENV_KEYS: Record<NebiusTier, Record<AiPipelineStage, string>> = {
  nebius_fast: {
    classify: "NEBIUS_FAST_CLASSIFY_MODEL",
    extract_text: "NEBIUS_FAST_EXTRACT_TEXT_MODEL",
    extract_vision: "NEBIUS_FAST_EXTRACT_VISION_MODEL",
    summarize: "NEBIUS_FAST_SUMMARIZE_MODEL",
    report: "NEBIUS_FAST_REPORT_MODEL",
    synthesis: "NEBIUS_FAST_SYNTHESIS_MODEL",
  },
  nebius_quality: {
    classify: "NEBIUS_QUALITY_CLASSIFY_MODEL",
    extract_text: "NEBIUS_QUALITY_EXTRACT_TEXT_MODEL",
    extract_vision: "NEBIUS_QUALITY_EXTRACT_VISION_MODEL",
    summarize: "NEBIUS_QUALITY_SUMMARIZE_MODEL",
    report: "NEBIUS_QUALITY_REPORT_MODEL",
    synthesis: "NEBIUS_QUALITY_SYNTHESIS_MODEL",
  },
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readBool(name: string, defaultValue: boolean): boolean {
  const raw = readEnv(name);
  if (raw === undefined) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function buildNebiusEnvConfig(): NebiusEnvConfig {
  const models = {
    nebius_fast: { ...DEFAULT_MODEL_MAP.nebius_fast },
    nebius_quality: { ...DEFAULT_MODEL_MAP.nebius_quality },
  } satisfies Record<NebiusTier, Record<AiPipelineStage, string>>;

  for (const tier of ["nebius_fast", "nebius_quality"] as const) {
    for (const stage of Object.keys(STAGE_ENV_KEYS[tier]) as AiPipelineStage[]) {
      const override = readEnv(STAGE_ENV_KEYS[tier][stage]);
      if (override) models[tier][stage] = override;
    }
  }

  return {
    apiKey: readEnv("NEBIUS_API_KEY"),
    baseUrl: readEnv("NEBIUS_BASE_URL") ?? DEFAULT_BASE_URL,
    region: readEnv("NEBIUS_REGION") ?? "eu-north1",
    fastFlavorSuffix: readEnv("NEBIUS_FAST_FLAVOR_SUFFIX") ?? "-fast",
    allowCrossProviderFallback: readBool("ALLOW_CROSS_PROVIDER_FALLBACK", false),
    models,
  };
}

export function resolveFastFlavorModelId(
  baseModelId: string,
  catalogIds: Set<string>,
  suffix: string
): string {
  if (!suffix) return baseModelId;
  const candidate = `${baseModelId}${suffix}`;
  return catalogIds.has(candidate) ? candidate : baseModelId;
}

export function configuredNebiusModelIds(config: NebiusEnvConfig): string[] {
  const ids = new Set<string>();
  for (const tier of ["nebius_fast", "nebius_quality"] as const) {
    for (const stage of Object.keys(config.models[tier]) as AiPipelineStage[]) {
      ids.add(config.models[tier][stage]);
    }
  }
  return [...ids];
}
