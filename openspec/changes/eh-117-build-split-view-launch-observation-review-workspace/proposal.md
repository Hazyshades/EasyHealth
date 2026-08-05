# EH-117: Build split-view launch observation review workspace

## Why

EH-112 made the four resolver outcomes authoritative on the wire, EH-113
tightened the CBC launch catalog, and EH-115 persisted a privacy-safe decision
trace. The document review screen never caught up. It renders a single
1,485-line client component whose right pane is a flat list: rows are ordered
by name with no relationship to the page in view, the resolver outcome is a
sentence buried under the value, the verification state is only visible after
expanding **Technical details**, and there is no selected-row state at all. A
reviewer can click a row to move the preview, but nothing tells them which row
the preview belongs to, which results live on the visible page, or whether a
result that was never mapped is still safe to keep.

Loading and failure behaviour is equally thin. The initial load replaces the
whole workspace with a single line of text, a failed page-preview request
silently falls back to the original file, and a hard load failure offers only a
link back to the documents list.

EH-117 turns that screen into a review workspace: source evidence and review
state side by side, page-grouped rows with two-way selection synchronization,
resolution and verification presented as two independent chips, an explicit
raw-acceptance affordance, and real loading, error and recovery states.

EH-118 (bounding-box provenance) is not implemented, so region-level highlight
stays out of scope. The workspace models source precision explicitly
(`region` | `page` | `document`) and degrades to page + snippet today, so the
overlay can be layered in later without reshaping the selection contract.

## What Changes

- Add a pure review-workspace state model
  (`src/lib/documents/observation-review-workspace.ts`) that projects extracted
  rows and observation rows onto one `ReviewRow` shape, groups rows by source
  page, and resolves selection in both directions.
- Decompose the document viewer into a split-view workspace: a document source
  pane, a page-grouped observation list, a review row, a shared
  progressive-disclosure block, and a two-pane loading skeleton.
- Present resolver outcome and verification state as two separate status chips
  on every row, with the mapping-confidence band beside them.
- Surface an explicit raw-acceptance affordance on every partial, ambiguous or
  unmapped row awaiting review, plus a footer note on the accept action.
- Group rows by source page, synchronize selection with the visible page in
  both directions, scroll the selected row into view, and label rows with no
  recorded page as document-level provenance.
- Add loading skeletons for both panes, a recoverable hard-load error card, a
  page-preview error with its own retry, and a `role="alert"` review-data error.
- Return `confidence` from `GET /api/documents/[id]/observations` and serve that
  route with `Cache-Control: no-store`, so the observations fallback can render
  the same raw-evidence block as the extracted path.
- Name the `NormalizationReview` contract at
  `src/lib/documents/normalization-review.ts` instead of leaving the client to
  hand-maintain a 60-line structural copy.
- Register `/app/documents/<id>` in `resolvePageMeta` and pin the Turbopack
  workspace root so the build resolves modules from this project only.

## Capabilities

### New Capabilities

- `observation-review-workspace`: split-view review workspace covering pane
  composition, page-grouped rows, two-way selected-row synchronization, source
  precision fallback, and workspace loading/error states.

### Modified Capabilities

- `document-viewer`: side-by-side layout is now a page-synchronized workspace
  with skeleton loading, a recoverable load error, and a page-preview error.
- `document-extraction-review`: review rows lead with raw evidence, show
  resolution and verification as separate states, and expose raw acceptance.
- `incomplete-laboratory-outcomes`: the four-outcome wording and technical
  details contract is rendered identically in the extracted and
  observations-fallback paths.
- `documents-api`: the per-document observations route returns extraction
  confidence and is no-store.

## Impact

- Affected domains: documents.
- Affected code: `src/components/documents/document-viewer.tsx`,
  `src/components/documents/review/*` (new),
  `src/lib/documents/observation-review-workspace.ts` (new),
  `src/lib/documents/normalization-review.ts`, `src/lib/navigation.ts`,
  `src/app/app/documents/[id]/page.tsx`,
  `src/app/api/documents/[id]/observations/route.ts`, `next.config.ts`,
  `scripts/verify-eh117-review-workspace.ts` (new), `package.json`.
- Affected data and operations: none. No migration, no schema change, no writer
  change. The workspace reads columns that already exist and writes through the
  unchanged acceptance, correction and confirmation endpoints.
