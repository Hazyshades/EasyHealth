import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectOcrSource } from "../worker/src/ocr/select";
import { buildPageOcrArtifactV2, isPageOcrArtifact } from "../src/lib/biomarkers/ocr-artifact";
import type { PdfLayoutPage } from "../src/lib/documents/pdf-text-layout";
import type { OcrProviderError } from "../worker/src/ocr/types";
import type { MistralModelCheckEvidence } from "../worker/src/ocr/model-check";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.OPENAI_API_KEY ??= "test-openai-key";

// The worker env module validates required secrets at import time; this test
// seeds disposable values before loading the adapter boundary.
const {
  normalizeMistralResponse,
  processMistralOcr,
  verifyMistralOcrModel,
} = await import("../worker/src/ocr/mistral");
const { formatMistralModelCheckEvidence } = await import("../worker/src/ocr/model-check");

const layoutPages = (texts: string[]): PdfLayoutPage[] =>
  texts.map((text, index) => ({
    page_number: index + 1,
    width: 100,
    height: 100,
    text,
    lines: [],
  }));

const validResponse = (pageCount = 2) => ({
  pages: Array.from({ length: pageCount }, (_, index) => ({
    index,
    markdown: `# page ${index + 1}\nGlucose 5.${index}`,
    dimensions: { dpi: 200, width: 1000, height: 2000 },
    confidenceScores: {
      averagePageConfidenceScore: 0.98,
    },
    blocks: [
      {
        type: "text",
        content: `Glucose 5.${index}`,
        topLeftX: 100,
        topLeftY: 200,
        bottomRightX: 600,
        bottomRightY: 300,
        confidenceScores: { averageContentConfidenceScore: 0.97 },
      },
    ],
  })),
  model: "mistral-ocr-latest",
  usageInfo: { pagesProcessed: pageCount, docSizeBytes: 12 },
});

const digital = selectOcrSource({
  mimeType: "application/pdf",
  renderedPageCount: 2,
  layoutPages: layoutPages(["A".repeat(60), "B".repeat(60)]),
  pageMarkedText: `=== PAGE 1 ===\n${"A".repeat(60)}\n=== PAGE 2 ===\n${"B".repeat(60)}`,
  mistralEnabled: true,
});
assert.equal(digital.kind, "poppler");

const scanned = selectOcrSource({
  mimeType: "application/pdf",
  renderedPageCount: 2,
  layoutPages: layoutPages(["", ""]),
  pageMarkedText: "",
  mistralEnabled: true,
});
assert.equal(scanned.kind, "mistral");
assert.equal(scanned.reason, "pdf_missing_text");

const image = selectOcrSource({
  mimeType: "image/png",
  renderedPageCount: 1,
  layoutPages: [],
  pageMarkedText: "",
  mistralEnabled: true,
});
assert.equal(image.kind, "mistral");
assert.equal(image.reason, "image_input");

const unavailable = selectOcrSource({
  mimeType: "image/jpeg",
  renderedPageCount: 1,
  layoutPages: [],
  pageMarkedText: "",
  mistralEnabled: false,
});
assert.equal(unavailable.kind, "unavailable");

const normalized = normalizeMistralResponse({
  response: validResponse(),
  sourceSha256: "a".repeat(64),
  documentBytes: 12,
  expectedPageCount: 2,
});
assert.deepEqual(normalized.pages.map((page) => page.pageNumber), [1, 2]);
assert.deepEqual(normalized.pages[0]?.blocks[0]?.bbox, {
  x: 0.1,
  y: 0.1,
  w: 0.5,
  h: 0.05,
});
assert.equal(normalized.pages[0]?.averageConfidence, 0.98);

assert.throws(
  () =>
    normalizeMistralResponse({
      response: {
        ...validResponse(1),
        pages: [{ ...validResponse(1).pages[0], index: 1 }],
      },
      sourceSha256: "a".repeat(64),
      documentBytes: 12,
      expectedPageCount: 1,
    }),
  (error: unknown) => (error as OcrProviderError).code === "ocr_page_mismatch",
);

assert.throws(
  () =>
    normalizeMistralResponse({
      response: {
        ...validResponse(1),
        pages: [
          {
            ...validResponse(1).pages[0],
            blocks: [
              {
                ...validResponse(1).pages[0].blocks[0],
                bottomRightX: 2_000,
              },
            ],
          },
        ],
      },
      sourceSha256: "a".repeat(64),
      documentBytes: 12,
      expectedPageCount: 1,
    }),
  (error: unknown) => (error as OcrProviderError).code === "ocr_invalid_response",
);

