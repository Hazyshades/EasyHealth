import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPipelineStage, AiProviderId } from "@/lib/ai/types";

export type PipelineLlmContext = {
  provider: AiProviderId;
  profileId: string;
  documentId: string | null;
  stage: AiPipelineStage;
  modelId: string;
  providerSwitch?: boolean;
  supabase: SupabaseClient;
};

export const VISION_EXTRACTION_FAILURE_MESSAGE =
  "Vision extraction failed. Try a clearer scan, switch to ChatGPT in AI Settings, or ask your administrator to enable cross-provider fallback for development.";
