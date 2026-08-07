# Design: link observations to source page and region

## Context

The document worker rasterizes every page to a 1600px-wide WebP preview and
stores per-page pixel dimensions in `document_pages`, so a page index already
exists. What is missing is coordinates: `extractPdfText` ran plain `pdftotext`
and returned one string for the whole document, page boundaries survived only as
form feeds, and the single page OCR artifact written for page 1 had no `blocks`.

Both extractors therefore asked the model for `source_page` without ever showing
it a page boundary, and the instrumental extractor additionally asked for
`bounding_box` — a rectangle the model cannot possibly measure, accepted by a
parser that took any non-array object.

EH-103 made observation provenance write-once at the database boundary. That
raises the cost of a wrong region from "annoying" to "permanent", which shapes
every decision below: the system prefers no region over an unverified one.

## Goals / Non-Goals

**Goals:**

- Every observation created from a document extraction links to a source page.
- A rendered highlight sits on the text it was read from, at any zoom and any
  viewport width.
- One bounding-box contract, enforced identically in the application and in the
  database.
- Ambiguity degrades visibly to page-only provenance instead of silently
  producing a plausible-looking wrong box.

**Non-Goals:**

- OCR for scanned documents. Without a text layer there is no geometry; those
  documents keep page-only provenance. Adding an OCR engine is a separate change.
- Per-page vision extraction. The vision path still sees page 1 only; it
  produces page-1 provenance and no region.
- Editing or correcting a region by hand. Provenance stays write-once.
- Highlighting inside the raw-PDF `<iframe>` fallback, which has no coordinate
  system the application controls.

## Decisions

### 1. Normalized page fractions are the only accepted coordinate space

`SourceRegion` stores `x`, `y`, `w`, `h` as fractions of the page box with the
origin at the top-left, plus `schema_version`, `space`, `page`, and `origin`.
`parseSourceRegion` rejects anything else and is the single gate on every write
and read path.

Absolute coordinates cannot survive the pipeline. Poppler reports PDF points,
the preview is rasterized at 150 dpi and then downscaled to a fixed 1600px
width, and the browser scales that again to the container. Every one of those
steps changes the pixel scale but none change the fraction. Storing fractions
also makes the misalignment failure mode loud rather than subtle: a
pixel-space rectangle has coordinates far outside `[0, 1]` and is rejected
outright instead of rendering in a corner of the page.

The parser clamps values a fraction outside the page — OCR glyph overhang
routinely produces those — but rejects anything past a 2% tolerance, and rejects
regions smaller than the smallest renderable sliver.

### 2. Geometry comes from poppler, not from the model

`extractPdfPageIndex` runs `pdftotext -bbox-layout`, which the worker already
depends on for rasterization, and parses per-word rectangles in PDF user space.
The alternative — asking the extraction model for a rectangle — was already in
the instrumental prompt and is removed here, because the model never sees page
geometry and its output cannot be checked against anything.

When `-bbox-layout` yields nothing (scanned pages, older poppler, malformed
PDFs) the plain text extractor still supplies per-page text, so the page index
survives and only the region degrades.

### 3. The page index is rebuilt into visual reading rows before matching

Poppler's layout flow is not reading order: it emits a table column as one
block, so the cells of a single row are hundreds of words apart in the raw
stream. A model quotes a row the way a human reads it, so a sequence match
against the raw flow finds nothing for exactly the rows that matter most.

`buildSourceIndex` therefore clusters words into rows by vertical centre —
within 60% of the median line height — and sorts each row left to right. This is
cheap, needs no table detection, and makes a row snippet contiguous again.

### 4. The model's page number is a hint, not the answer

Extraction input now carries `=== PAGE N ===` markers so the model can read the
page number instead of inventing it, but the adapter still treats it as a hint.
A snippet that matches exactly once in the document overrides a disagreeing
hint; a snippet that matches nothing keeps the hint; a hint outside the page
index falls back to page 1.

The resolution reports which of those happened (`ocr_exact`, `ocr_fuzzy`,
`page_hint`, `page_default`, `unavailable`), so a downstream reader can tell
grounded provenance from a default.

### 5. Ambiguity produces no region

A snippet occurring more than once outside the hinted page, a fuzzy score below
70%, a tie between pages, a match under two tokens, or a union box taller than a
fifth of the page all resolve to page-only provenance. Each of those is a case
where a box would look authoritative and be wrong, and write-once storage means
there is no cheap correction later.

