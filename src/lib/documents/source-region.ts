/**
 * EH-118 source region contract.
 *
 * A source region is the page-relative rectangle that a stored observation was
 * read from. It is the single accepted shape for the `bounding_box` JSONB
 * columns on `document_extracted_biomarkers`,
 * `document_extracted_instrumental_measures`, and `observations`.
 *
 * Coordinates are always normalized fractions of the page box with the origin
 * at the top-left corner. Pixel or PDF-point coordinates are rejected: the
 * rendered preview is downscaled to a fixed width and re-encoded, so any
 * absolute space stored at extraction time would be misaligned at render time.
 */

import type { OcrBbox } from "@/lib/biomarkers/ocr-artifact";

export const SOURCE_REGION_SCHEMA_VERSION = 1 as const;

/** How the region was derived. Renderers may downgrade low-trust origins. */
export const SOURCE_REGION_ORIGINS = ["ocr_exact", "ocr_fuzzy", "model"] as const;

export type SourceRegionOrigin = (typeof SOURCE_REGION_ORIGINS)[number];

export type SourceRegion = {
  schema_version: typeof SOURCE_REGION_SCHEMA_VERSION;
  space: "normalized";
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  origin: SourceRegionOrigin;
};

/**
 * Rounding error and glyph overhang from OCR engines routinely push a box a
 * fraction of a percent outside the page box. Anything further out is treated
 * as a wrong coordinate space rather than a rounding artifact.
 */
const OUT_OF_PAGE_TOLERANCE = 0.02;

/** Smallest region worth rendering; below this a highlight is noise. */
const MIN_REGION_EXTENT = 0.0005;

const COORDINATE_PRECISION = 6;

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

/** Shared coercion: five coordinate/page fields must reject NaN identically. */
function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Build a region from a normalized bbox. Returns null when the geometry is not
 * a usable highlight, so callers degrade to the page-only fallback instead of
 * persisting a box that would render in the wrong place.
 */
export function buildSourceRegion(input: {
  page: number;
  bbox: OcrBbox;
  origin: SourceRegionOrigin;
}): SourceRegion | null {
  return parseSourceRegion({
    schema_version: SOURCE_REGION_SCHEMA_VERSION,
    space: "normalized",
    page: input.page,
    x: input.bbox.x,
    y: input.bbox.y,
    w: input.bbox.w,
    h: input.bbox.h,
    origin: input.origin,
  });
}

/**
 * Validate and canonicalize an untrusted `bounding_box` value. Every write path
 * and every read path funnels through this function, so a stored region always
 * satisfies the same invariants the database CHECK constraint enforces.
 */
export function parseSourceRegion(value: unknown): SourceRegion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (raw.schema_version !== SOURCE_REGION_SCHEMA_VERSION) return null;
  if (raw.space !== "normalized") return null;
  if (!SOURCE_REGION_ORIGINS.includes(raw.origin as SourceRegionOrigin)) return null;

  const page = finiteNumber(raw.page);
  if (page === null || !Number.isInteger(page) || page < 1) return null;

  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  const w = finiteNumber(raw.w);
  const h = finiteNumber(raw.h);
  if (x === null || y === null || w === null || h === null) return null;

  // Reject a box that is not merely rounded outside the page. A pixel-space or
  // PDF-point box lands far outside [0, 1] and must never reach a renderer.
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
    schema_version: SOURCE_REGION_SCHEMA_VERSION,
    space: "normalized",
    page,
    x: roundCoordinate(clampedX),
    y: roundCoordinate(clampedY),
    w: roundCoordinate(clampedW),
    h: roundCoordinate(clampedH),
    origin: raw.origin as SourceRegionOrigin,
  };
}

export function isSourceRegion(value: unknown): value is SourceRegion {
  return parseSourceRegion(value) !== null;
}

/**
 * A region is only renderable on the page it was measured against. A stored
 * page/region disagreement means the provenance is unreliable, so the caller
 * falls back to page-only navigation rather than drawing a misaligned box.
 */
export function sourceRegionMatchesPage(
  region: SourceRegion | null,
  sourcePage: number | null
): boolean {
  if (!region) return false;
  return sourcePage !== null && region.page === sourcePage;
}

/** Union of normalized boxes, used to cover a multi-word or multi-line match. */
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
