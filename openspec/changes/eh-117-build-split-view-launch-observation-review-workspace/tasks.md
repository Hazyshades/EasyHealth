# EH-117 tasks

## 1. Review workspace state model

- [x] 1.1 Add `src/lib/documents/observation-review-workspace.ts` with the
      `ReviewRow`, `ReviewRowRawEvidence`, `ReviewRowSourceLocation` and
      `ReviewRowMappingState` contracts.
- [x] 1.2 Implement `buildExtractedReviewRow` and `buildObservationReviewRow`
      so both payload shapes project onto one row, with raw evidence preserved
      and no candidate identity field present.
- [x] 1.3 Implement `resolveSourceLocation` with the
      `region | page | document` precision enum and the
      `Source page not recorded` document-level fallback.
- [x] 1.4 Implement `groupReviewRowsByPage`, `findReviewRow`,
      `resolveSelectionForPage`,
      `summarizeReviewRows` and `hasIncompleteOutcomes`.
- [x] 1.5 Add the verification and resolver presentation vocabulary
      (`verificationStatusLabel`, `verificationStatusVariant`,
      `resolverOutcomeVariant`) and reuse the EH-112 wording helpers rather
      than restating them.

## 2. Server surface

- [x] 2.1 Add `confidence` to the select in
      `src/app/api/documents/[id]/observations/route.ts` and type it on
      `ObservationWithRevision`.
- [x] 2.2 Serve that route with `noStoreJson` so review state is never cached.
- [x] 2.3 Leave `bounding_box` unselected; region highlight stays with EH-118.
- [x] 2.4 Name the `NormalizationReview` and `ManualMappingOption` contracts in
      `src/lib/documents/normalization-review.ts` and annotate
      `buildNormalizationReview` with them.

## 3. Split-view workspace components

- [x] 3.1 Add `src/components/documents/review/document-source-pane.tsx` with
      page navigation, local zoom state, the preview branch precedence, a page
      loading skeleton, a page error with retry, and the source-provenance
      strip including the document-level and PDF fallback notices.
- [x] 3.2 Add `observation-review-list.tsx` with page groups, sticky group
      headers, a `Show page` jump, and selected-row scroll-into-view.
- [x] 3.3 Add `observation-review-row.tsx` rendering raw evidence first, the
      source label, the status chips, the mapping guidance, the raw-acceptance
      note, and a technical-details slot. Move the acceptance checkbox out of
      the activation button.
- [x] 3.4 Add `review-status-chips.tsx` presenting resolution and verification
      as two independent chips with the confidence band beside them.
- [x] 3.5 Add `review-technical-details.tsx` as the single progressive
      disclosure block shared by both panel modes.
- [x] 3.6 Add `review-workspace-skeleton.tsx` and use it for the initial load
      and for the route `Suspense` fallback.

## 4. Viewer recomposition

- [x] 4.1 Recompose `DocumentViewer` around the new components while keeping
      the single bootstrap request, the page-only fetch, the 8s soft poll with
      the 150s stop, and the worker-offline recovery banner unchanged.
- [x] 4.2 Add `selectedRowId` state, the page-synchronization effect, and the
      row activation handler.
- [x] 4.3 Add `pageLoading` and `pageError` state to the page fetch, and a
      recoverable hard-load error card with a working `Retry`.
- [x] 4.4 Widen the review rail responsively
      (`lg:[minmax(0,1fr)_380px]`, `xl:[minmax(0,1fr)_420px]`) and keep the
      single-column stack free of horizontal overflow.
- [x] 4.5 Add the review summary line and route both panel modes through the
      shared list.
- [x] 4.6 Register `/app/documents/<id>` in `resolvePageMeta` and pin the
      Turbopack workspace root in `next.config.ts`.

## 5. QA, verification, and EH-118 handoff

- [x] 5.1 Create `QA/eh-117/checklist.md` with tester-facing preconditions,
      safe synthetic test data, numbered UI actions and observable expected
      results, plus a separate developer-evidence section.
- [x] 5.2 Add `scripts/verify-eh117-review-workspace.ts` and wire
      `pnpm test:eh117`.
- [x] 5.3 Run the verification set — `pnpm test:eh117`, `pnpm test:eh112`,
      `pnpm test:eh113`, `pnpm test:document-review`, `pnpm test:eh106`,
      `pnpm test:eh116`, `pnpm verify:registry`, `pnpm typecheck`,
      `pnpm build` — and record the results in the QA checklist.
- [x] 5.4 Drive the built workspace with synthetic fixtures for the
      extracted-review and observations-fallback modes and record the observed
      behaviour as developer evidence.
- [x] 5.5 Record the EH-118 handoff: no bounding-box overlay ships here, and
      `SourcePrecision` reserves `region` for it.
- [ ] 5.6 Update GitHub issue #17 and the roadmap once this change is merged.
