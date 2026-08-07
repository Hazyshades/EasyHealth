/**
 * EH-118 page index and geometry adapter for poppler `pdftotext -bbox-layout`.
 *
 * The worker already depends on poppler for rasterization, so word geometry is
 * available without adding an OCR vendor. This module is a pure parser so the
 * page index and the coordinate normalization can be verified without poppler
 * or a database.
 *
 * `pdftotext` emits coordinates in PDF user space (points, origin top-left of
 * the page box). They are normalized here against the page box declared in the
 * same document, which makes them independent of the preview raster size.
 */

import type { OcrBbox } from "@/lib/biomarkers/ocr-artifact";

export type PdfLayoutWord = {
  text: string;
  bbox: OcrBbox;
};

export type PdfLayoutLine = {
  text: string;
  bbox: OcrBbox;
  words: PdfLayoutWord[];
};

export type PdfLayoutPage = {
  page_number: number;
  /** Page box width in PDF points, kept for diagnostics and re-derivation. */
  width: number;
  height: number;
  text: string;
  lines: PdfLayoutLine[];
};

const PAGE_TAG = /<page\b([^>]*)>([\s\S]*?)<\/page>/g;
const LINE_TAG = /<line\b([^>]*)>([\s\S]*?)<\/line>/g;
const WORD_TAG = /<word\b([^>]*)>([\s\S]*?)<\/word>/g;
const ATTRIBUTE = /([A-Za-z_:][-\w.:]*)\s*=\s*"([^"]*)"/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

function decodeXmlText(value: string): string {
  return value.replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function readAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let match = ATTRIBUTE.exec(source);
  while (match) {
    attributes[match[1]] = match[2];
    match = ATTRIBUTE.exec(source);
  }
  return attributes;
}

function normalizedBox(
  attributes: Record<string, string>,
  pageWidth: number,
  pageHeight: number
): OcrBbox | null {
  const xMin = Number.parseFloat(attributes.xMin ?? "");
  const yMin = Number.parseFloat(attributes.yMin ?? "");
  const xMax = Number.parseFloat(attributes.xMax ?? "");
  const yMax = Number.parseFloat(attributes.yMax ?? "");
  if (![xMin, yMin, xMax, yMax].every(Number.isFinite)) return null;
  if (pageWidth <= 0 || pageHeight <= 0) return null;
  if (xMax <= xMin || yMax <= yMin) return null;

  return {
    x: xMin / pageWidth,
    y: yMin / pageHeight,
    w: (xMax - xMin) / pageWidth,
    h: (yMax - yMin) / pageHeight,
  };
}

/**
 * Parse `pdftotext -bbox-layout` XHTML into a normalized page index.
 *
 * Returns an empty array for empty, truncated, or non-layout output; the caller
 * then falls back to plain page text without geometry.
 */
export function parsePdfBboxLayout(xml: string): PdfLayoutPage[] {
  if (!xml || !xml.includes("<page")) return [];

  const pages: PdfLayoutPage[] = [];
  PAGE_TAG.lastIndex = 0;
  let pageMatch = PAGE_TAG.exec(xml);
  let pageNumber = 0;

  while (pageMatch) {
    pageNumber += 1;
    const pageAttributes = readAttributes(pageMatch[1]);
    const pageWidth = Number.parseFloat(pageAttributes.width ?? "");
    const pageHeight = Number.parseFloat(pageAttributes.height ?? "");
    const body = pageMatch[2];

    const lines: PdfLayoutLine[] = [];
    LINE_TAG.lastIndex = 0;
    let lineMatch = LINE_TAG.exec(body);
    while (lineMatch) {
      const words: PdfLayoutWord[] = [];
      WORD_TAG.lastIndex = 0;
      let wordMatch = WORD_TAG.exec(lineMatch[2]);
      while (wordMatch) {
        const text = decodeXmlText(wordMatch[2]).trim();
        const bbox = normalizedBox(readAttributes(wordMatch[1]), pageWidth, pageHeight);
        if (text && bbox) words.push({ text, bbox });
        wordMatch = WORD_TAG.exec(lineMatch[2]);
      }

      if (words.length > 0) {
        const lineBox = normalizedBox(readAttributes(lineMatch[1]), pageWidth, pageHeight);
        lines.push({
          text: words.map((word) => word.text).join(" "),
          bbox: lineBox ?? {
            x: Math.min(...words.map((word) => word.bbox.x)),
            y: Math.min(...words.map((word) => word.bbox.y)),
            w:
              Math.max(...words.map((word) => word.bbox.x + word.bbox.w)) -
              Math.min(...words.map((word) => word.bbox.x)),
            h:
              Math.max(...words.map((word) => word.bbox.y + word.bbox.h)) -
              Math.min(...words.map((word) => word.bbox.y)),
          },
          words,
        });
      }
      lineMatch = LINE_TAG.exec(body);
    }

    pages.push({
      page_number: pageNumber,
      width: Number.isFinite(pageWidth) ? pageWidth : 0,
      height: Number.isFinite(pageHeight) ? pageHeight : 0,
      text: lines.map((line) => line.text).join("\n"),
      lines,
    });

    pageMatch = PAGE_TAG.exec(xml);
  }

  return pages;
}

/**
 * Split plain `pdftotext` output into pages. Poppler separates pages with a
 * form feed, so this recovers the page index when layout parsing is
 * unavailable (scanned PDFs, older poppler builds, images).
 */
export function splitPlainTextPages(fullText: string): string[] {
  if (!fullText) return [];
  const parts = fullText.split("\f");
  // A trailing form feed produces an empty final element that is not a page.
  if (parts.length > 1 && parts[parts.length - 1].trim() === "") parts.pop();
  return parts;
}

/**
 * Page marker the extraction prompts key `source_page` off. Without it the
 * model receives one undifferentiated text blob and its page attribution is a
 * guess; with it the page number is stated in the input the model reads.
 */
export function pageMarker(pageNumber: number): string {
  return `=== PAGE ${pageNumber} ===`;
}

/** Assemble page-marked extraction input from a page-indexed document. */
export function buildPageMarkedText(
  pages: readonly { page_number: number; text: string }[]
): string {
  return pages
    .map((page) => `${pageMarker(page.page_number)}\n${page.text.trim()}`)
    .join("\n\n");
}
