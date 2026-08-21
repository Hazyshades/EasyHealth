/**
 * EH-162 OCR/LLM provenance adapter.
 *
 * Extraction models report a page hint and a verbatim snippet, but never see
 * page geometry. This module grounds the quote against Poppler's positional
 * index and preserves the match quality in the canonical source-region payload.
 * Only an exact unique match is renderable by the review workspace.
 */

import type { OcrBbox } from "@/lib/biomarkers/ocr-artifact";
import type { PdfLayoutPage } from "@/lib/documents/pdf-text-layout";
import {
  buildSourceRegion,
  padBbox,
  unionBbox,
  type SourceRegion,
  type SourceRegionMatchStrategy,
} from "@/lib/documents/source-region";

export type SourceIndexWord = {
  text: string;
  bbox: OcrBbox;
};

export type SourceIndexPage = {
  page_number: number;
  words: SourceIndexWord[];
};

export type SourceRegionStrategy =
  /** Snippet matched a unique run of words on one page. */
  | "ocr_exact"
  /** Snippet matched a single best-scoring window above the diagnostic threshold. */
  | "ocr_fuzzy"
  /** No trustworthy region; the model page hint is inside the page index. */
  | "page_hint"
  /** No trustworthy region and no usable hint; first page is used. */
  | "page_default"
  /** The document has no page index at all. */
  | "unavailable";

export type SourceRegionResolution = {
  page: number | null;
  region: SourceRegion | null;
  strategy: SourceRegionStrategy;
};

/** Minimum share of snippet tokens a fuzzy window must cover to be accepted. */
const FUZZY_ACCEPT_RATIO = 0.7;

/** A one-token snippet carries too little signal to place a box safely. */
const MIN_MATCH_TOKENS = 2;

/** A match spread over more than a fifth of the page is not trustworthy. */
const MAX_REGION_HEIGHT = 0.2;

/** Words whose vertical centres fall within this share of a line height are one row. */
const ROW_BAND_RATIO = 0.6;

/** Normalized margin so glyph edges and descenders are not clipped. */
const REGION_PADDING = 0.004;

const TOKEN_STRIP = /[^\p{L}\p{N}.%<>/+-]+/gu;
const TOKEN_TRIM = /^[.+/-]+|[.+/-]+$/g;

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // A decimal comma is the same value as a decimal point for matching purposes.
  for (const part of text.replace(/(\d),(\d)/g, "$1.$2").split(/\s+/)) {
    const token = part
      .toLocaleLowerCase()
      .replace(TOKEN_STRIP, "")
      .replace(TOKEN_TRIM, "");
    if (token) tokens.push(token);
  }
  return tokens;
}

type PageTokenIndex = {
  page_number: number;
  tokens: string[];
  /** `boxes[i]` is the geometry of `tokens[i]`. */
  boxes: OcrBbox[];
};

/**
 * Reorder a page's words into visual reading order: rows top to bottom, words
 * left to right inside each row. Poppler's layout flow can emit table columns
 * as whole blocks, so the cells of a visual row must be rebuilt before matching.
 */
function orderWordsByVisualRow(words: readonly SourceIndexWord[]): SourceIndexWord[] {
  if (words.length < 2) return [...words];

  const heights = words.map((word) => word.bbox.h).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 0;
  const tolerance = medianHeight > 0 ? medianHeight * ROW_BAND_RATIO : 0;

  const byBaseline = [...words].sort(
    (a, b) => a.bbox.y + a.bbox.h / 2 - (b.bbox.y + b.bbox.h / 2),
  );

  const ordered: SourceIndexWord[] = [];
  let row: SourceIndexWord[] = [];
  let rowBaseline = 0;
  for (const word of byBaseline) {
    const baseline = word.bbox.y + word.bbox.h / 2;
    if (row.length > 0 && Math.abs(baseline - rowBaseline) > tolerance) {
      ordered.push(...row.sort((a, b) => a.bbox.x - b.bbox.x));
      row = [];
    }
    if (row.length === 0) rowBaseline = baseline;
    row.push(word);
  }
  ordered.push(...row.sort((a, b) => a.bbox.x - b.bbox.x));
  return ordered;
}

/** Flatten a Poppler layout page into the word index the matcher consumes. */
export function buildSourceIndex(pages: readonly PdfLayoutPage[]): SourceIndexPage[] {
  return pages.map((page) => ({
    page_number: page.page_number,
    words: orderWordsByVisualRow(
      page.lines.flatMap((line) =>
        line.words.map((word) => ({ text: word.text, bbox: word.bbox })),
      ),
    ),
  }));
}

function indexPage(page: SourceIndexPage): PageTokenIndex {
  const tokens: string[] = [];
  const boxes: OcrBbox[] = [];
  for (const word of page.words) {
    // One OCR word can normalize into several tokens ("5.4mmol/L"); each
    // token keeps its source word geometry so the union stays tight.
    for (const token of tokenize(word.text)) {
      tokens.push(token);
      boxes.push(word.bbox);
    }
  }
  return { page_number: page.page_number, tokens, boxes };
}

