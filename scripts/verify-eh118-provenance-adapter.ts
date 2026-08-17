/**
 * EH-118 OCR/LLM provenance adapter.
 *
 * Covers the page index parser, page-marked extraction input, and the snippet
 * matcher that grounds a model's page hint against real page geometry —
 * including every path that must degrade to page-only provenance.
 * Run with `pnpm test:eh118`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPageMarkedText,
  pageMarker,
  parsePdfBboxLayout,
  splitPlainTextPages,
} from "../src/lib/documents/pdf-text-layout";
import {
  buildSourceIndex,
  resolveSourceRegion,
  type SourceIndexPage,
} from "../src/lib/documents/source-region-match";

/** Words are laid out on a 600x800 point page so normalization is checkable. */
function line(yTop: number, words: Array<[string, number, number]>): string {
  const cells = words
    .map(
      ([text, xMin, xMax]) =>
        `<word xMin="${xMin}" yMin="${yTop}" xMax="${xMax}" yMax="${yTop + 10}">${text}</word>`
    )
    .join("");
  const xMin = Math.min(...words.map(([, x]) => x));
  const xMax = Math.max(...words.map(([, , x]) => x));
  return `<line xMin="${xMin}" yMin="${yTop}" xMax="${xMax}" yMax="${yTop + 10}">${cells}</line>`;
}

const LAYOUT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<body>
<doc>
  <page width="600.000000" height="800.000000">
    <flow><block>
      ${line(100, [["Glucose", 60, 120], ["5.4", 300, 330], ["mmol/L", 360, 420]])}
      ${line(120, [["Sodium", 60, 118], ["140", 300, 330], ["mmol/L", 360, 420]])}
      ${line(140, [["Repeated", 60, 130], ["row", 140, 170]])}
    </block></flow>
  </page>
  <page width="600.000000" height="800.000000">
    <flow><block>
      ${line(200, [["Ferritin", 60, 125], ["45", 300, 325], ["ng/mL", 360, 415]])}
      ${line(220, [["Repeated", 60, 130], ["row", 140, 170]])}
      ${line(400, [["Alkaline", 60, 130], ["phosphatase", 140, 250], ["&lt;", 300, 310], ["20", 315, 340]])}
    </block></flow>
  </page>
</doc>
</body>
</html>`;

// ── page index parsing ──
const pages = parsePdfBboxLayout(LAYOUT_XML);
assert.equal(pages.length, 2, "each <page> element is one indexed page");
assert.equal(pages[0].page_number, 1);
assert.equal(pages[1].page_number, 2);
assert.equal(pages[0].width, 600);
assert.equal(pages[0].height, 800);
assert.equal(pages[0].lines.length, 3);
assert.equal(pages[0].lines[0].text, "Glucose 5.4 mmol/L");

const glucose = pages[0].lines[0].words[0];
assert.equal(glucose.text, "Glucose");
assert.equal(glucose.bbox.x, 60 / 600, "word x must be normalized against page width");
assert.equal(glucose.bbox.y, 100 / 800, "word y must be normalized against page height");
assert.equal(glucose.bbox.w, 60 / 600);
assert.equal(glucose.bbox.h, 10 / 800);

assert.equal(
  pages[1].lines[2].text,
  "Alkaline phosphatase < 20",
  "XML entities in word text must be decoded"
);

assert.deepEqual(parsePdfBboxLayout(""), [], "empty output yields no pages");
assert.deepEqual(parsePdfBboxLayout("not xml at all"), [], "non-layout output yields no pages");

// ── plain-text page split fallback ──
assert.deepEqual(splitPlainTextPages("one\f two\f"), ["one", " two"]);
assert.deepEqual(splitPlainTextPages("single page"), ["single page"]);
assert.deepEqual(splitPlainTextPages(""), []);

// ── page-marked extraction input ──
const marked = buildPageMarkedText(pages);
assert.ok(marked.startsWith(pageMarker(1)), "input must open with the first page marker");
assert.ok(marked.includes(pageMarker(2)), "every page must be announced to the model");
assert.ok(
  marked.indexOf("Ferritin") > marked.indexOf(pageMarker(2)),
  "page content must follow its own marker"
);

// ── snippet grounding ──
const index = buildSourceIndex(pages);
assert.equal(index.length, 2);
assert.equal(index[0].words.length, 8);

const exact = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: "Glucose 5.4 mmol/L",
  hintedPage: 1,
});
assert.equal(exact.strategy, "ocr_exact");
assert.equal(exact.page, 1);
assert.ok(exact.region, "an exact snippet match must produce a region");
assert.equal(exact.region.page, 1);
assert.equal(exact.region.match.strategy, "exact");
assert.ok(exact.region.rects[0].x < 60 / 600, "the region must be padded around the matched words");
assert.ok(
  exact.region.rects[0].x + exact.region.rects[0].w > 420 / 600,
  "the region must span every matched word"
);
assert.ok(exact.region.rects[0].h < 0.2, "a one-line match must stay a one-line box");

// Regression: poppler emits a real table column by column, so the cells of one
// visual row are far apart in the raw flow. The index must be rebuilt from
// geometry or every table-row snippet silently loses its highlight.
const COLUMN_MAJOR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><doc>
  <page width="600.000000" height="800.000000">
    <flow><block>
      ${line(100, [["Hemoglobin", 60, 160]])}
      ${line(120, [["Hematocrit", 60, 160]])}
    </block></flow>
    <flow><block>
      ${line(100, [["156", 300, 330]])}
      ${line(120, [["46.4", 300, 340]])}
    </block></flow>
    <flow><block>
      ${line(100, [["g/L", 380, 420]])}
      ${line(120, [["%", 380, 395]])}
    </block></flow>
  </page>
</doc></body></html>`;

