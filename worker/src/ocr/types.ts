import type { OcrBbox } from "../../../src/lib/biomarkers/ocr-artifact.js";

export const OCR_SOURCE_TEXT_ORIGINS = [
  "pdf_text_layer",
  "mistral_ocr",
  "vision_model",
] as const;

export type OcrSourceTextOrigin = (typeof OCR_SOURCE_TEXT_ORIGINS)[number];

export type OcrProvider = "poppler" | "mistral";

export type OcrBlock = {
  type: string;
  text: string;
  confidence: number | null;
  bbox: OcrBbox | null;
};

export type OcrPage = {
  pageNumber: number;
  markdown: string;
  plainText: string;
  width: number | null;
  height: number | null;
  averageConfidence: number | null;
  blocks: OcrBlock[];
};

export type OcrDocument = {
  provider: OcrProvider;
  engine: string;
  model: string | null;
  adapterVersion: string;
  sourceSha256: string;
  pages: OcrPage[];
  usage: {
    pagesProcessed: number | null;
    documentBytes: number;
  };
};

export type OcrErrorCode =
  | "ocr_provider_unavailable"
  | "ocr_timeout"
  | "ocr_invalid_response"
  | "ocr_input_rejected"
  | "ocr_page_mismatch";

export class OcrProviderError extends Error {
  readonly code: OcrErrorCode;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(
    code: OcrErrorCode,
    message = code,
    options?: { retryable?: boolean; requestId?: string | null },
  ) {
    super(message);
    this.name = "OcrProviderError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.requestId = options?.requestId ?? null;
  }
}

export type OcrSelectionReason =
  | "digital_pdf_complete_text"
  | "image_input"
  | "pdf_missing_text"
  | "pdf_partial_text"
  | "pdf_page_count_mismatch"
  | "mistral_disabled";

export type OcrSelection =
  | {
      kind: "poppler";
      reason: "digital_pdf_complete_text";
      sourceTextOrigin: "pdf_text_layer";
    }
  | {
      kind: "mistral";
      reason: Exclude<OcrSelectionReason, "digital_pdf_complete_text" | "mistral_disabled">;
      sourceTextOrigin: "mistral_ocr";
    }
  | {
      kind: "legacy_vision" | "unavailable";
      reason: "mistral_disabled";
      sourceTextOrigin: "vision_model";
    };
