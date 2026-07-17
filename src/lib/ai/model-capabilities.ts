import type { AiProviderId } from "@/lib/ai/types";

export type ModelCapabilities = {
  supportsTemperature: boolean;
};

const NO_TEMPERATURE_MODEL_PATTERNS = [
  /(^|[/_.-])gpt-5(?:[/_.-]|$)/i,
  /(^|[/_.-])o[134](?:[/_.-]|$)/i,
  /reasoner|reasoning/i,
  /deepseek-(?:r1|v4)/i,
  /(^|[/_.-])qwq(?:[/_.-]|$)/i,
  /qwen3.*(?:thinking|reasoning)/i,
];

export function resolveModelCapabilities(
  _provider: AiProviderId,
  modelId: string,
): ModelCapabilities {
  return {
    supportsTemperature: !NO_TEMPERATURE_MODEL_PATTERNS.some((pattern) =>
      pattern.test(modelId),
    ),
  };
}

export function temperatureForModel(
  provider: AiProviderId,
  modelId: string,
  temperature: number | undefined,
): number | undefined {
  if (temperature === undefined) return undefined;
  return resolveModelCapabilities(provider, modelId).supportsTemperature
    ? temperature
    : undefined;
}
