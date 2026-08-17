/**
 * EH-118 smoke test: run the real poppler page index and the provenance adapter
 * against a real PDF and report the grounded page and region for each snippet.
 *
 * Usage: tsx scripts/eh118-smoke-source-region.mts [pdf] [snippet ...]
 */
import { readFileSync } from "node:fs";
import { buildPageMarkedText, pageMarker } from "../src/lib/documents/pdf-text-layout";
import { buildSourceIndex, resolveSourceRegion } from "../src/lib/documents/source-region-match";
import { extractPdfPageIndex } from "../worker/src/previews";

const SAMPLE_PDF = "lab_data/sample_lab_report_english_mock.pdf";
const [pdfPath = SAMPLE_PDF, ...snippets] = process.argv.slice(2);

const pages = await extractPdfPageIndex(readFileSync(pdfPath));
console.log(`pages indexed: ${pages.length}`);
for (const page of pages) {
  console.log(
    `  page ${page.page_number}: ${page.width}x${page.height}pt, ${page.lines.length} lines, ${page.text.length} chars`
  );
}

const marked = buildPageMarkedText(pages);
console.log(`page markers present: ${pages.every((p) => marked.includes(pageMarker(p.page_number)))}`);

const index = buildSourceIndex(pages);
// Default probes: the first three real lines of the document.
const probes =
  snippets.length > 0
    ? snippets
    : pages
        .flatMap((page) => page.lines.map((line) => line.text))
        .filter((text) => text.split(/\s+/).length >= 3)
        .slice(0, 3);

for (const snippet of probes) {
  const resolved = resolveSourceRegion({
    pages: index,
    pageCount: pages.length,
    snippet,
    hintedPage: 1,
  });
  const region = resolved.region
    ? resolved.region.rects
        .map(
          (rect, index) =>
            `rect${index + 1}=x=${rect.x.toFixed(4)} y=${rect.y.toFixed(4)} w=${rect.w.toFixed(4)} h=${rect.h.toFixed(4)}`,
        )
        .join("; ")
    : "none (page-only fallback)";
  console.log(`\nsnippet: ${JSON.stringify(snippet.slice(0, 80))}`);
  console.log(`  strategy=${resolved.strategy} page=${resolved.page}`);
  console.log(`  region: ${region}`);
}
