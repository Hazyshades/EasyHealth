/**
 * EH-118/EH-162 source region contract regression coverage.
 *
 * Covers canonical EH-162 payloads, legacy EH-118 compatibility, persistence
 * page coherence, and the exact-only rendering boundary.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSourceRegion,
  isSourceRegion,
  padBbox,
  parseSourceRegion,
  sourceRegionCanRender,
  sourceRegionMatchesPage,
  unionBbox,
  SOURCE_REGION_SCHEMA_VERSION,
} from "../src/lib/documents/source-region";
import { resolveSourceLocation } from "../src/lib/documents/observation-review-workspace";

function legacyRegion(overrides: Record<string, unknown> = {}) {
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

function canonicalRegion(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: SOURCE_REGION_SCHEMA_VERSION,
    coordinate_space: "normalized",
    origin: "top-left",
    page: 2,
    rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.05 }],
    match: {
      strategy: "exact",
      score: 1,
      engine: "pdf-text-bbox",
      resolver_version: "1",
    },
    ...overrides,
  };
}

// ── canonical and legacy accepted shapes ──
const parsed = parseSourceRegion(canonicalRegion());
assert.ok(parsed, "a canonical normalized region must be accepted");
assert.deepEqual(parsed, canonicalRegion());
assert.ok(isSourceRegion(canonicalRegion()), "the type guard must agree with the parser");

const legacy = parseSourceRegion(legacyRegion());
assert.ok(legacy, "an EH-118 region must remain readable");
assert.equal(legacy.origin, "top-left");
assert.equal(legacy.match.strategy, "exact");
assert.deepEqual(legacy.rects[0], { x: 0.1, y: 0.2, w: 0.3, h: 0.05 });

const fuzzy = parseSourceRegion(legacyRegion({ origin: "ocr_fuzzy" }));
const model = parseSourceRegion(legacyRegion({ origin: "model" }));
assert.equal(fuzzy?.match.strategy, "fuzzy");
assert.equal(model?.match.strategy, "unresolved");
assert.equal(sourceRegionCanRender(fuzzy, 2), false);
assert.equal(sourceRegionCanRender(model, 2), false);

// ── rejected shapes ──
const rejections: Array<[string, unknown]> = [
  ["null", null],
  ["array", [canonicalRegion()]],
  ["string", JSON.stringify(canonicalRegion())],
  ["unknown schema version", canonicalRegion({ schema_version: 2 })],
  ["missing schema version", canonicalRegion({ schema_version: undefined })],
  ["pixel coordinate space", canonicalRegion({ coordinate_space: "pixel" })],
  ["wrong origin", canonicalRegion({ origin: "bottom-left" })],
  ["unknown strategy", canonicalRegion({ match: { ...canonicalRegion().match, strategy: "guess" } })],
  ["page zero", canonicalRegion({ page: 0 })],
  ["negative page", canonicalRegion({ page: -1 })],
  ["fractional page", canonicalRegion({ page: 1.5 })],
  ["string page", canonicalRegion({ page: "2" })],
  ["empty exact rectangles", canonicalRegion({ rects: [] })],
  ["NaN width", canonicalRegion({ rects: [{ x: 0.1, y: 0.2, w: Number.NaN, h: 0.05 }] })],
  ["infinite height", canonicalRegion({ rects: [{ x: 0.1, y: 0.2, w: 0.3, h: Number.POSITIVE_INFINITY }] })],
  ["zero width", canonicalRegion({ rects: [{ x: 0.1, y: 0.2, w: 0, h: 0.05 }] })],
  ["negative height", canonicalRegion({ rects: [{ x: 0.1, y: 0.2, w: 0.3, h: -0.1 }] })],
  ["x beyond the page", canonicalRegion({ rects: [{ x: 1.5, y: 0.2, w: 0.1, h: 0.05 }] })],
  ["box overflowing the page", canonicalRegion({ rects: [{ x: 0.9, y: 0.2, w: 0.5, h: 0.05 }] })],
  ["pixel-space rectangle", canonicalRegion({ rects: [{ x: 120, y: 340, w: 220, h: 18 }] })],
  ["degenerate sliver", canonicalRegion({ rects: [{ x: 0.1, y: 0.2, w: 0.0001, h: 0.0001 }] })],
];
for (const [label, value] of rejections) {
  assert.equal(parseSourceRegion(value), null, `${label} must be rejected`);
}

// ── rounding tolerance ──
const clamped = parseSourceRegion(
  canonicalRegion({ rects: [{ x: -0.005, y: 0.98, w: 0.4, h: 0.03 }] }),
);
assert.ok(clamped, "a box a fraction outside the page must be clamped");
assert.equal(clamped.rects[0].x, 0);
assert.ok(
  clamped.rects[0].y + clamped.rects[0].h <= 1,
  "clamping must keep the box inside the page",
);
const rounded = parseSourceRegion(
  canonicalRegion({ rects: [{ x: 0.1234567891, y: 0.2, w: 0.3, h: 0.05 }] }),
);
assert.equal(rounded?.rects[0].x, 0.123457);

// ── page coherence and exact-only renderability ──
const onPageTwo = parseSourceRegion(canonicalRegion({ page: 2 }));
assert.equal(sourceRegionMatchesPage(onPageTwo, 2), true);
assert.equal(sourceRegionCanRender(onPageTwo, 2), true);
assert.equal(sourceRegionMatchesPage(onPageTwo, 3), false);
assert.equal(sourceRegionCanRender(onPageTwo, 3), false);
assert.equal(sourceRegionMatchesPage(onPageTwo, null), false);
assert.equal(sourceRegionMatchesPage(null, 2), false);

// ── builder and geometry helpers ──
const built = buildSourceRegion({
  page: 1,
  rects: [
    { x: 0.2, y: 0.3, w: 0.1, h: 0.02 },
    { x: 0.2, y: 0.34, w: 0.1, h: 0.02 },
  ],
  match: { strategy: "fuzzy", score: 0.8 },
});
assert.ok(built);
assert.equal(built.page, 1);
assert.equal(built.origin, "top-left");
assert.equal(built.match.strategy, "fuzzy");
assert.equal(built.rects.length, 2);
assert.equal(
  buildSourceRegion({ page: 0, bbox: { x: 0, y: 0, w: 0.1, h: 0.1 }, origin: "model" }),
  null,
  "the builder must apply the same page invariant as the parser",
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
    `union ${axis} must cover both boxes (got ${union[axis]})`,
  );
}
const padded = padBbox({ x: 0, y: 0.5, w: 0.2, h: 0.02 }, 0.01);
assert.equal(padded.x, 0, "padding must not push a box off the page");
assert.ok(padded.h > 0.02, "padding must grow the box");

// ── boundary enforcement is not viewer-only ──
const migration = readFileSync(
  "supabase/migrations/044_eh118_observation_source_region.sql",
  "utf8",
);
assert.match(migration, /create or replace function public\.eh118_is_source_region/);
const eh162Migration = readFileSync(
  "supabase/migrations/063_eh162_source_region_match_contract.sql",
  "utf8",
);
assert.match(eh162Migration, /coordinate_space/);
assert.match(eh162Migration, /jsonb_array_elements/);
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
  "acceptance must only copy a region that belongs to the recorded source page",
);
assert.match(
  writer,
  /if \(row\.source_page == null\) \{\s*\n\s*throw new ObservationNormalizationWriterError\(/,
  "acceptance must refuse a document-sourced row that has no source page",
);

const observationsRoute = readFileSync(
  "src/app/api/documents/[id]/observations/route.ts",
  "utf8",
);
assert.match(observationsRoute, /source_page, source_text, bounding_box/);

// ── review workspace integration ──
const grounded = resolveSourceLocation(
  2,
  "Hemoglobin 156 g/L",
  legacyRegion({ page: 2, origin: "ocr_exact" }),
);
assert.equal(grounded.precision, "region");
assert.equal(grounded.page, 2);
assert.ok(grounded.region);
assert.equal(grounded.region.match.strategy, "exact");

const pageOnly = resolveSourceLocation(2, "Hemoglobin 156 g/L", null);
assert.equal(pageOnly.precision, "page");
assert.equal(pageOnly.region, null);
assert.equal(
  resolveSourceLocation(2, "x", legacyRegion({ page: 2, origin: "ocr_fuzzy" })).precision,
  "page",
);
assert.equal(
  resolveSourceLocation(2, "x", legacyRegion({ page: 3 })).precision,
  "page",
);
assert.equal(
  resolveSourceLocation(2, "x", { x: 10, y: 20, w: 30, h: 40 }).precision,
  "page",
);
assert.equal(resolveSourceLocation(null, "x", legacyRegion()).precision, "document");

// ── scroll ownership and overlay variants ──
const overlay = readFileSync("src/components/documents/source-highlight-overlay.tsx", "utf8");
assert.doesNotMatch(overlay, /\.scrollIntoView\(/);
assert.match(overlay, /variant/);
assert.match(overlay, /region\.rects\.map/);
assert.match(overlay, /pointer-events-none/);
assert.match(overlay, /aria-hidden/);

const sourcePane = readFileSync(
  "src/components/documents/review/document-source-pane.tsx",
  "utf8",
);
assert.match(sourcePane, /<SourceHighlightOverlay/);
assert.match(sourcePane, /pinnedSource/);
assert.match(sourcePane, /previewSource/);
assert.match(sourcePane, /scroller\.scrollTo\(/);
assert.doesNotMatch(sourcePane, /\.scrollIntoView\(/);

const reviewList = readFileSync(
  "src/components/documents/review/observation-review-list.tsx",
  "utf8",
);
assert.match(reviewList, /scrollIntoView\(\{ block: "nearest" \}\)/);

console.log("verify-eh118-source-region-contract: passed");
