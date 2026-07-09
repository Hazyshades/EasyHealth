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

export type NebiusTier = "nebius_fast" | "nebius_quality";

export function isNebiusProvider(provider: AiProviderId): provider is NebiusTier {
  return provider === "nebius_fast" || provider === "nebius_quality";
}

export type AiInvocationRow = {
  profile_id: string;
  document_id: string | null;
  stage: AiPipelineStage | string;
  provider: AiProviderId | string;
  model_id: string;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  success: boolean;
  error_code: string | null;
  provider_switch: boolean;
};
