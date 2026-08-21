import type { PdfLayoutPage } from "../../../src/lib/documents/pdf-text-layout.js";
import type { OcrSelection } from "./types.js";

const MIN_TEXT_LENGTH = 80;

export function selectOcrSource(input: {
  mimeType: string;
  renderedPageCount: number;
  layoutPages: readonly PdfLayoutPage[];
  pageMarkedText: string;
  mistralEnabled: boolean;
}): OcrSelection {
  const isPdf = input.mimeType === "application/pdf";
  if (!isPdf) {
    return input.mistralEnabled
      ? { kind: "mistral", reason: "image_input", sourceTextOrigin: "mistral_ocr" }
      : { kind: "unavailable", reason: "mistral_disabled", sourceTextOrigin: "vision_model" };
  }

  const pageCountMatches = input.layoutPages.length === input.renderedPageCount;
  const everyPageHasText =
    pageCountMatches &&
    input.layoutPages.every((page) => page.text.trim().length > 0);
  const hasCompleteLocalText =
    everyPageHasText && input.pageMarkedText.trim().length > MIN_TEXT_LENGTH;

  if (hasCompleteLocalText) {
    return {
      kind: "poppler",
      reason: "digital_pdf_complete_text",
      sourceTextOrigin: "pdf_text_layer",
    };
  }

  if (!input.mistralEnabled) {
    return { kind: "unavailable", reason: "mistral_disabled", sourceTextOrigin: "vision_model" };
  }

  return {
    kind: "mistral",
    reason: !pageCountMatches
      ? "pdf_page_count_mismatch"
      : !everyPageHasText
        ? "pdf_missing_text"
        : "pdf_partial_text",
    sourceTextOrigin: "mistral_ocr",
  };
}
