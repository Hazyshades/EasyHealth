## Context

EH-118 already supplies a page index from `pdftotext -bbox-layout`, normalized geometry, page provenance, a resolver, the document source pane, and a pinned highlight. The remaining EH-162 gap is behavioral and trust-related: the current `SourceRegion` payload can identify a fuzzy or model-origin box but the viewer treats every contract-valid box as renderable; rows have no hover/focus preview; extracted pre-acceptance rows and accepted observations do not share an ephemeral intent path; and the pane scrolls for the single active source rather than only for a pinned selection.

The issue is safety-sensitive. A wrong rectangle is worse than no rectangle, and provenance is write-once. The implementation must preserve existing EH-118 rows and page-only fallbacks while making new provenance explicit enough for the renderer and database to distinguish exact positional evidence from weaker matches.

## Goals / Non-Goals

**Goals:**

- Persist new source geometry with normalized coordinates, explicit top-left origin, one or more line rectangles, and deterministic match metadata.
- Read legacy EH-118 geometry without silently rendering fuzzy or model-origin rectangles.
- Render only exact, page-coherent geometry on the displayed page.
- Preview exact regions on pointer hover and keyboard focus for both extracted review rows and observation fallback rows without navigation or scroll.
- Keep click/Enter as the pin/navigation action; render preview and pinned variants together and let only pinned selection scroll the source pane.
- Cover exact, fuzzy, ambiguous, unresolved, cross-page, no-layer, legacy, image-error, zoom, resize, reduced-motion, and pre-acceptance paths with deterministic checks.

**Non-Goals:**

- Adding a new API endpoint, changing RLS/ownership, or adding raw document text to logs.
- OCR for scanned documents or photographs; those remain page-only.
- Reverse document-region-to-row selection, free-text search, or manual box correction.
- Backfilling or mutating write-once provenance for legacy rows.
- Changing EH-117 split-view navigation semantics beyond making explicit pinning consistent for extracted and observation rows.

## Decisions

### 1. Use a forward-compatible canonical region payload and a legacy parser

New writes use the existing JSONB `bounding_box` columns with this canonical shape:

```json
{
  "schema_version": 1,
  "coordinate_space": "normalized",
  "origin": "top-left",
  "page": 1,
  "rects": [{ "x": 0.106, "y": 0.514, "w": 0.243, "h": 0.017 }],
  "match": {
    "strategy": "exact",
    "score": 1,
    "engine": "pdf-text-bbox",
    "resolver_version": "1"
  }
}
```

`parseSourceRegion` canonicalizes this shape and also accepts the EH-118 shape (`space`, `x/y/w/h`, and `origin` values `ocr_exact|ocr_fuzzy|model`). Legacy `ocr_exact` maps to exact; legacy fuzzy/model geometry remains available as validated evidence but is never renderable. This avoids a destructive backfill and lets old observations continue to display page-only provenance.

A source region is page-coherent when its page matches the row page. It is renderable only when `match.strategy === "exact"` and it has at least one rectangle. These are separate predicates: fuzzy evidence may be copied forward and audited without becoming a visual claim.

### 2. Preserve exact and fuzzy evidence, but render exact only

`resolveSourceRegion` continues to classify exact and fuzzy matches. Exact and fuzzy geometry is built with `match.engine = "pdf-text-bbox"`, a stable resolver version, and a score. Ambiguous, unresolved, absent, and no-layer outcomes continue to return no geometry and use the existing page fallback. The worker stores the resolver's geometry on extracted rows; acceptance and API reads validate page coherence, while the review-row adapter gates visual precision through the exact-only predicate.

A match spanning multiple visual lines is grouped by normalized vertical center and persisted as separate `rects`. The overlay renders every rect, preventing a single envelope from swallowing unrelated table columns. The normalized coordinates and top-left origin remain invariant through raster resize, CSS zoom, and responsive layout.

The LLM remains responsible only for the quoted snippet and page hint. Poppler remains the sole geometry source. `source_text` guidance requires the label, value, and unit when printed so exact matches are more likely without relaxing the rendering policy.

### 3. Keep preview intent separate from pinned selection

`DocumentViewer` owns `selectedRowId` (pinned source) and a separate preview row id. `ObservationReviewRow` starts a 100 ms preview timer on mouse enter or focus and clears it immediately on leave or blur. The parent accepts the preview only when the row has exact region precision on `currentPage`; it never changes `currentPage` or `selectedRowId`. A page-group "Show page" action and the row's existing source-page label remain the explicit cross-page affordance.

The selected row is passed as `pinnedSource`; the preview row is passed as `previewSource`. The source pane renders both when they differ. A pinned region uses a solid/heavier treatment; a preview uses a dashed/softer treatment. Border style, weight, and contrast distinguish them without relying on hue. The overlay is decorative (`aria-hidden`, `pointer-events: none`), while the row's source label/snippet remains the accessible description.

### 4. Make the source pane the only scroll owner

`DocumentSourcePane` scrolls its own container only when the pinned region changes, after the page image is ready. Preview regions never trigger `scrollTo` or `scrollIntoView`. Zoom continues to transform an image-sized wrapper, and every rectangle is positioned as a percentage of that wrapper. An image load error suppresses both overlays and uses the existing retry path.

### 5. Enforce the payload in application and database boundaries

Add a forward migration that updates the EH-118 database predicate to accept the canonical EH-162 shape and legacy EH-118 shape, validating normalized rectangles, match metadata, and page fields. Existing region/page constraints remain in force. Application parsers, API serialization, acceptance writers, and instrumental readers all pass through the same parser; no new endpoint or bypass is introduced.

### 6. Verify behavior without adding a test framework

Extend the existing `tsx` verification style. Contract tests exercise canonical and legacy parsing, exact-only rendering, multi-rect geometry, and page coherence. Resolver tests cover exact, fuzzy, duplicate, multi-line, and no-layer outcomes. A focused EH-162 verification script checks row intent handlers, source-pane scroll ownership, overlay variants, accessibility attributes, and the modified spec/migration wiring. Existing EH-118 checks are updated only where the intentional payload compatibility and exact-only rule change their assertions.

## Risks / Trade-offs

- **Old regions use the EH-118 shape.** The parser keeps a compatibility branch and maps their origin to match quality; invalid or non-exact legacy boxes degrade to page-only rather than being deleted.
- **Fuzzy geometry remains in storage but not in the UI.** This preserves audit/debug evidence and future measurement while avoiding a false visual claim; the renderer has a dedicated exact predicate so this policy is not accidental.
- **Multi-line grouping can split or merge lines when font heights vary.** The existing row-band heuristic is retained, each line is rendered separately, and an implausibly tall match degrades to no region.
- **Hover events can churn while traversing a long list.** The 100 ms enter delay and zero-delay exit avoid sticky previews without introducing global timers; cleanup on unmount prevents stale previews.
- **The source page may be off-screen.** Hover intentionally does not navigate or scroll. The existing explicit page affordance remains the safe route; only a click/pin can change page and scroll the pane.
- **Database function compatibility is more permissive than the UI.** The database validates shape and page coherence, while the application enforces the stronger exact-only rendering policy. This is necessary to preserve fuzzy evidence without widening the visual claim.
