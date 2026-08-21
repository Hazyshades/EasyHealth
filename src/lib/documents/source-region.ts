/**
 * EH-162 source provenance contract.
 *
 * New writes use normalized page fractions and explicit match metadata. The
 * parser also canonicalizes the EH-118 shape so legacy rows keep working while
 * fuzzy/model-origin geometry remains non-renderable.
 */

import type { OcrBbox } from "@/lib/biomarkers/ocr-artifact";

export const SOURCE_REGION_SCHEMA_VERSION = 1 as const;
export const SOURCE_REGION_COORDINATE_SPACE = "normalized" as const;
export const SOURCE_REGION_COORDINATE_ORIGIN = "top-left" as const;

export const SOURCE_REGION_MATCH_STRATEGIES = [
  "exact",
  "fuzzy",
  "ambiguous",
  "unresolved",
] as const;

export type SourceRegionMatchStrategy =
  (typeof SOURCE_REGION_MATCH_STRATEGIES)[number];

/** Legacy EH-118 provenance origins accepted by the compatibility parser. */
export const SOURCE_REGION_ORIGINS = ["ocr_exact", "ocr_fuzzy", "model"] as const;
export type SourceRegionOrigin = (typeof SOURCE_REGION_ORIGINS)[number];

export type SourceRegionRect = OcrBbox;

export type SourceRegionMatch = Readonly<{
  strategy: SourceRegionMatchStrategy;
  score: number;
  engine: string;
  resolver_version: string;
}>;

export type SourceRegion = Readonly<{
  schema_version: typeof SOURCE_REGION_SCHEMA_VERSION;
  coordinate_space: typeof SOURCE_REGION_COORDINATE_SPACE;
  origin: typeof SOURCE_REGION_COORDINATE_ORIGIN;
  page: number;
  rects: readonly SourceRegionRect[];
  match: SourceRegionMatch;
}>;

/**
 * Rounding error and glyph overhang from positional extraction routinely push a
 * box a fraction of a percent outside the page box. Anything further out is
 * treated as a wrong coordinate space rather than a rounding artifact.
 */
const OUT_OF_PAGE_TOLERANCE = 0.02;

/** Smallest region worth rendering; below this a highlight is noise. */
const MIN_REGION_EXTENT = 0.0005;

const COORDINATE_PRECISION = 6;

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRect(value: unknown): SourceRegionRect | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  const w = finiteNumber(raw.w);
  const h = finiteNumber(raw.h);
  if (x === null || y === null || w === null || h === null) return null;

  const lower = -OUT_OF_PAGE_TOLERANCE;
  const upper = 1 + OUT_OF_PAGE_TOLERANCE;
  if (x < lower || y < lower || w <= 0 || h <= 0) return null;
  if (x > upper || y > upper || x + w > upper || y + h > upper) return null;

  const clampedX = Math.min(Math.max(x, 0), 1);
  const clampedY = Math.min(Math.max(y, 0), 1);
  const clampedW = Math.min(w, 1 - clampedX);
  const clampedH = Math.min(h, 1 - clampedY);
  if (clampedW < MIN_REGION_EXTENT || clampedH < MIN_REGION_EXTENT) return null;

  return {
    x: roundCoordinate(clampedX),
    y: roundCoordinate(clampedY),
    w: roundCoordinate(clampedW),
    h: roundCoordinate(clampedH),
  };
}

function parsePage(value: unknown): number | null {
  const page = finiteNumber(value);
  return page !== null && Number.isInteger(page) && page >= 1 ? page : null;
}

function parseMatch(value: unknown): SourceRegionMatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const strategy = raw.strategy;
  const score = finiteNumber(raw.score);
  const engine = raw.engine;
  const resolverVersion = raw.resolver_version;
  if (
    typeof strategy !== "string" ||
    !SOURCE_REGION_MATCH_STRATEGIES.includes(strategy as SourceRegionMatchStrategy) ||
    score === null ||
    score < 0 ||
    score > 1 ||
    typeof engine !== "string" ||
    engine.trim().length === 0 ||
    typeof resolverVersion !== "string" ||
    resolverVersion.trim().length === 0
  ) {
    return null;
  }
  return {
    strategy: strategy as SourceRegionMatchStrategy,
    score: roundCoordinate(score),
    engine,
    resolver_version: resolverVersion,
  };
}

function legacyMatch(origin: SourceRegionOrigin): SourceRegionMatch {
  switch (origin) {
    case "ocr_exact":
      return {
        strategy: "exact",
        score: 1,
        engine: "pdf-text-bbox",
        resolver_version: "legacy-eh118",
      };
    case "ocr_fuzzy":
      return {
        strategy: "fuzzy",
        score: 0,
        engine: "pdf-text-bbox",
        resolver_version: "legacy-eh118",
      };
    case "model":
      return {
        strategy: "unresolved",
        score: 0,
        engine: "legacy-model",
        resolver_version: "legacy-eh118",
      };
  }
}

