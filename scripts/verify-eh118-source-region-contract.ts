/**
 * EH-118 source region contract.
 *
 * Behavioural coverage for the single accepted `bounding_box` shape: what is
 * accepted, what is rejected, and how a stored region is degraded when it
 * cannot be trusted. Run with `pnpm test:eh118`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSourceRegion,
  isSourceRegion,
  padBbox,
  parseSourceRegion,
  sourceRegionMatchesPage,
  unionBbox,
  SOURCE_REGION_SCHEMA_VERSION,
  type SourceRegion,
} from "../src/lib/documents/source-region";
import { resolveSourceLocation } from "../src/lib/documents/observation-review-workspace";

function region(overrides: Partial<Record<keyof SourceRegion, unknown>> = {}) {
  return {
    schema_version: 1,
    space: "normalized",
    page: 2,
    x: 0.1,
    y: 0.2,
    w: 0.3,
    h: 0.05,
    origin: "ocr_exact",
    ...overrides,
  };
}

// ── accepted shape ──
const parsed = parseSourceRegion(region());
assert.ok(parsed, "a well-formed normalized region must be accepted");
assert.deepEqual(parsed, {
  schema_version: SOURCE_REGION_SCHEMA_VERSION,
  space: "normalized",
  page: 2,
  x: 0.1,
  y: 0.2,
  w: 0.3,
  h: 0.05,
  origin: "ocr_exact",
});
assert.ok(isSourceRegion(region()), "the type guard must agree with the parser");

for (const origin of ["ocr_exact", "ocr_fuzzy", "model"]) {
  assert.ok(parseSourceRegion(region({ origin })), `origin ${origin} must be accepted`);
}

// ── rejected shapes ──
const rejections: Array<[string, unknown]> = [
  ["null", null],
  ["array", [region()]],
  ["string", JSON.stringify(region())],
  ["unknown schema version", region({ schema_version: 2 })],
  ["missing schema version", region({ schema_version: undefined })],
  ["pixel coordinate space", region({ space: "pixel" })],
  ["unknown origin", region({ origin: "guess" })],
  ["page zero", region({ page: 0 })],
  ["negative page", region({ page: -1 })],
  ["fractional page", region({ page: 1.5 })],
  ["string page", region({ page: "2" })],
  ["NaN width", region({ w: Number.NaN })],
  ["infinite height", region({ h: Number.POSITIVE_INFINITY })],
  ["zero width", region({ w: 0 })],
  ["negative height", region({ h: -0.1 })],
  ["x beyond the page", region({ x: 1.5 })],
  ["box overflowing the page", region({ x: 0.9, w: 0.5 })],
  ["pixel-space rectangle", region({ x: 120, y: 340, w: 220, h: 18 })],
  ["pdf-point rectangle", region({ x: 56.8, y: 72, w: 41.2, h: 12 })],
  ["degenerate sliver", region({ w: 0.0001, h: 0.0001 })],
];
for (const [label, value] of rejections) {
  assert.equal(parseSourceRegion(value), null, `${label} must be rejected`);
}

// ── rounding tolerance ──
// OCR glyph overhang pushes a box a hair outside the page; that is clamped, not
// rejected, because the alternative is losing a correct highlight.
const clamped = parseSourceRegion(region({ x: -0.005, y: 0.98, w: 0.4, h: 0.03 }));
assert.ok(clamped, "a box a fraction outside the page must be clamped");
assert.equal(clamped.x, 0);
assert.ok(clamped.y + clamped.h <= 1, "clamping must keep the box inside the page");

// Coordinates are canonicalized so equal geometry produces equal JSON.
const rounded = parseSourceRegion(region({ x: 0.1234567891 }));
assert.equal(rounded?.x, 0.123457, "coordinates must be rounded to a stable precision");

// ── page coherence ──
const onPageTwo = parseSourceRegion(region({ page: 2 }));
assert.equal(sourceRegionMatchesPage(onPageTwo, 2), true);
assert.equal(
  sourceRegionMatchesPage(onPageTwo, 3),
  false,
  "a region must never be rendered on a page it was not measured against"
);
assert.equal(sourceRegionMatchesPage(onPageTwo, null), false);
assert.equal(sourceRegionMatchesPage(null, 2), false);

// ── builder ──
const built = buildSourceRegion({
  page: 1,
  bbox: { x: 0.2, y: 0.3, w: 0.1, h: 0.02 },
  origin: "ocr_fuzzy",
});
assert.ok(built);
assert.equal(built.page, 1);
assert.equal(built.origin, "ocr_fuzzy");
assert.equal(
  buildSourceRegion({ page: 0, bbox: { x: 0, y: 0, w: 0.1, h: 0.1 }, origin: "model" }),
  null,
  "the builder must apply the same page invariant as the parser"
);
assert.equal(unionBbox([]), null);
const union = unionBbox([
  { x: 0.1, y: 0.2, w: 0.1, h: 0.02 },
  { x: 0.3, y: 0.21, w: 0.05, h: 0.02 },
]);
assert.ok(union);
for (const [axis, expected] of [
  ["x", 0.1],
  ["y", 0.2],
  ["w", 0.25],
  ["h", 0.03],
] as const) {
  assert.ok(
    Math.abs(union[axis] - expected) < 1e-9,
    `union ${axis} must cover both boxes (got ${union[axis]})`
  );
}
const padded = padBbox({ x: 0, y: 0.5, w: 0.2, h: 0.02 }, 0.01);
assert.equal(padded.x, 0, "padding must not push a box off the page");
assert.ok(padded.h > 0.02, "padding must grow the box");

// ── boundary enforcement is not viewer-only ──
const migration = readFileSync(
  "supabase/migrations/044_eh118_observation_source_region.sql",
  "utf8"
);
assert.match(
  migration,
  /create or replace function public\.eh118_is_source_region/,
  "the region contract must also be enforced in the database"
);
for (const constraint of [
  "observations_source_region_valid",
  "extracted_biomarkers_source_region_valid",
  "instrumental_measures_source_region_valid",
  "observations_document_source_page_present",
  "observations_source_page_positive",
]) {
  assert.ok(migration.includes(constraint), `migration must add ${constraint}`);
}

const writer = readFileSync("src/lib/documents/observation-normalization-writer.ts", "utf8");
assert.match(
  writer,
  /sourceRegionMatchesPage\(region, row\.source_page \?\? null\)/,
  "acceptance must only copy a region that belongs to the recorded source page"
);
assert.match(
  writer,
  /if \(row\.source_page == null\) \{\s*\n\s*throw new ObservationNormalizationWriterError\(/,
  "acceptance must refuse a document-sourced row that has no source page"
);

const observationsRoute = readFileSync(
  "src/app/api/documents/[id]/observations/route.ts",
  "utf8"
);
assert.match(
  observationsRoute,
  /source_page, source_text, bounding_box/,
  "the observations API must expose source page and region provenance"
);

// ── EH-117 review workspace integration ──
// The workspace reserved `"region"` precision for EH-118; these assert the seam
// is now filled and still degrades in the documented order.
const grounded = resolveSourceLocation(
  2,
  "Hemoglobin 156 g/L",
  region({ page: 2, origin: "ocr_exact" })
);
assert.equal(grounded.precision, "region", "a grounded row must report region precision");
assert.equal(grounded.page, 2);
assert.equal(grounded.label, "Page 2");
assert.ok(grounded.region, "a region-precision row must carry the geometry");
assert.equal(grounded.region.page, 2);

const pageOnly = resolveSourceLocation(2, "Hemoglobin 156 g/L", null);
assert.equal(pageOnly.precision, "page", "no region means page precision");
assert.equal(pageOnly.region, null);

assert.equal(
  resolveSourceLocation(2, "x", region({ page: 3 })).precision,
  "page",
  "a region measured on another page must not be presented as region precision"
);
assert.equal(
  resolveSourceLocation(2, "x", { x: 10, y: 20, w: 30, h: 40 }).precision,
  "page",
  "a free-form rectangle must not be presented as region precision"
);
assert.equal(
  resolveSourceLocation(null, "x", region({ page: 1 })).precision,
  "document",
  "without a page there is nothing to highlight against"
);

// ── scroll ownership ──
// Two components scrolling on selection produces visible jank. The source pane
// owns preview scrolling; the overlay is presentational; the row list keeps its
// own list-scoped scroll.
const overlay = readFileSync("src/components/documents/source-highlight-overlay.tsx", "utf8");
assert.doesNotMatch(
  overlay,
  /\.scrollIntoView\(/,
  "the highlight overlay must not scroll: it would move every ancestor and the window"
);

const sourcePane = readFileSync(
  "src/components/documents/review/document-source-pane.tsx",
  "utf8"
);
assert.match(sourcePane, /<SourceHighlightOverlay/, "the source pane must draw the region");
assert.match(
  sourcePane,
  /scroller\.scrollTo\(/,
  "the source pane must scroll its own container rather than the page"
);
assert.doesNotMatch(
  sourcePane,
  /\.scrollIntoView\(/,
  "the source pane must not delegate scrolling to the browser's ancestor walk"
);

const reviewList = readFileSync(
  "src/components/documents/review/observation-review-list.tsx",
  "utf8"
);
assert.match(
  reviewList,
  /scrollIntoView\(\{ block: "nearest" \}\)/,
  "the row list keeps its list-scoped scroll; EH-118 must not widen it"
);

console.log("verify-eh118-source-region-contract: passed");
