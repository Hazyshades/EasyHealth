## 1. Source-region contract and persistence

- [x] 1.1 Replace the new-write `SourceRegion` shape with normalized `coordinate_space`, `top-left` origin, `rects`, and deterministic `match` metadata while keeping a compatibility parser for EH-118 payloads.
- [x] 1.2 Separate page coherence from renderability: accept page-coherent fuzzy evidence for persistence, but expose an exact-only predicate for UI overlays and source precision.
- [x] 1.3 Add the EH-162 database migration that validates canonical rectangles and match metadata while accepting legacy EH-118 JSONB values and preserving existing page constraints.
- [x] 1.4 Update acceptance, observation reads, instrumental readers, and review-row adapters to canonicalize all `bounding_box` values through the shared parser without mutating write-once provenance.

## 2. Deterministic extraction provenance

- [x] 2.1 Update the PDF snippet resolver to attach exact/fuzzy match metadata and emit separate normalized rectangles for multi-line matches.
- [x] 2.2 Keep ambiguous, unresolved, missing-layer, and geometrically implausible outcomes page-only; ensure fuzzy evidence never becomes renderable.
- [x] 2.3 Tighten laboratory `source_text` guidance to include the printed label, value, and unit when present, without asking the model for coordinates or logging document text.
- [x] 2.4 Persist the canonical provenance payload from the worker for extracted biomarkers and accepted observations, including legacy-safe page fallback behavior.

## 3. Review-row preview interaction

- [x] 3.1 Add exact-only preview and pinned source state to the document review workspace while preserving extracted pre-acceptance and observation fallback row parity.
- [x] 3.2 Add 100 ms hover/focus entry and immediate leave/blur cleanup to review rows, with accessible source descriptions and no navigation or selection side effects.
- [x] 3.3 Keep cross-page rows page-only during preview and retain an explicit page affordance for navigation; make explicit click/Enter the pin action.

## 4. Overlay and source-pane rendering

- [x] 4.1 Extend `SourceHighlightOverlay` to render multiple rectangles with distinct preview/pinned non-colour variants, reduced-motion support, minimum visible size, `aria-hidden`, and `pointer-events: none`.
- [x] 4.2 Update `DocumentSourcePane` to render pinned and preview regions together, gate overlays on exact same-page image readiness, and scroll only pinned highlights inside its own container.
- [x] 4.3 Handle page-image load failure by suppressing overlays and preserving the existing retry/preview-unavailable state.

## 5. Viewer integration

- [x] 5.1 Wire separate preview and pinned row state through `DocumentViewer` for both extracted-review and observations-fallback panels.
- [x] 5.2 Ensure explicit selection navigates/pins while hover/focus never changes page, layout, list scroll, or source-pane scroll; clear stale preview state on page/data refresh.
- [x] 5.3 Preserve existing API fields, ownership boundaries, zoom behavior, and page-only explanatory copy while exposing canonical match metadata to the validated client model.

## 6. Verification and delivery evidence

- [x] 6.1 Update EH-118 contract and resolver checks for compatibility parsing, exact-only rendering, canonical match metadata, and multi-line rectangles.
- [x] 6.2 Add focused EH-162 verification and smoke coverage for hover/focus wiring, pinned-plus-preview coexistence, fallback ladder, accessibility attributes, image failure, and scroll ownership; register the commands in package scripts/CI where applicable.
- [x] 6.3 Create `QA/eh-162/checklist.md` from the roadmap template with tester-facing normal, negative, keyboard, cross-page, zoom/resize, and unavailable-preview cases plus developer evidence requirements.
- [x] 6.4 Synchronize affected biomarker/provenance documentation, regenerate/check canonical biomarker docs and Wiki staging, and record any remote Wiki or tracking-issue publication blocker explicitly.