function splitMatchedLines(boxes: readonly OcrBbox[]): OcrBbox[] {
  if (boxes.length === 0) return [];
  const heights = boxes.map((box) => box.h).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 0;
  const tolerance = medianHeight > 0 ? medianHeight * ROW_BAND_RATIO : 0;
  const lines: OcrBbox[][] = [];
  let current: OcrBbox[] = [];
  let baseline = 0;

  for (const box of boxes) {
    const nextBaseline = box.y + box.h / 2;
    if (current.length > 0 && Math.abs(nextBaseline - baseline) > tolerance) {
      const line = unionBbox(current);
      if (line) lines.push([line]);
      current = [];
    }
    if (current.length === 0) baseline = nextBaseline;
    current.push(box);
  }
  const last = unionBbox(current);
  if (last) lines.push([last]);
  return lines.flat();
}

function regionFrom(
  index: PageTokenIndex,
  start: number,
  end: number,
  strategy: "ocr_exact" | "ocr_fuzzy",
  score: number,
): SourceRegion | null {
  const matchedBoxes = index.boxes.slice(start, end);
  const span = unionBbox(matchedBoxes);
  if (!span || span.h > MAX_REGION_HEIGHT) return null;
  const rects = splitMatchedLines(matchedBoxes).map((line) =>
    padBbox(line, REGION_PADDING),
  );
  const matchStrategy: SourceRegionMatchStrategy =
    strategy === "ocr_exact" ? "exact" : "fuzzy";
  return buildSourceRegion({
    page: index.page_number,
    rects,
    match: {
      strategy: matchStrategy,
      score,
      engine: "pdf-text-bbox",
      resolver_version: "1",
    },
  });
}

function exactMatchStarts(tokens: string[], needle: string[]): number[] {
  const starts: number[] = [];
  const last = tokens.length - needle.length;
  for (let start = 0; start <= last; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (tokens[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) starts.push(start);
  }
  return starts;
}

type FuzzyWindow = { start: number; end: number; score: number };

/** Best order-insensitive token overlap over a sliding window. */
function bestFuzzyWindow(tokens: string[], needle: string[]): FuzzyWindow | null {
  if (tokens.length === 0) return null;
  const size = Math.min(needle.length, tokens.length);
  const wanted = new Map<string, number>();
  for (const token of needle) wanted.set(token, (wanted.get(token) ?? 0) + 1);

  let best: FuzzyWindow | null = null;
  for (let start = 0; start + size <= tokens.length; start += 1) {
    const remaining = new Map(wanted);
    let hits = 0;
    let firstHit = -1;
    let lastHit = -1;
    for (let offset = 0; offset < size; offset += 1) {
      const token = tokens[start + offset];
      const left = remaining.get(token) ?? 0;
      if (left > 0) {
        remaining.set(token, left - 1);
        hits += 1;
        if (firstHit < 0) firstHit = start + offset;
        lastHit = start + offset;
      }
    }
    const score = hits / needle.length;
    if (hits >= MIN_MATCH_TOKENS && (!best || score > best.score)) {
      best = { start: firstHit, end: lastHit + 1, score };
    }
  }
  return best;
}

/** Resolve the page and, when safe, the deterministic source region. */
export function resolveSourceRegion(input: {
  pages: readonly SourceIndexPage[];
  pageCount: number;
  snippet: string | null | undefined;
  hintedPage: number | null | undefined;
}): SourceRegionResolution {
  const { pageCount } = input;
  const hinted =
    typeof input.hintedPage === "number" &&
    Number.isInteger(input.hintedPage) &&
    input.hintedPage >= 1 &&
    input.hintedPage <= pageCount
      ? input.hintedPage
      : null;

  const fallback: SourceRegionResolution =
    pageCount < 1
      ? { page: null, region: null, strategy: "unavailable" }
      : hinted !== null
        ? { page: hinted, region: null, strategy: "page_hint" }
        : { page: 1, region: null, strategy: "page_default" };

  const needle = tokenize(input.snippet ?? "");
  if (needle.length < MIN_MATCH_TOKENS) return fallback;

  const indexes = input.pages
    .map(indexPage)
    .filter((page) => page.tokens.length > 0);
  if (indexes.length === 0) return fallback;

  // Any duplicate exact run is ambiguous, even when one copy is on the model's
  // hinted page. A hint must never turn duplicate text into a visual claim.
  const exact = indexes.flatMap((index) =>
    exactMatchStarts(index.tokens, needle).map((start) => ({ index, start })),
  );
  if (exact.length > 1) return fallback;

  const unique = exact[0];
  if (unique) {
    const region = regionFrom(
      unique.index,
      unique.start,
      unique.start + needle.length,
      "ocr_exact",
      1,
    );
    if (region) {
      return { page: unique.index.page_number, region, strategy: "ocr_exact" };
    }
  }

  const scored = indexes
    .map((index) => ({ index, window: bestFuzzyWindow(index.tokens, needle) }))
    .filter(
      (entry): entry is { index: PageTokenIndex; window: FuzzyWindow } =>
        entry.window !== null,
    )
    .sort((a, b) => b.window.score - a.window.score);

  const top = scored[0];
  if (!top || top.window.score < FUZZY_ACCEPT_RATIO) return fallback;
  // A tie between pages is ambiguous; fall back rather than guess a page.
  if (scored[1] && scored[1].window.score === top.window.score) return fallback;

  const region = regionFrom(
    top.index,
    top.window.start,
    top.window.end,
    "ocr_fuzzy",
    top.window.score,
  );
  if (!region) return fallback;
  return { page: top.index.page_number, region, strategy: "ocr_fuzzy" };
}
