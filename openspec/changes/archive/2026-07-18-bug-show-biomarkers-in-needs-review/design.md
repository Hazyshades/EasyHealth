## Context

The lab document viewer currently derives `pipelineMode` from `!is_legacy`, `document_type === "lab_result"`, and either a non-empty `extracted_biomarkers` array or parent status `needs_review`. The render branch then chooses `extracted_biomarkers` whenever `pipelineMode` is true and evaluates `observations` only in the alternate branch. Consequently, a `needs_review` document with `extracted_biomarkers: []` and populated `observations` displays an empty panel. The confirmation button is separately gated by the presence of reviewable extracted rows, so it also disappears.

The bootstrap endpoint already returns both collections. Existing extraction acceptance is provenance-aware and operates on extracted biomarker IDs. Some inconsistent or legacy/reprocessed records can nevertheless reach `needs_review` with only linked observations, so the repair must support that state without duplicating observations or weakening ownership checks.

## Goals / Non-Goals

**Goals:**

- Make every `needs_review` biomarker panel explain what is available and what the user can confirm.
- Preserve current extracted rows as the authoritative source for ordinary review and acceptance.
- Provide a safe observations-only recovery mode for documents that already have linked observations but no current extracted candidates.
- Prevent database/query failures from being mistaken for a valid empty extraction result.
- Cover source selection, button visibility, confirmation, and state refresh with regression tests.

**Non-Goals:**

- Re-run extraction automatically when the viewer opens.
- Convert observations back into synthetic extraction rows.
- Change biomarker normalization, scoring, catalog resolution, or medical summary generation.
- Add a new database schema or rewrite existing observations.

## Decisions

### 1. Replace status-driven pipeline mode with an explicit panel state

Derive a small view model from bootstrap data:

```text
extracted.length > 0                         -> extracted-review
extracted.length == 0 && observations > 0  -> observations-fallback
review-data error                           -> review-error
otherwise                                   -> empty
```

Document status controls whether confirmation is offered, but it does not select an empty data source. Current extracted rows always take precedence because they carry review status, source evidence, normalization detail, and IDs accepted by the existing endpoint.

Alternative rejected: render observations inside the existing `pipelineMode` branch as an incidental fallback. An explicit state avoids title/action mismatches and makes the inconsistent recovery path testable.

### 2. Keep ordinary extracted acceptance unchanged

In `extracted-review`, selection continues to include only `needs_review` and `pending_review` rows. The existing `POST /api/documents/[id]/biomarkers/accept` contract remains responsible for creating/updating observations, marking extracted rows accepted, and transitioning the document when no pending rows remain.

Alternative rejected: accept all displayed rows automatically. Explicit selection is already part of the review safety model.

### 3. Add a narrow observations-only acknowledgement path

In `observations-fallback` with parent status `needs_review`, show a distinct confirmation label such as `Confirm biomarkers`, not `Accept selected`. The server action receives the displayed observation IDs and atomically verifies:

- authenticated ownership of the document;
- document status is still `needs_review`;
- every submitted observation belongs to the same profile and document;
- the submitted set matches the current linked observation set expected for acknowledgement;
- a fresh current-extraction query succeeds and returns no reviewable rows.

On success it updates only the document lifecycle fields to `processing_status = "ready"` and completed status. It does not insert, upsert, relink, or normalize observations. If reviewable extracted rows appear concurrently, the request fails and the client refreshes into `extracted-review`.

Alternative rejected: send observation IDs to the extracted-biomarker accept endpoint. Those are different identities and conflating them would obscure provenance and make authorization mistakes easier.

### 4. Treat extraction query errors as errors

The bootstrap handler must inspect `extractedResult.error` before applying `data ?? []`. A failed query produces an error signal/response that the viewer can render and must block both confirmation modes. The same rule applies to the fresh server-side guard used by observations-only acknowledgement.

Alternative rejected: keep the silent fallback and rely on the presence of observations. A schema or database failure is indistinguishable from a genuine empty result and could incorrectly complete a document while review rows exist.

### 5. Refresh bootstrap after either confirmation mode

After success, reuse the existing soft bootstrap refresh so document preview state remains mounted while status, panel mode, and actions reconcile with server state.

## Risks / Trade-offs

- [Observations-only acknowledgement could hide concurrently created extracted rows] -> Re-query current extracted rows inside the server action immediately before the guarded status update and reject on any reviewable row.
- [A document may contain an incomplete observations fallback] -> Display that these are already stored results and require confirmation of the complete server-validated linked set rather than an arbitrary subset.
- [Changing the source-selection branch can affect legacy documents] -> Add a ready/legacy observations regression scenario and preserve observations display without confirmation outside `needs_review`.
- [API query errors become visible where they were previously silent] -> Use concise recovery copy and retain the existing Reprocess action; visibility is preferable to a misleading empty review.

## Migration Plan

1. Add regression tests that reproduce the empty `needs_review` panel and missing confirmation action.
2. Implement explicit panel-state derivation and source-specific rendering/actions.
3. Add the guarded observations-only acknowledgement server action and ownership/concurrency tests.
4. Surface extracted-query failures and verify they block confirmation.
5. Run document viewer, document API, typecheck, and production build checks.

No data migration is required. Rollback reverts the UI state derivation and acknowledgement action; existing extracted rows and observations remain unchanged.

## Open Questions

- Final English recovery copy and button label should be checked against the existing document-review terminology during implementation.