/**
 * Build a canonical region from normalized rectangles. `bbox` and `origin`
 * remain accepted for source compatibility with EH-118 callers.
 */
export function buildSourceRegion(input: {
  page: number;
  rects?: readonly OcrBbox[];
  bbox?: OcrBbox;
  match?: Partial<SourceRegionMatch>;
  origin?: SourceRegionOrigin;
}): SourceRegion | null {
  const strategy =
    input.match?.strategy ??
    (input.origin === "ocr_fuzzy"
      ? "fuzzy"
      : input.origin === "model"
        ? "unresolved"
        : "exact");
  const rects = input.rects ?? (input.bbox ? [input.bbox] : []);
  const match: SourceRegionMatch = {
    strategy,
    score:
      input.match?.score ??
      (strategy === "exact" ? 1 : strategy === "fuzzy" ? 0.7 : 0),
    engine: input.match?.engine ?? "pdf-text-bbox",
    resolver_version: input.match?.resolver_version ?? "1",
  };
  return parseSourceRegion({
    schema_version: SOURCE_REGION_SCHEMA_VERSION,
    coordinate_space: SOURCE_REGION_COORDINATE_SPACE,
    origin: SOURCE_REGION_COORDINATE_ORIGIN,
    page: input.page,
    rects,
    match,
  });
}

/**
 * Validate and canonicalize an untrusted `bounding_box` value. Every write and
 * read path funnels through this function so stored geometry has one shape.
 */
export function parseSourceRegion(value: unknown): SourceRegion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const page = parsePage(raw.page);
  if (page === null || raw.schema_version !== SOURCE_REGION_SCHEMA_VERSION) {
    return null;
  }

  // Canonical EH-162 shape.
  if (
    raw.coordinate_space === SOURCE_REGION_COORDINATE_SPACE &&
    raw.origin === SOURCE_REGION_COORDINATE_ORIGIN
  ) {
    if (!Array.isArray(raw.rects)) return null;
    const match = parseMatch(raw.match);
    if (!match) return null;
    const rects: SourceRegionRect[] = [];
    for (const candidate of raw.rects) {
      const rect = normalizeRect(candidate);
      if (!rect) return null;
      rects.push(rect);
    }
    if (
      rects.length === 0 &&
      (match.strategy === "exact" || match.strategy === "fuzzy")
    ) {
      return null;
    }
    return {
      schema_version: SOURCE_REGION_SCHEMA_VERSION,
      coordinate_space: SOURCE_REGION_COORDINATE_SPACE,
      origin: SOURCE_REGION_COORDINATE_ORIGIN,
      page,
      rects,
      match,
    };
  }

  // Legacy EH-118 shape. It is canonicalized on read; the exact-only render
  // predicate below prevents old fuzzy/model boxes from becoming visual claims.
  if (
    raw.space !== SOURCE_REGION_COORDINATE_SPACE ||
    !SOURCE_REGION_ORIGINS.includes(raw.origin as SourceRegionOrigin)
  ) {
    return null;
  }
  const rect = normalizeRect(raw);
  if (!rect) return null;
  return {
    schema_version: SOURCE_REGION_SCHEMA_VERSION,
    coordinate_space: SOURCE_REGION_COORDINATE_SPACE,
    origin: SOURCE_REGION_COORDINATE_ORIGIN,
    page,
    rects: [rect],
    match: legacyMatch(raw.origin as SourceRegionOrigin),
  };
}

export function isSourceRegion(value: unknown): value is SourceRegion {
  return parseSourceRegion(value) !== null;
}

/** A region is persisted-coherent when it belongs to the recorded page. */
export function sourceRegionMatchesPage(
  region: SourceRegion | null,
  sourcePage: number | null,
): boolean {
  return Boolean(region && sourcePage !== null && region.page === sourcePage);
}

/** Only deterministic exact geometry may become a visual overlay. */
export function sourceRegionCanRender(
  region: SourceRegion | null,
  sourcePage: number | null,
): boolean {
  return Boolean(
    sourceRegionMatchesPage(region, sourcePage) &&
      region?.match.strategy === "exact" &&
      region.rects.length > 0,
  );
}

/** Union of normalized boxes, used for diagnostics and line-span bounds. */
export function unionBbox(boxes: readonly OcrBbox[]): OcrBbox | null {
  if (boxes.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const box of boxes) {
    if (
      !Number.isFinite(box.x) ||
      !Number.isFinite(box.y) ||
      !Number.isFinite(box.w) ||
      !Number.isFinite(box.h)
    ) {
      continue;
    }
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Grow a box by a normalized margin so glyph edges are not clipped. */
export function padBbox(box: OcrBbox, margin: number): OcrBbox {
  const x = Math.max(0, box.x - margin);
  const y = Math.max(0, box.y - margin);
  return {
    x,
    y,
    w: Math.min(1 - x, box.w + margin * 2),
    h: Math.min(1 - y, box.h + margin * 2),
  };
}
