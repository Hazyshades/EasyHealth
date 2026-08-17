# EH-162: Highlight source region on biomarker hover

## Why

The EH-118 pipeline now records normalized source geometry, but the review workspace only shows a pinned highlight after explicit selection and currently permits fuzzy-derived geometry to look authoritative. Reviewers still have to click rows, lose their place, and risk trusting a rectangle that was not an exact positional match. EH-162 makes provenance preview passive and keyboard-accessible while failing closed whenever the source region is not exact and page-coherent.

## What Changes

- **BREAKING** Modify the source-region payload contract so new persisted provenance carries declared normalized coordinate space, top-left origin, one or more per-line rectangles, and explicit match metadata (`exact`, `fuzzy`, `ambiguous`, or `unresolved`); continue reading legacy EH-118 payloads as page-only unless their derived match is exact.
- Restrict rendered overlays and the `region` precision to deterministic `exact` positional matches on the currently displayed page. Fuzzy, ambiguous, unresolved, legacy, missing-layer, cross-page, and invalid regions remain page-only.
- Preserve exact and fuzzy resolver evidence at extraction time, including multi-line snippets as separate line rectangles, without asking an LLM to invent geometry or adding raw document text to telemetry.
- Add ephemeral hover and keyboard-focus preview for extracted pre-acceptance rows and authoritative observation rows, with a short enter delay and immediate exit; preview never navigates, scrolls, or changes selection.
- Keep the explicit click/Enter selection path as the pinned highlight. Pinned and preview highlights coexist with distinct non-colour visual treatment; only pinning may scroll the source pane.
- Add same-page gating, cross-page page affordances, reduced-motion behavior, resize/zoom-safe percentage rendering, and explicit page-only fallback copy.
- Retire the archived v1 prohibition on overlays and replace it with the conditional exact-match requirement in a `## MODIFIED Requirements` delta.
- Add deterministic contract, resolver, interaction, fallback, and source-level verification plus the required `QA/eh-162/checklist.md` tester checklist.

## Capabilities

### New Capabilities

- None. EH-162 extends the existing documents extraction-review and document-viewer capabilities created by the earlier document pipeline changes.

### Modified Capabilities

- `document-extraction-review`: replace the v1 no-overlay rule with exact-match-only provenance preview and define hover/focus behavior for extracted and observation rows.
- `document-viewer`: add preview/pinned overlay variants, page-local rendering, zoom/resize stability, and the fallback ladder.
- `extraction-provenance`: make match quality explicit, preserve deterministic evidence, and prevent fuzzy or inferred geometry from rendering.

## Impact

- **Domains:** `documents` (worker provenance payload, resolver, review rows, source pane, verification).
- **Primary code:** `src/lib/documents/source-region.ts`, `src/lib/documents/source-region-match.ts`, `src/lib/documents/observation-review-workspace.ts`, `src/components/documents/source-highlight-overlay.tsx`, `src/components/documents/review/document-source-pane.tsx`, `src/components/documents/review/observation-review-row.tsx`, and `src/components/documents/document-viewer.tsx`.
- **Persistence:** a forward-compatible source-region migration updates the database contract while accepting legacy EH-118 rows for read compatibility; no backfill or in-place provenance mutation is introduced.
- **API:** no new endpoint and no ownership/RLS change; existing document, biomarker, and observation reads continue returning validated provenance.
- **Verification:** extend EH-118 regression checks, add EH-162 behavior checks, and run the relevant typecheck, document-review, source-region, and UI smoke commands.
