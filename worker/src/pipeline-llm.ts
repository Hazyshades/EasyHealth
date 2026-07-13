import type { LanguageModel } from "ai";
import { VISION_EXTRACTION_FAILURE_MESSAGE } from "../../src/lib/ai/pipeline-trace.js";
import type { PipelineLlmContext } from "../../src/lib/ai/pipeline-trace.js";
import { isNebiusProvider } from "../../src/lib/ai/types.js";
import {
  allowCrossProviderFallback,
  modelIdForStage,
  resolveModelForStage,
  resolveOpenAiVisionModel,
  type AiPipelineStage,
  type AiProviderId,
} from "./ai.js";
import { supabase } from "./supabase.js";

export function makePipelineTrace(
  provider: AiProviderId,
  profileId: string,
  documentId: string,
  stage: AiPipelineStage,
  providerSwitch = false
): PipelineLlmContext {
  const effectiveProvider = providerSwitch ? "openai" : provider;
  return {
    provider: effectiveProvider,
    profileId,
    documentId,
    stage,
    modelId: providerSwitch ? "gpt-4o-mini" : modelIdForStage(provider, stage),
    providerSwitch,
    supabase,
  };
}

export async function runStageTextOrImage<T>(options: {
  ocrText: string;
  pageBuffer: Buffer;
  provider: AiProviderId;
  profileId: string;
  documentId: string;
  filename: string;
  textStage: AiPipelineStage;
  visionStage: AiPipelineStage;
  runText: (
    text: string,
    model: LanguageModel,
    filename: string,
    ctx: PipelineLlmContext
  ) => Promise<T>;
  runImage: (
    buffer: Buffer,
    model: LanguageModel,
    filename: string,
    ctx: PipelineLlmContext
  ) => Promise<T>;
}): Promise<{ result: T; modelId: string }> {
  if (options.ocrText.trim().length > 80) {
    const ctx = makePipelineTrace(
      options.provider,
      options.profileId,
      options.documentId,
      options.textStage
    );
    const model = resolveModelForStage(options.provider, options.textStage);
    const result = await options.runText(options.ocrText, model, options.filename, ctx);
    return { result, modelId: ctx.modelId };
  }

  const visionCtx = makePipelineTrace(
    options.provider,
    options.profileId,
    options.documentId,
    options.visionStage
  );
  const visionModel = resolveModelForStage(options.provider, options.visionStage);

  try {
    const result = await options.runImage(
      options.pageBuffer,
      visionModel,
      options.filename,
      visionCtx
    );
    return { result, modelId: visionCtx.modelId };
  } catch (error) {
    if (!isNebiusProvider(options.provider) || !allowCrossProviderFallback()) {
      throw new Error(VISION_EXTRACTION_FAILURE_MESSAGE);
    }

    const fallbackCtx = makePipelineTrace(
      options.provider,
      options.profileId,
      options.documentId,
      options.visionStage,
      true
    );
    const fallbackModel = resolveOpenAiVisionModel();
    const result = await options.runImage(
      options.pageBuffer,
      fallbackModel,
      options.filename,
      fallbackCtx
    );
    return { result, modelId: "gpt-4o-mini" };
  }
}

export async function runClassifyTextOrImage<T>(options: {
  ocrText: string;
  pageBuffer: Buffer;
  provider: AiProviderId;
  profileId: string;
  documentId: string;
  filename: string;
  runText: (
    text: string,
    model: LanguageModel,
    filename: string,
    ctx: PipelineLlmContext
  ) => Promise<T>;
  runImage: (
    buffer: Buffer,
    model: LanguageModel,
    filename: string,
    ctx: PipelineLlmContext
  ) => Promise<T>;
}): Promise<T> {
  const { result } = await runStageTextOrImage({
    ...options,
    textStage: "classify",
    visionStage: "classify",
    runText: options.runText,
    runImage: (buffer, model, filename, ctx) =>
      options.runImage(buffer, model, filename, ctx),
  });
  return result;
}
