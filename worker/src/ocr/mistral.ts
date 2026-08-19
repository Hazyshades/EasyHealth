import { createHash } from "node:crypto";
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";
import { workerEnv } from "../env.js";
import {
  OcrProviderError,
  type OcrBlock,
  type OcrDocument,
  type OcrErrorCode,
} from "./types.js";

type MistralOcrRequest = Parameters<Mistral["ocr"]["process"]>[0];
type MistralRequestOptions = Parameters<Mistral["ocr"]["process"]>[1];
type MistralClient = Pick<Mistral, "ocr" | "models">;

const finiteNumber = z.number().finite();
const confidence = finiteNumber.min(0).max(1);
const rawBlockSchema = z
  .object({
    type: z.string().min(1),
    content: z.string(),
    topLeftX: finiteNumber,
    topLeftY: finiteNumber,
    bottomRightX: finiteNumber,
    bottomRightY: finiteNumber,
    confidenceScores: z
      .object({
        averageContentConfidenceScore: confidence.nullable().optional(),
        blockTypeConfidenceScore: confidence.nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const rawPageSchema = z
  .object({
    index: z.number().int().nonnegative(),
    markdown: z.string(),
    dimensions: z
      .object({
        width: finiteNumber.positive(),
        height: finiteNumber.positive(),
      })
      .nullable()
      .optional(),
    confidenceScores: z
      .object({
        averagePageConfidenceScore: confidence.nullable().optional(),
      })
      .nullable()
      .optional(),
    blocks: z.array(rawBlockSchema).nullable().optional(),
  })
  .passthrough();

const rawResponseSchema = z
  .object({
    pages: z.array(rawPageSchema),
    model: z.string().min(1),
    usageInfo: z
      .object({
        pagesProcessed: z.number().int().nonnegative(),
        docSizeBytes: z.number().int().nonnegative().nullable().optional(),
      })
      .optional(),
  })
  .passthrough();

const RETRY_CODES = ["408", "409", "429", "500", "502", "503", "504"];

function redactedStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = error as Record<string, unknown>;
  const candidates = [
    value.statusCode,
    value.status,
    value.response && typeof value.response === "object"
      ? (value.response as Record<string, unknown>).status
      : null,
  ];
  return candidates.find(
    (candidate): candidate is number =>
      typeof candidate === "number" && Number.isInteger(candidate),
  ) ?? null;
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.toLowerCase() : "";
  const code = typeof value.code === "string" ? value.code.toLowerCase() : "";
  return (
    name.includes("timeout") ||
    name.includes("abort") ||
    code === "etimedout" ||
    code === "abort_err"
  );
}

function errorCodeFor(error: unknown): OcrErrorCode {
  if (isTimeoutError(error)) return "ocr_timeout";
  const status = redactedStatus(error);
  if (status === 400 || status === 413 || status === 415 || status === 422) {
    return "ocr_input_rejected";
  }
  return "ocr_provider_unavailable";
}

function stableProviderError(error: unknown): OcrProviderError {
  if (error instanceof OcrProviderError) return error;
  const code = errorCodeFor(error);
  const status = redactedStatus(error);
  const retryable = status === null || status === 408 || status === 409 || status === 429 || status >= 500;
  return new OcrProviderError(code, code, { retryable });
}

function normalizeBlock(
  raw: z.infer<typeof rawBlockSchema>,
  width: number,
  height: number,
): OcrBlock {
  if (raw.bottomRightX <= raw.topLeftX || raw.bottomRightY <= raw.topLeftY) {
    throw new OcrProviderError("ocr_invalid_response");
  }
  if (
    raw.topLeftX < 0 ||
    raw.topLeftY < 0 ||
    raw.bottomRightX > width ||
    raw.bottomRightY > height
  ) {
    throw new OcrProviderError("ocr_invalid_response");
  }
  const bbox = {
    x: raw.topLeftX / width,
    y: raw.topLeftY / height,
    w: (raw.bottomRightX - raw.topLeftX) / width,
    h: (raw.bottomRightY - raw.topLeftY) / height,
  };
  const blockConfidence = raw.confidenceScores?.averageContentConfidenceScore ?? null;
  return {
    type: raw.type,
    text: raw.content,
    confidence: blockConfidence,
    bbox,
  };
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function normalizeMistralResponse(input: {
  response: unknown;
  sourceSha256: string;
  documentBytes: number;
  expectedPageCount: number;
}): OcrDocument {
  const parsed = rawResponseSchema.safeParse(input.response);
  if (!parsed.success) throw new OcrProviderError("ocr_invalid_response");
  if (parsed.data.pages.length !== input.expectedPageCount) {
    throw new OcrProviderError("ocr_page_mismatch");
  }

  const pages = parsed.data.pages.map((page, arrayIndex) => {
    if (page.index !== arrayIndex) throw new OcrProviderError("ocr_page_mismatch");
    const dimensions = page.dimensions ?? null;
    const rawBlocks = page.blocks ?? [];
    if (rawBlocks.length > 0 && !dimensions) {
      throw new OcrProviderError("ocr_invalid_response");
    }
    const blocks = dimensions
      ? rawBlocks.map((block) => normalizeBlock(block, dimensions.width, dimensions.height))
      : [];
    return {
      pageNumber: arrayIndex + 1,
      markdown: page.markdown,
      plainText: markdownToPlainText(page.markdown),
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      averageConfidence: page.confidenceScores?.averagePageConfidenceScore ?? null,
      blocks,
    };
  });

  const pagesProcessed = parsed.data.usageInfo?.pagesProcessed ?? pages.length;
  if (pagesProcessed !== pages.length) throw new OcrProviderError("ocr_page_mismatch");
  return {
    provider: "mistral",
    engine: "mistral-ocr",
    model: parsed.data.model,
    adapterVersion: workerEnv.mistralOcrAdapterVersion,
    sourceSha256: input.sourceSha256,
    pages,
    usage: {
      pagesProcessed,
      documentBytes: input.documentBytes,
    },
  };
}

export function createMistralClient(): Mistral {
  if (!workerEnv.mistralOcrEnabled || !workerEnv.mistralApiKey) {
    throw new OcrProviderError("ocr_provider_unavailable");
  }
  return new Mistral({
    apiKey: workerEnv.mistralApiKey,
    server: workerEnv.mistralOcrRegion,
    timeoutMs: workerEnv.mistralOcrTimeoutMs,
    retryConfig: {
      strategy: "backoff",
      backoff: {
        initialInterval: 200,
        maxInterval: 1_000,
        exponent: 2,
        maxElapsedTime: 2_000,
      },
    },
  });
}

export async function verifyMistralOcrModel(client = createMistralClient()): Promise<void> {
  try {
    const response = await client.models.list(undefined, {
      timeoutMs: workerEnv.mistralOcrTimeoutMs,
      retries: { strategy: "none" },
    });
    const modelIds = (response.data ?? []).flatMap((model) => {
      const candidate = model as { id?: unknown; aliases?: unknown };
      const ids = typeof candidate.id === "string" ? [candidate.id] : [];
      const aliases = Array.isArray(candidate.aliases)
        ? candidate.aliases.filter((alias): alias is string => typeof alias === "string")
        : [];
      return [...ids, ...aliases];
    });
    if (!modelIds.includes(workerEnv.mistralOcrModel)) {
      throw new OcrProviderError("ocr_provider_unavailable");
    }
  } catch (error) {
    throw stableProviderError(error);
  }
}

export async function processMistralOcr(input: {
  buffer: Buffer;
  mimeType: string;
  expectedPageCount: number;
  client?: MistralClient;
}): Promise<OcrDocument> {
  if (input.buffer.length > workerEnv.mistralOcrMaxBytes) {
    throw new OcrProviderError("ocr_input_rejected");
  }
  if (
    input.expectedPageCount <= 0 ||
    input.expectedPageCount > workerEnv.mistralOcrMaxPages
  ) {
    throw new OcrProviderError("ocr_input_rejected");
  }
  if (input.mimeType !== "application/pdf" && !input.mimeType.startsWith("image/")) {
    throw new OcrProviderError("ocr_input_rejected");
  }

  const dataUrl = `data:${input.mimeType};base64,${input.buffer.toString("base64")}`;
  const document = input.mimeType === "application/pdf"
    ? { type: "document_url" as const, documentUrl: dataUrl }
    : { type: "image_url" as const, imageUrl: dataUrl };
  const request = {
    model: workerEnv.mistralOcrModel,
    document,
    includeBlocks: true,
    includeImageBase64: false,
    confidenceScoresGranularity: "block" as const,
    extractHeader: false,
    extractFooter: false,
  } satisfies MistralOcrRequest;

  try {
    const client = input.client ?? createMistralClient();
    const response = await client.ocr.process(request, {
      timeoutMs: workerEnv.mistralOcrTimeoutMs,
      retries: {
        strategy: "backoff",
        backoff: {
          initialInterval: 200,
          maxInterval: 1_000,
          exponent: 2,
          maxElapsedTime: 2_000,
        },
      },
      retryCodes: RETRY_CODES,
    } satisfies MistralRequestOptions);
    return normalizeMistralResponse({
      response,
      sourceSha256: createHash("sha256").update(input.buffer).digest("hex"),
      documentBytes: input.buffer.length,
      expectedPageCount: input.expectedPageCount,
    });
  } catch (error) {
    throw stableProviderError(error);
  }
}
