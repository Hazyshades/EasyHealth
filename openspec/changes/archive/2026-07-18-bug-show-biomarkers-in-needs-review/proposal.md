## Why

**(bug)** A lab document can be in `needs_review` while the detail bootstrap contains linked `observations` but no current `extracted_biomarkers`. The viewer currently selects the extraction branch solely from the document status, renders an empty list, and hides the confirmation action, so the user cannot see what was detected or understand what remains to be reviewed.

## What Changes

- Make the `needs_review` biomarkers panel display the best available document-linked biomarker data instead of rendering an empty extraction list.
- Prefer current reviewable `extracted_biomarkers` as the review source, preserving selection, provenance, and the existing accept endpoint.
- Fall back to linked `observations` when no current extracted rows are available, with clear copy distinguishing already stored observations from reviewable extraction candidates.
- Show a confirmation action in `needs_review` whenever the panel has actionable biomarkers: accept selected extracted rows through the existing flow, or acknowledge the linked observations through a guarded recovery flow without inserting them again.
- Show an actionable inconsistency state only when a document is `needs_review` but neither extracted biomarkers nor linked observations are available, rather than presenting an unexplained blank panel.
- Add regression coverage for `needs_review` documents with extracted rows, observations-only fallback, and no biomarker data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `document-extraction-review`: Clarify the review UI contract for `needs_review`, confirmation availability, observations fallback, and inconsistent review data.
- `document-viewer`: Require the right panel to render the best available biomarker source without allowing document status alone to force an empty branch.

## Impact

- Target domain: `documents`.
- Affected UI: `src/components/documents/document-viewer.tsx` biomarker source selection, empty states, row selection, and confirmation action.
- Affected API/error handling: `GET /api/documents/[id]` bootstrap consumers, explicit surfacing of extracted-biomarker query failures, the existing extracted-row accept flow, and a guarded observations-only review acknowledgement path.
- Affected tests: document viewer state-selection and review-action regression tests.
- No database schema change, biomarker catalog change, observation migration, or medical interpretation change is intended.