### 6. The database enforces the same contract as the application

`eh118_is_source_region(jsonb)` mirrors `parseSourceRegion`, and CHECK
constraints on all three tables additionally require that a region's `page`
equals the row's `source_page`. Application-only validation would leave the RPC
writers, future migrations, and manual fixes free to store a rectangle that the
viewer would then render in the wrong place.

The constraint on "a document-sourced observation must have a source page" is
added `NOT VALID` and validated in the same migration when no row violates it,
so a database carrying pre-EH-118 rows still enforces the rule on every new
write without failing the migration.

### 7. The overlay is positioned in percentages inside an image-sized wrapper

The page image is wrapped in a `w-fit` container that carries the zoom
transform; the highlight is an absolutely positioned sibling using
`left/top/width/height` in percent. Percentages resolve against the wrapper,
which is exactly the image box, so the highlight tracks the image through zoom,
responsive shrinking, and re-render without any measurement code or resize
observer.

The page-navigation and zoom controls, previously hidden for PDFs, are shown
whenever page previews exist, because a PDF with previews now has something to
navigate and highlight.

### 8. One owner for scrolling

EH-117's `ObservationReviewList` already scrolls the selected row into view. If
the highlight also called `scrollIntoView`, two components would scroll on one
selection — and `scrollIntoView` walks every scrollable ancestor up to the
window, so the second one would move the whole page, not just the preview.

`SourceHighlightOverlay` is therefore purely presentational and forwards a ref.
`DocumentSourcePane` owns preview scrolling and moves only its own scroll
container via `scrollTo`. The row list keeps its list-scoped
`scrollIntoView({ block: "nearest" })`. The split is asserted in the EH-118
suite so a later change cannot quietly reintroduce a second owner.

### 9. Region precision fills the seam EH-117 reserved

EH-117 shipped `SourcePrecision = "region" | "page" | "document"` with `"region"`
unreachable and `resolveSourceLocation` documented as page-only. EH-118 fills
that seam rather than adding a parallel path: `resolveSourceLocation` takes the
bounding box, validates it against the contract and the row's page, and reports
`"region"` only when both hold. Every consumer — pane, row, and workspace tests
— reads the same descriptor.

### 10. Provenance schema version 2

`bounding_box` changes from "any object, in practice always null" to a versioned
contract. `OBSERVATION_PROVENANCE_SCHEMA_VERSION` moves to `2` so a stored row
states which contract produced it. It is not an input to the Registry 2.0
candidate-release hash, which is unchanged at `f00c0e6f4b0c…`.

## Risks / Trade-offs

- **Documents processed before EH-118 keep page-only provenance and a page
  number that was a model guess.** → Provenance is write-once, so backfill is
  not possible; reprocessing a document regenerates the page index and grounds
  its rows.
- **Scanned documents get no region at all.** → The viewer states this
  explicitly ("exact region unavailable"), and the OCR engine that would fix it
  is scoped as separate work rather than faked here.
- **The visual-row clustering can merge two lines when a page mixes font
  sizes.** → The union box is rejected above a fifth of the page height, so a
  bad merge degrades to page-only rather than to a wrong highlight.
- **Tightening `bounding_box` breaks any writer that stored a free-form
  object.** → The migration clears pre-contract values first, the instrumental
  parser now routes model output through the contract, and the acceptance writer
  drops a region that does not match its page.
- **Changing an instrumental measure's region changes the EH-105 snapshot
  hash.** → Expected: the payload content changed. `source_locator` is left
  exactly as extracted so source identity is unaffected.

## Migration Plan

1. Apply `044_eh118_observation_source_region.sql`: create the contract
   function, clear pre-contract regions on the three tables (suspending the
   write-once guard for that one corrective statement), then add the page and
   region constraints.
2. Deploy the application and worker together. The reader tolerates page-only
   rows, so order is not critical, but the worker must not write regions before
   the constraints exist.
3. Reprocess documents whose provenance should be grounded. Existing rows keep
   working with page-only provenance until then.
4. Verify with `pnpm test:eh118`, `pnpm test:eh118-db`, and the two smoke
   commands against a real PDF.
5. Rollback: drop the three region constraints, the two page constraints, and
   the contract function. Stored regions remain valid data; the reader and the
   viewer already treat a region as optional.

## Open Questions

- No implementation-blocking question remains. Whether to add an OCR engine so
  scanned documents can also be highlighted is deliberately left to a later
  roadmap item.
