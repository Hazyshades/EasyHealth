# EH-117 design: split-view launch observation review workspace

## Context

The document detail route mounts one client component. It owns 24 pieces of
state, seven mutation handlers and roughly 750 lines of JSX, and it already
carries load-path guarantees that other capabilities depend on: a single
bootstrap request on open, a page-only fetch on page change, an 8-second soft
processing poll with a 150-second stop, and a worker-offline recovery banner.
Those guarantees are asserted by the `document-viewer` capability and must
survive this change untouched.

What the component does not have is a review model. Rows are rendered directly
from two different payload shapes — `extracted_biomarkers[]` with a
`normalization` block, and `observations[]` with a `resolution_details` block —
through two divergent branches. The extracted branch renders decision traces,
manual mapping and undo; the observation branch renders a smaller subset. There
is no shared notion of "a row", no selection, and no page relationship.

Dependencies are settled: EH-112 and EH-113 are delivered on `master`; EH-118 is
not implemented anywhere, and both `document-viewer` and
`document-extraction-review` already forbid bounding-box overlays in v1.

## Goals / Non-Goals

**Goals:**

- One row model for both payload shapes, with raw evidence rendered before any
  mapping explanation.
- Resolver outcome and verification state readable without expanding anything.
- Page-grouped rows with selection synchronized in both directions.
- Raw acceptance that is visibly available and never requires a mapping.
- Consistent progressive disclosure across both panel modes.
- Real loading skeletons, a recoverable load error, and a page-preview error
  that does not blank the review pane.
- Responsive single-column stacking with no horizontal overflow.

**Non-Goals:**

- Bounding-box highlight overlays. That is EH-118; this change only reserves the
  `region` precision value.
- Row-level reprocessing, batch reprocessing UI, or any change to the
  acceptance, correction or confirmation writers.
- Changing what the resolver decides, or how verification transitions are
  derived. EH-119 and EH-120 own those.
- Introducing a resizable split-pane, a tabs primitive, or any new Radix
  dependency. The repository has three Radix packages and native
  `<details>`/`<select>` idioms; EH-117 stays inside them.
- Server-rendered review data. The route stays client-fetched, as every other
  `/app/**` page is.

## Decisions

### 1. A pure `ReviewRow` projection instead of two divergent branches

`src/lib/documents/observation-review-workspace.ts` exports
`buildExtractedReviewRow` and `buildObservationReviewRow`, both returning the
same `ReviewRow`:

```
{ id, sourceKind, reviewable, accepted, rawEvidence, source, mapping,
  resolutionDetails }
```

`rawEvidence` carries only what the document reported: the raw name, the
formatted reported value with its reported unit, the verbatim raw value text
when it differs, the reported reference range, the specimen/modifier/method
**only when explicitly stated**, and extraction confidence. `mapping` carries
the resolver outcome, the EH-112 label and guidance, the verification status and
its label, the confidence band, `registryBindingReady`, and `acceptableAsRaw`.

The projection deliberately has no field for a candidate measurement key or a
candidate display name, so an incomplete row cannot render one. This is the
structural version of the EH-112 rule; the regression suite asserts that extra
candidate fields present on the server payload are dropped.

Alternative considered: extend the existing two branches with shared helper
functions. Rejected — the divergence is the defect, and a shared row type is
what makes the list, grouping, selection and technical-details components
possible at all.

### 2. Source precision is a first-class enum with a document-level floor

`resolveSourceLocation(page, text)` returns
`{ precision, page, snippet, label }` where `precision` is
`"region" | "page" | "document"`. Today nothing produces `"region"`: a positive
finite page yields `"page"`, anything else yields `"document"` with the label
`Source page not recorded`.

This does three things. It makes the EH-118 gap explicit in the UI instead of
silently rendering nothing. It keeps unlocated rows selectable without moving
the preview. And it gives EH-118 a single function to extend rather than a
selection contract to redesign.

### 3. Selection is resolved by a pure function, in both directions

- List to document: activating a row sets the selection and, when the row has a
  page, moves the preview to it.
- Document to list: `resolveSelectionForPage(rows, page, selectedRowId)` runs in
  an effect keyed on `[reviewRows, currentPage]`. It keeps the current selection
  when that row belongs to the visible page, otherwise selects the first row
  anchored to the page, otherwise leaves the selection alone.

The function is idempotent by construction — feeding its own output back returns
the same id — which is what makes the effect safe. The regression suite asserts
idempotence explicitly, because a non-idempotent resolver here would produce a
render loop rather than a wrong pixel.

Rows are keyed with `data-review-row-id`, marked `aria-current="true"` when
selected, and scrolled into view with `block: "nearest"` so a selection driven
from the document side is never off-screen.

