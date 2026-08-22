/**
 * EH-162 deterministic source-region and interaction contract checks.
 * Run with `pnpm test:eh162`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourceRegionCanRender } from "../src/lib/documents/source-region";
import type { SourceIndexPage } from "../src/lib/documents/source-region-match";
import { resolveSourceRegion } from "../src/lib/documents/source-region-match";
import { resolveSourceLocation } from "../src/lib/documents/observation-review-workspace";

const twoLinePage: SourceIndexPage[] = [
  {
    page_number: 1,
    words: [
      { text: "Total", bbox: { x: 0.1, y: 0.2, w: 0.08, h: 0.02 } },
      { text: "protein", bbox: { x: 0.19, y: 0.2, w: 0.1, h: 0.02 } },
      { text: "74", bbox: { x: 0.1, y: 0.24, w: 0.04, h: 0.02 } },
      { text: "g/L", bbox: { x: 0.15, y: 0.24, w: 0.05, h: 0.02 } },
    ],
  },
];

const exact = resolveSourceRegion({
  pages: twoLinePage,
  pageCount: 1,
  snippet: "Total protein 74 g/L",
  hintedPage: 1,
});
assert.equal(exact.strategy, "ocr_exact");
assert.ok(exact.region);
assert.equal(exact.region.match.strategy, "exact");
assert.equal(exact.region.rects.length, 2, "multi-line snippets keep line rectangles");
assert.equal(sourceRegionCanRender(exact.region, 1), true);
assert.equal(
  resolveSourceLocation(1, "Total protein 74 g/L", exact.region).precision,
  "region",
);

const fuzzy = resolveSourceRegion({
  pages: [
    {
      page_number: 1,
      words: [
        { text: "Total", bbox: { x: 0.1, y: 0.2, w: 0.08, h: 0.02 } },
        { text: "protein", bbox: { x: 0.19, y: 0.2, w: 0.1, h: 0.02 } },
        { text: "74", bbox: { x: 0.1, y: 0.24, w: 0.04, h: 0.02 } },
        { text: "g/L", bbox: { x: 0.15, y: 0.24, w: 0.05, h: 0.02 } },
      ],
    },
  ],
  pageCount: 1,
  snippet: "Total protein 74 g/L reference",
  hintedPage: 1,
});
assert.equal(fuzzy.strategy, "ocr_fuzzy");
assert.ok(fuzzy.region);
assert.equal(fuzzy.region.match.strategy, "fuzzy");
assert.equal(sourceRegionCanRender(fuzzy.region, 1), false);
assert.equal(
  resolveSourceLocation(1, "Total protein 74 g/L reference", fuzzy.region).precision,
  "page",
);

const duplicate = resolveSourceRegion({
  pages: [
    {
      page_number: 1,
      words: [
        { text: "Glucose", bbox: { x: 0.1, y: 0.2, w: 0.08, h: 0.02 } },
        { text: "5.4", bbox: { x: 0.2, y: 0.2, w: 0.05, h: 0.02 } },
      ],
    },
    {
      page_number: 2,
      words: [
        { text: "Glucose", bbox: { x: 0.1, y: 0.2, w: 0.08, h: 0.02 } },
        { text: "5.4", bbox: { x: 0.2, y: 0.2, w: 0.05, h: 0.02 } },
      ],
    },
  ],
  pageCount: 2,
  snippet: "Glucose 5.4",
  hintedPage: 2,
});
assert.equal(duplicate.region, null, "duplicate exact hits must be ambiguous");
assert.equal(duplicate.page, 2);

const row = readFileSync(
  "src/components/documents/review/observation-review-row.tsx",
  "utf8",
);
assert.match(row, /PREVIEW_ENTER_DELAY_MS = 100/);
assert.match(row, /onMouseEnter=\{beginPreview\}/);
assert.match(row, /onFocus=\{beginPreview\}/);
assert.match(row, /onMouseLeave=\{endPreview\}/);
assert.match(row, /onBlur=\{endPreview\}/);
assert.match(row, /aria-describedby=\{sourceDescriptionId\}/);

const viewer = readFileSync("src/components/documents/document-viewer.tsx", "utf8");
assert.match(viewer, /previewedRowId/);
assert.match(viewer, /handlePreviewStart/);
assert.match(viewer, /pinnedSource=\{pinnedSource\}/);
assert.match(viewer, /previewSource=\{previewSource\}/);
const previewStart = viewer.slice(viewer.indexOf("const handlePreviewStart"), viewer.indexOf("const handlePreviewEnd"));
assert.doesNotMatch(previewStart, /setCurrentPage\(/, "preview must not navigate");

const pane = readFileSync(
  "src/components/documents/review/document-source-pane.tsx",
  "utf8",
);
assert.match(pane, /const pinnedKey/);
assert.match(pane, /const previewRegion/);
assert.match(pane, /variant=\"pinned\"/);
assert.match(pane, /variant=\"preview\"/);
assert.match(pane, /scroller\.scrollTo\(/);
assert.doesNotMatch(pane, /previewKey/);

const overlay = readFileSync(
  "src/components/documents/source-highlight-overlay.tsx",
  "utf8",
);
assert.match(overlay, /region\.rects\.map/);
assert.match(overlay, /variant === \"preview\"/);
assert.match(overlay, /pointer-events-none/);
assert.match(overlay, /aria-hidden=\"true\"/);

const reviewSpec = readFileSync(
  "openspec/changes/eh-162-highlight-source-region-on-biomarker-hover/specs/document-extraction-review/spec.md",
  "utf8",
);
assert.match(reviewSpec, /## MODIFIED Requirements/);
assert.match(reviewSpec, /strategy: \"exact\"/);

const migration = readFileSync(
  "supabase/migrations/063_eh162_source_region_match_contract.sql",
  "utf8",
);
assert.match(migration, /coordinate_space/);
assert.match(migration, /top-left/);
assert.match(migration, /jsonb_array_elements/);

console.log("verify-eh162-source-region-hover: passed");