const calls: Array<{ document: Record<string, unknown>; options: Record<string, unknown> | undefined }> = [];
const fakeClient = {
  ocr: {
    async process(request: Record<string, unknown>, options?: Record<string, unknown>) {
      calls.push({ document: request.document as Record<string, unknown>, options });
      return validResponse(1);
    },
  },
} as never;

await processMistralOcr({
  buffer: Buffer.from("pdf"),
  mimeType: "application/pdf",
  expectedPageCount: 1,
  client: fakeClient,
});
await processMistralOcr({
  buffer: Buffer.from("png"),
  mimeType: "image/png",
  expectedPageCount: 1,
  client: fakeClient,
});
assert.equal(calls[0]?.document.type, "document_url");
assert.match(String(calls[0]?.document.documentUrl), /^data:application\/pdf;base64,/);
assert.equal(calls[1]?.document.type, "image_url");
assert.match(String(calls[1]?.document.imageUrl), /^data:image\/png;base64,/);
assert.equal(calls[0]?.options?.timeoutMs, 45_000);
const readinessRecords: MistralModelCheckEvidence[] = [];
const recordReadiness = async (evidence: MistralModelCheckEvidence) => {
  readinessRecords.push(evidence);
};
const modelPresentClient = {
  models: {
    async list() {
      return { data: [{ id: "mistral-ocr-latest", aliases: ["mistral-ocr-latest"] }] };
    },
  },
} as never;
const modelCheck = await verifyMistralOcrModel(modelPresentClient, recordReadiness);
assert.equal(modelCheck.modelPresent, true);
assert.equal(modelCheck.success, true);
assert.equal(readinessRecords.at(-1)?.requestedModel, "mistral-ocr-latest");
assert.match(formatMistralModelCheckEvidence(modelCheck), /"model_present":true/);
assert.doesNotMatch(
  formatMistralModelCheckEvidence(modelCheck),
  /api[_-]?key|authorization|raw[_-]?response|patient|document[_-]?content/i,
);

const modelMissingClient = {
  models: {
    async list() {
      return { data: [{ id: "other-model" }] };
    },
  },
} as never;
await assert.rejects(
  () => verifyMistralOcrModel(modelMissingClient, recordReadiness),
  (error: unknown) => (error as OcrProviderError).code === "ocr_provider_unavailable",
);
assert.equal(readinessRecords.at(-1)?.modelPresent, false);
assert.equal(readinessRecords.at(-1)?.errorCode, "ocr_provider_unavailable");

const providerFailureClient = {
  models: {
    async list() {
      throw Object.assign(new Error("provider body must not escape"), { status: 401 });
    },
  },
} as never;
await assert.rejects(
  () => verifyMistralOcrModel(providerFailureClient, recordReadiness),
  (error: unknown) => (error as OcrProviderError).code === "ocr_provider_unavailable",
);
assert.equal(readinessRecords.at(-1)?.errorCode, "ocr_provider_unavailable");

await assert.rejects(
  () => verifyMistralOcrModel(modelPresentClient, async () => {
    throw new Error("database details must not escape");
  }),
  (error: unknown) =>
    error instanceof Error && error.message === "mistral_model_check_evidence_unavailable",
);

assert.equal(readinessRecords.length, 3);


const v2 = buildPageOcrArtifactV2({
  provider: "mistral",
  engine: "mistral-ocr",
  model: "mistral-ocr-latest",
  adapter_version: "eh163-1",
  source_sha256: "a".repeat(64),
  page_number: 1,
  width: 100,
  height: 200,
  full_text: "text",
  markdown: "text",
  blocks: [],
  created_at: "2026-08-19T00:00:00.000Z",
});
assert.equal(isPageOcrArtifact(v2), true);
assert.equal(
  isPageOcrArtifact({ schema_version: 1, engine: "pdf-text", page_number: 1, full_text: "legacy" }),
  true,
);

const adapterSource = await readFile(new URL("../worker/src/ocr/mistral.ts", import.meta.url), "utf8");
assert.doesNotMatch(adapterSource, /\.files\.|\.batch\.|public.*url/i);

console.log("verify-mistral-ocr: all checks passed");
