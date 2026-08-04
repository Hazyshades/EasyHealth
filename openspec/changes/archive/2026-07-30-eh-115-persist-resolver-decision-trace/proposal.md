## Why

EH-109 produces structured candidate evidence, but the document-review API recomputes it from the current resolver at read time. That prevents support from reliably inspecting the decision that was made for a historical resolved, ambiguous, partial, or unmapped row without rerunning a changed pipeline, and it risks exposing raw extracted content through ad hoc logging.

## What Changes

- Define a versioned, compact resolver decision trace that captures outcome, accepted and rejected evidence, candidate score and maturity, missing axes, hard conflicts, winning or non-selection rationale, and the catalog/resolver/trace-schema versions used for the decision.
- Persist the redacted trace atomically with each normalization revision and expose the stored active-revision trace through the authenticated document-review contract; historical revisions retain their own immutable trace.
- Replace review-time resolver recomputation for persisted decisions with the stored trace, while retaining an explicitly identified pending preview only before a revision exists.
- Add trace-schema validation, deterministic serialization, redaction, database constraints, and regression coverage for resolved, ambiguous, partial, unmapped, manual-correction, and retry paths.
- Add a tester-facing EH-115 QA checklist that distinguishes document-review behavior from database and privacy evidence.

## Capabilities

### New Capabilities
- `resolver-decision-trace`: Domain `documents`; immutable, privacy-safe resolver decision traces for normalization revisions and their authenticated inspection.

### Modified Capabilities
- None. No main capability specs currently exist under `openspec/specs/`.

## Impact

- **Application code:** `src/lib/biomarkers/measurement-resolution.ts`, `src/lib/biomarkers/types.ts`, `src/lib/documents/observation-normalization-writer.ts`, `src/lib/documents/normalization-review.ts`, `src/app/api/documents/[id]/biomarkers/route.ts`, and `src/components/documents/document-viewer.tsx`.
- **Database:** a new additive Supabase migration and SQL fixtures extending `observation_normalization_revisions` and its service-only atomic writer.
- **Verification:** existing measurement-registry, document-review, EH-106 writer, and database test conventions; new trace-focused regression coverage and `QA/eh-115/checklist.md`.
- **Dependencies:** consumes the delivered EH-109 structured evidence and EH-112 incomplete-outcome behavior, and preserves EH-104/EH-106 active-revision and atomic-write invariants.