const columnMajor = buildSourceIndex(parsePdfBboxLayout(COLUMN_MAJOR_XML));
assert.deepEqual(
  columnMajor[0].words.map((word) => word.text),
  ["Hemoglobin", "156", "g/L", "Hematocrit", "46.4", "%"],
  "the index must be reordered into visual rows, left to right"
);

const tableRow = resolveSourceRegion({
  pages: columnMajor,
  pageCount: 1,
  snippet: "Hemoglobin 156 g/L",
  hintedPage: 1,
});
assert.equal(tableRow.strategy, "ocr_exact", "a table-row snippet must still match exactly");
assert.ok(tableRow.region);
assert.ok(
  tableRow.region.rects[0].y < 110 / 800 && tableRow.region.rects[0].y + tableRow.region.rects[0].h < 120 / 800,
  "the region must stay on the matched row and not swallow the row below"
);
assert.ok(
  tableRow.region.rects[0].x + tableRow.region.rects[0].w > 420 / 600,
  "the region must span the row from the label to the unit cell"
);

// A wrong page hint is corrected by a unique match elsewhere in the document.
const corrected = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: "Ferritin 45 ng/mL",
  hintedPage: 1,
});
assert.equal(corrected.page, 2, "a unique OCR match must override a wrong model page hint");
assert.equal(corrected.strategy, "ocr_exact");

// Decimal commas and punctuation noise still match the printed value.
const normalizedSnippet = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: "Glucose: 5,4 mmol/L",
  hintedPage: 1,
});
assert.ok(normalizedSnippet.region, "decimal-comma snippets must still match");
assert.equal(normalizedSnippet.page, 1);

// ── page-only fallbacks ──
const ambiguous = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: "Repeated row",
  hintedPage: null,
});
assert.equal(ambiguous.region, null, "a snippet occurring on two pages must not be highlighted");
assert.equal(ambiguous.page, 1);
assert.equal(ambiguous.strategy, "page_default");

const ambiguousWithHint = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: "Repeated row",
  hintedPage: 2,
});
assert.equal(
  ambiguousWithHint.page,
  2,
  "an ambiguous snippet on the hinted page resolves to that page"
);
assert.equal(ambiguousWithHint.region, null, "duplicate exact matches remain page-only even when one is hinted");


const unmatched = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: "Vitamin D 42 nmol/L",
  hintedPage: 2,
});
assert.equal(unmatched.region, null, "an absent snippet must not be highlighted");
assert.equal(unmatched.page, 2, "an absent snippet keeps the model page hint");
assert.equal(unmatched.strategy, "page_hint");

const outOfRangeHint = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: "Vitamin D 42 nmol/L",
  hintedPage: 9,
});
assert.equal(outOfRangeHint.page, 1, "a hint outside the page index falls back to page 1");
assert.equal(outOfRangeHint.strategy, "page_default");

const noSnippet = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: null,
  hintedPage: 2,
});
assert.equal(noSnippet.region, null);
assert.equal(noSnippet.page, 2, "every observation still links to a page without a snippet");

const singleToken = resolveSourceRegion({
  pages: index,
  pageCount: 2,
  snippet: "Glucose",
  hintedPage: 1,
});
assert.equal(singleToken.region, null, "one token is too little signal to place a box");
assert.equal(singleToken.page, 1);

// Scanned pages have no geometry: page provenance survives, the region does not.
const scanned: SourceIndexPage[] = [];
const noGeometry = resolveSourceRegion({
  pages: scanned,
  pageCount: 3,
  snippet: "Glucose 5.4 mmol/L",
  hintedPage: 3,
});
assert.equal(noGeometry.region, null);
assert.equal(noGeometry.page, 3);
assert.equal(noGeometry.strategy, "page_hint");

const noPages = resolveSourceRegion({
  pages: scanned,
  pageCount: 0,
  snippet: "Glucose 5.4 mmol/L",
  hintedPage: 1,
});
assert.equal(noPages.page, null, "a document with no page index has no source page");
assert.equal(noPages.strategy, "unavailable");

// ── pipeline wiring ──
const pipeline = readFileSync("worker/src/pipeline.ts", "utf8");
assert.match(
  pipeline,
  /const ocrText = hasPageText \? buildPageMarkedText\(layoutPages\) : ""/,
  "extraction input must carry page markers"
);
assert.match(
  pipeline,
  /source_page: provenance\.page,\s*\n\s*bounding_box: provenance\.region,/,
  "laboratory rows must persist the grounded page and region"
);
assert.match(
  pipeline,
  /coordinate_space: blocks \? "normalized" : undefined/,
  "page OCR artifacts must declare the coordinate space of their blocks"
);
assert.doesNotMatch(
  pipeline,
  /page\.pageNumber === 1/,
  "the page index must cover every page, not only page 1"
);

const previews = readFileSync("worker/src/previews.ts", "utf8");
assert.match(
  previews,
  /"-bbox-layout"/,
  "word geometry must be requested from poppler"
);

const instrumental = readFileSync("src/lib/documents/instrumental-extraction.ts", "utf8");
assert.doesNotMatch(
  instrumental,
  /"bounding_box": object \| null/,
  "the model must not be asked to invent page geometry it cannot see"
);
assert.match(
  instrumental,
  /bounding_box: parseSourceRegion\(row\.bounding_box\)/,
  "any model-supplied region must pass the contract before it is stored"
);

console.log("verify-eh118-provenance-adapter: passed");