### 4. Two chips, never one

`ReviewStateChips` renders the resolver outcome and the verification state as
two separate `StatusChip`s, with the confidence band as adjacent muted text.
Variants are mapped centrally: resolved → success, partial → info, ambiguous →
warning, unmapped → neutral; pending → neutral, auto_verified → info,
user_verified and manually_corrected → success.

Verification labels are user-facing prose, not enum values: `Not verified yet`,
`Verified automatically`, `Verified by you`, `Corrected by you`. A missing
verification status reads as `Not verified yet` rather than disappearing, so the
absence of a decision is never mistaken for approval.

### 5. Raw acceptance is stated, not implied

`mapping.acceptableAsRaw` is true exactly when a row is still awaiting review
and its outcome is not `resolved`. Those rows render a sentence under the EH-112
guidance — "You can accept this result as reported. Mapping is optional and is
never required to keep the value." — and the accept action carries a matching
footer note. The manual-mapping select keeps its existing placeholder, "Select
only if the report states the specimen", so the optional path stays optional.

### 6. Composition boundary: the viewer keeps the data contract, the panes keep the pixels

`DocumentViewer` remains the single owner of fetching, polling and mutations, so
every `document-viewer` load-path requirement is preserved byte for byte. What
moves out is presentation:

- `DocumentSourcePane` — page navigation, zoom (now local pane state), preview
  branch precedence, page loading skeleton, page error with retry, and the
  source-provenance strip.
- `ObservationReviewList` — page groups, sticky group headers with a
  "Show page" jump, and selected-row scroll-into-view.
- `ObservationReviewRow` — raw evidence, chips, guidance, disclosure slot. The
  acceptance checkbox is now a sibling of the activation button rather than
  nested inside it, which also fixes invalid nested-interactive markup.
- `ReviewTechnicalDetails` — one `<details>` block used by both panel modes.
- `ReviewWorkspaceSkeleton` — two-pane skeleton reused by the route's
  `Suspense` fallback and by the viewer's initial load.

### 7. Minimal server surface change

The observations route already selects `source_page`, `source_text` and the raw
provenance columns; it was missing `confidence`, which the raw-evidence contract
lists. One column is added to the select, and the route switches from
`NextResponse.json` to `noStoreJson` so review state cannot be served stale.
`bounding_box` stays unselected — exposing a coordinate the UI is forbidden to
draw would invite exactly the misalignment EH-118 has to solve properly.

## Risks / Trade-offs

- **A page-synchronization effect can loop if selection resolution is not
  idempotent** -> `resolveSelectionForPage` is pure and idempotent, and the
  regression suite asserts `f(f(x)) == f(x)`.
- **Decomposing a 1,485-line component risks silently dropping a load-path
  guarantee** -> all fetching, polling, timers and handlers stayed in
  `DocumentViewer` unchanged; only JSX moved. Verified by driving the built
  workspace with fixtures for both panel modes.
- **Auto-selecting the first row on the visible page could surprise a reviewer**
  -> selection only moves when the visible page changes or the row set reloads,
  never while the reviewer is reading a row on that page, and it never triggers
  a write.
- **Two chips per row plus a summary line increases visual load in a 380px
  rail** -> the rail widens to 420px at `xl`, the confidence band is muted text
  rather than a third chip, and everything else stays behind
  **Technical details**.
- **Showing `Source page not recorded` exposes an extraction gap to users** ->
  intended. Silently omitting provenance is worse, and the label is the honest
  page-only fallback EH-118 will upgrade.
- **Turbopack root pinning is unrelated to the feature** -> it is one line with a
  comment; without it a lockfile in a parent directory makes the production
  build resolve modules outside the repository.

## Migration Plan

1. Land the pure state model and its regression suite first; it has no runtime
   dependents until step 3.
2. Add `confidence` to the observations select and switch the route to
   `noStoreJson`. Additive; existing consumers ignore the new field.
3. Add the `review/` components and recompose `DocumentViewer` around them in a
   single cutover — no feature flag, no parallel implementation, no legacy
   branch left behind.
4. Register the route title and pin the Turbopack root.
5. Run `pnpm test:eh117`, `pnpm test:eh112`, `pnpm test:eh113`,
   `pnpm test:document-review`, `pnpm verify:registry`, `pnpm typecheck` and
   `pnpm build`, then record the QA checklist.

No database migration, no backfill, no rollback data path. Reverting is a code
revert.

## Open Questions

- Should the workspace remember the last selected row per document across
  navigations? Deferred until EH-119 introduces edit flows that would benefit
  from it.
- Should `Show page` also collapse other page groups once documents routinely
  exceed a few pages? Deferred until EH-127 brings longer multi-event documents.
