## Why

The review workspace already accepts selected extracted rows in bulk, but it preselects every row awaiting review and labels the action as generic acceptance. That permits incomplete, ambiguous, low-confidence, edited, or previously decided rows to join the same action as a high-confidence exact resolved match, without an eligibility explanation or a confirmation summary.

EH-122 must turn that mechanical batch writer into a safe, auditable verification workflow. It follows delivered EH-119 corrections and EH-121 append-only history while preserving the Registry 2.0 rule that partial, ambiguous, and unmapped rows may be retained as raw evidence but must never become verified concrete measurements.

## What Changes

- Define one server-authoritative eligibility policy for batch verification of extracted laboratory rows: the row must be awaiting review, resolve deterministically from its current source evidence to a concrete reviewed definition, and meet the strict low-risk exact-evidence policy: an approved exact alias match with no fallback, no missing/conflicting compatibility axes, no active human correction or other protected manual decision, and a current source. The resolved evidence is persisted in the successful verification revision; pending-review rows are evaluated from the current deterministic resolver preview because they have no revision yet.
- Keep ineligible rows out of the selection and explain every exclusion using stable, user-readable reason codes; no client-side state may make an ineligible row eligible.
- Replace the current all-reviewable default selection with an explicit batch-verification selection model that starts from eligible rows only and allows the reviewer to deselect eligible rows.
- Add a confirmation step that reports selected, eligible-but-not-selected, and excluded counts grouped by exclusion reason before any write occurs.
- Add a document-scoped batch verification endpoint with request idempotency, per-row compare-and-swap protection, independent row results, aggregate outcome, and server-side eligibility re-evaluation at execution time.
- Persist every successful batch verification through the existing normalization writer and its EH-121 trigger-backed change ledger; add an audit-safe batch undo that creates reversal revisions rather than mutating or deleting prior revisions.
- Preserve individual correction, manual mapping, raw acceptance, and restore flows. Partial, ambiguous, and unmapped rows remain individual/raw-acceptance paths and are not batch-verification candidates.

## Capabilities

### New Capabilities
- `batch-observation-verification`: document-review selection, confirmation, execution, retry/idempotency, exclusion reporting, and audit-safe reversal for low-risk exact laboratory matches.

### Modified Capabilities
- None. This repository has no active main OpenSpec capability spec for the existing document-review workflow; EH-122 establishes the first focused capability specification for this additive workflow.

## Impact

- **Domain:** `documents`.
- **UI:** `src/components/documents/document-viewer.tsx` and review-row/list components receive batch-eligibility state, selection controls, confirmation UI, outcome feedback, and undo entry points.
- **Server:** a new document-scoped route and pure policy/service modules will reuse `writeExtractedBiomarkerNormalization`, `getActiveNormalizationRevision`, document ownership checks, and the existing error contract.
- **Database:** an additive migration persists batch request/idempotency and row outcome metadata only if required for durable retry and reversal binding; normalization revisions and `observation_change_events` remain the sole sources of verification and audit truth.
- **Safety:** no new observation writer; no verified concrete measurement for incomplete resolver outcomes; no raw source text duplicated in batch metadata or audit records.
- **Verification:** pure-policy, API/service, database, regression, and manual QA coverage will be added under the existing project conventions.