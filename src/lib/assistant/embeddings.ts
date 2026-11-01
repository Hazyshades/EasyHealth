import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { env } from "@/lib/env";

export const ASSISTANT_EMBEDDING_DIMENSIONS = 1_536;

export type AssistantEmbeddingResult = Readonly<{
  embeddings: readonly (readonly number[])[];
  inputTokens: number;
  provider: "openai";
  modelId: string;
}>;

function assertEmbeddingDimensions(embedding: readonly number[]): void {
  if (
    embedding.length !== ASSISTANT_EMBEDDING_DIMENSIONS ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("assistant_embedding_dimensions_invalid");
  }
}

function embeddingModel() {
  return openai.embedding(env.OPENAI_EMBEDDING_MODEL);
}

export async function embedAssistantQuery(
  value: string,
): Promise<AssistantEmbeddingResult> {
  const result = await embed({
    model: embeddingModel(),
    value: value.trim(),
    maxRetries: 1,
  });
  assertEmbeddingDimensions(result.embedding);
  return {
    embeddings: [result.embedding],
    inputTokens: result.usage.tokens,
    provider: "openai",
    modelId: env.OPENAI_EMBEDDING_MODEL,
  };
}

export async function embedAssistantDocuments(
  values: readonly string[],
): Promise<AssistantEmbeddingResult> {
  if (values.length === 0) {
    return {
      embeddings: [],
      inputTokens: 0,
      provider: "openai",
      modelId: env.OPENAI_EMBEDDING_MODEL,
    };
  }
  const result = await embedMany({
    model: embeddingModel(),
    values: [...values],
    maxParallelCalls: 4,
    maxRetries: 1,
  });
  result.embeddings.forEach(assertEmbeddingDimensions);
  return {
    embeddings: result.embeddings,
    inputTokens: result.usage.tokens,
    provider: "openai",
    modelId: env.OPENAI_EMBEDDING_MODEL,
  };
}
