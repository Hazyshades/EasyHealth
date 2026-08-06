/**
 * EH-118 overlay render smoke test: render the real viewer overlay component
 * over the real page preview, using the region the adapter resolved, and write
 * a standalone HTML page that mirrors the viewer's markup (relative wrapper,
 * zoom transform, percentage-positioned box).
 *
 * Usage: tsx scripts/eh118-smoke-overlay-render.mts [pdf] [snippet] [out.html]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildSourceIndex, resolveSourceRegion } from "../src/lib/documents/source-region-match";
import { extractPdfPageIndex, generatePagePreviews } from "../worker/src/previews";

// tsx compiles JSX with the classic runtime, so the component's JSX needs a
// global React. The component itself is imported afterwards, unmodified.
(globalThis as unknown as { React: typeof React }).React = React;
const { SourceHighlightOverlay } = await import(
  "../src/components/documents/source-highlight-overlay"
);
const SAMPLE_PDF = "lab_data/sample_lab_report_english_mock.pdf";
const SAMPLE_SNIPPET = "Hemoglobin (HGB) 156 g/L 132 - 166";
const [pdfPath = SAMPLE_PDF, snippet = SAMPLE_SNIPPET, outPath = ".artifacts/eh118-overlay.html"] =
  process.argv.slice(2);

const buffer = readFileSync(pdfPath);
const previews = await generatePagePreviews(buffer, "application/pdf", pdfPath);
const resolved = resolveSourceRegion({
  pages: buildSourceIndex(await extractPdfPageIndex(buffer)),
  pageCount: previews.length,
  snippet,
  hintedPage: 1,
});
console.log(`strategy=${resolved.strategy} page=${resolved.page}`);
if (!resolved.region || !resolved.page) {
  console.log("no region resolved; page-only fallback");
  process.exit(0);
}

const page = previews.find((candidate) => candidate.pageNumber === resolved.page);
if (!page) throw new Error(`no preview for page ${resolved.page}`);

const overlay = renderToStaticMarkup(
  React.createElement(SourceHighlightOverlay, { region: resolved.region })
);
console.log(overlay);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `<!doctype html><meta charset="utf-8">
<style>
  :root { --eh-brand: #2563eb; }
  body { margin: 0; background: #f8fafc; }
  .absolute { position: absolute; }
  .inset-0 { inset: 0; }
  .relative { position: relative; }
  .pointer-events-none { pointer-events: none; }
  .mx-auto { margin-inline: auto; }
  .w-fit { width: fit-content; }
  .max-w-full { max-width: 100%; }
  .block { display: block; }
  .rounded-\\[3px\\] { border-radius: 3px; }
  .border-2 { border-width: 2px; border-style: solid; }
  .border-\\[var\\(--eh-brand\\)\\] { border-color: var(--eh-brand); }
  .bg-\\[var\\(--eh-brand\\)\\]\\/20 { background: color-mix(in srgb, var(--eh-brand) 20%, transparent); }
</style>
<div style="height:100vh;overflow:auto">
  <div class="mx-auto w-fit max-w-full" style="transform:scale(1);transform-origin:top center">
    <div class="relative">
      <img class="block max-w-full" alt="Page ${resolved.page}"
        src="data:image/webp;base64,${page.buffer.toString("base64")}">
      ${overlay}
    </div>
  </div>
</div>`
);
console.log(`wrote ${outPath}`);
