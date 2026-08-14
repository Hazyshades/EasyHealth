## Context

EH-117 introduced a unified document-review rail and bulk selected-row acceptance. Its current `applyExtractedSelection` preselects every `needs_review` or `pending_review` extracted row, and `POST /api/documents/[id]/biomarkers/accept` calls the existing normalization writer independently for each submitted row. A resolved row becomes `user_verified`; a partial, ambiguous, or unmapped row is retained with `pending` verification. This is safe at the persistence boundary but is not the EH-122 workflow: the selection contains rows that are explicitly outside the low-risk exact-match cohort, there is no pre-write explanation of exclusions, no confirmation summary, no operation identity, and no batch-level reversal.

The relevant prior work is already delivered:

- EH-104 supplies resolver/verification separation, verified-row guards, actor metadata, and source-safe promotion.
- EH-109/110/112/113 supply reviewed alias authority, decision traces, confidence bands, incomplete-outcome rules, and stated-evidence constraints.
- EH-117 provides the shared review row and raw-acceptance UI; it must not lose the partial/raw path.
- EH-118 supplies source-region provenance; migration 052 fixed the writer's SQL-NULL handling for page-only evidence.
- EH-119 supplies append-only value/mapping correction and individual reversal primitives.
- EH-121 records every promoted normalization revision in an append-only, trigger-backed change ledger.

The Registry 2.0 canonical docs state that a resolved observation is eligible only with a concrete reviewed compatible binding; partial, ambiguous, and unmapped observations are not eligible. The Wiki is generated and non-authoritative; repository docs remain the reference.

## Goals / Non-Goals

**Goals:**

- Give a reviewer a truthful low-risk batch-verification action for only exact, high-confidence, reviewed, unresolved human-decision-free laboratory matches.
- Evaluate eligibility in one pure policy and re-evaluate it on the server immediately before every write.
- Make every non-eligible row visible with a stable reason, and make every proposed write visible in an explicit confirmation summary.
- Make retries idempotent, isolate per-row concurrent/stale failures, and never turn a partial aggregate result into an all-or-nothing fiction.
- Link successful rows to one durable operation and reverse only those rows that still have that operation's active verification revision, using append-only revisions and EH-121 audit capture.

**Non-Goals:**

- Changing resolver scoring, confidence thresholds, alias governance, evidence matching, or reviewed-definition approval.
- Automatically verifying any row. `auto_verified` remains outside EH-122.
- Batch correcting values/mappings, batch raw acceptance, batch rejection, or reprocessing. They remain individual workflows or future EH-120 scope.
- Including partial, ambiguous, unmapped, provisional, fuzzy/normalized/OCR/token-set matches, rows missing a concrete reviewed definition, edited rows, or manual decisions in batch verification.
- Creating another observation writer, writing audit rows from TypeScript, duplicating raw document content, or weakening EH-104 source ownership/CAS constraints.

## Decisions

### 1. Eligibility is an allow-list derived from canonical resolver evidence

A row is batch-eligible only when all conditions hold at evaluation time:

1. it belongs to the current document/profile, is source-current, and has a reviewable extraction status;
2. the canonical resolver, run against its current raw source evidence and any effective override, returns `resolved` with one concrete Registry 2.0 definition whose maturity and clinical compatibility are reviewed;
3. it has no missing or conflicting axes on the winning candidate; the exact reviewed alias plus complete compatible evidence is the EH-122 high-confidence definition, independent of the resolver's generic `mappingConfidenceBand`;
4. its winning accepted resolver candidate uses an active, reviewed-resolution alias with `aliasMatchType = exact`, without a fold fallback;
5. it has no measurement override, no `user_verified` or `manually_corrected` active decision, and no active revision owned by a human correction/reversal; and
6. its source row and active revision snapshot still match the request snapshot when the writer is invoked.

Rows awaiting their first review have no normalization revision, so they cannot have a persisted resolver trace. The policy therefore evaluates the deterministic resolver preview from the current source row and catalog release; the existing writer persists the canonical trace atomically only when verification succeeds. Existing active revisions are checked for protected human decisions and, if they are otherwise eligible in a future state, their persisted trace is validated rather than trusting a client payload.

The exact alias and candidate authority come from canonical resolver candidate evidence, not the display label, a client flag, or a score alone. The current resolver scoring model cannot produce `high` for a standard exact match: its theoretical maximum is 83 while the high threshold is 85. EH-122 therefore defines high confidence as the narrower, auditable exact-evidence allow-list above, rather than treating a generic confidence band as an eligibility proxy. The policy returns every failed predicate as a stable reason code, so the UI and API never implement parallel eligibility logic.

*Alternative rejected:* permit high-confidence normalized or OCR matches. They may be appropriate for individual review, but the roadmap says low-risk exact matches and the batch path must be narrower than ordinary acceptance.

### 2. The existing generic bulk acceptance becomes a separate, explicit workflow

`Accept selected` currently supports retaining raw incomplete outcomes. EH-122 must not silently redefine that action as verification. The UI instead offers **Verify eligible matches** only when the document contains eligible rows; its default selection is the eligible cohort, not all reviewable rows. Incomplete rows retain their existing checkbox/raw-acceptance path or individual handling but never appear in the verification selection.

The confirmation dialog reports:

- selected rows to be verified;
- eligible rows intentionally deselected;
- excluded rows grouped by reason, with user-facing copy that names the safe next action; and
- the fact that each selected row will be recorded as verified by the current user and can be undone only while unchanged.

The client may render a preview from the bootstrap payload, but confirmation receives a server-produced eligibility summary so it cannot overstate what will execute.

*Alternative rejected:* retain generic selection and only filter on submit. That creates a misleading action, hides exclusions until after a write attempt, and fails the issue acceptance criterion.

### 3. A dedicated document-scoped batch service owns idempotency and aggregate results

A `POST /api/documents/[id]/biomarkers/batch-verification` contract accepts a client-generated operation id, a unique selected extracted-row-id set, and expected active-revision/source snapshots. It follows the house route boundary: `getSessionProfileId`, `assertDocumentOwner`, service-role client, and no-store response.

The service deduplicates ids, validates ownership/source-current state, reevaluates eligibility, then processes each still-eligible row through `writeExtractedBiomarkerNormalization`. Each row receives a deterministic request hash derived from the operation id and row id, preserving existing writer idempotency. A stale/missing/ineligible row receives a per-row outcome and cannot block independent siblings. The response supplies an aggregate status of `completed`, `partially_completed`, `no_op`, or `failed`, plus counts and reason-coded row outcomes.

A durable operation and operation-row record store only identifiers, eligibility/outcome codes, expected and resulting revision ids, actor/time, and request hashes. They do not replicate raw labels, values, source text, decision traces, or PHI. A unique `(profile_id, operation_id)` binding makes same-actor retries replay the stored outcome; conflicting payload reuse fails deterministically.

*Alternative rejected:* use the existing accept endpoint with a boolean mode. Its open `ids` contract cannot prove the requested operation, persist retry outcomes, or support a batch undo binding without coupling unrelated raw-acceptance behavior to EH-122.

### 4. Batch verification uses a distinct append-only verification-reversal transition

Each batch row records the prior active revision (or explicit no-prior snapshot) and resulting verification revision. Undo is an operation-level request, not a deletion or an update. It can act only where the batch's resulting revision is still active; other rows are returned as `changed_since_batch` and remain untouched.

For every reversible row the normalization writer receives a new explicit `verification_reversal` write kind. The database delegate creates a successor revision that preserves the original resolved identity and source evidence but moves verification to `pending`, stamps the user actor/time and reversal reason, supersedes the batch revision, and references it through `reversal_of_revision_id`. If an implementation encounters a first-promotion case that cannot preserve an observation without an active revision, it must define the transition in the writer/migration before exposing undo; it must not delete the observation or revise historical rows.

EH-121's existing promotion trigger captures both verification and reversal events. The batch tables are operation metadata only; `observation_normalization_revisions` and `observation_change_events` remain audit truth.

*Alternative rejected:* undo by restoring/deleting prior data directly. That violates append-only audit semantics and fails under concurrent individual corrections.

### 5. Eligibility is recalculated at three boundaries

The pure policy runs for bootstrap projection, confirmation-summary computation, and transaction-adjacent execution. The last evaluation uses the selected source row, active revision, decision trace, and reviewed catalog snapshot; it is combined with the writer's existing compare-and-swap and source ownership constraints. The server response may therefore show that a row became ineligible after the dialog opened. That is a normal partial outcome, not a retryable silent success.

*Alternative rejected:* evaluate only in the browser. Resolver state, revisions, reprocessing, and corrections may change while the reviewer reads the dialog.

## Risks / Trade-offs

- **No persisted trace exists before first verification.** This is expected for pending-review rows. The server recomputes the deterministic canonical resolver preview from the current source evidence and persists it only through the successful writer transaction; it never treats an untrusted client trace as evidence.
- **Per-row writer transactions can yield partial completion.** This preserves the existing writer's independent CAS behavior. The UI must show precise counts and per-row causes rather than one binary success toast.
- **Batch tables add metadata to a sensitive flow.** They contain ids, state codes, timestamps, hashes, and revision links only; RLS/service grants mirror the relevant document lineage constraints.
- **A reversal of a newly created observation requires a durable pending state.** The migration/RPC contract must make this legal before the UI exposes the button. No destructive fallback is allowed.
- **The document viewer is already large.** Keep policy, summary projection, service orchestration, and modal presentation in focused modules; `DocumentViewer` owns orchestration only.
- **Manual UI testing is currently unavailable on this Windows workspace.** QA must explicitly retain the authenticated-environment prerequisite instead of claiming local UI completion.

## Migration Plan

1. Add pure eligibility/summary types and regression fixtures using exact, normalized, OCR/fuzzy, partial, edited, stale, and previously verified cases.
2. Add additive batch operation/row persistence, RLS/grants, idempotency constraints, and the writer/database `verification_reversal` contract. Verify its append-only/EH-121 capture behavior with pgTAP.
3. Add the batch service and document-scoped endpoints; retain the generic acceptance route unchanged for raw acceptance.
4. Add selection, exclusion explanation, confirmation, result, and undo UI in the review workspace.
5. Add API/service/database regression coverage and `QA/eh-122/checklist.md`; run focused suites and an authenticated manual review when that environment is available.

Rollback removes the additive routes/UI and operation tables. It must never delete normalization revisions or change-history events created by an executed batch; those are historical evidence.

## Open Questions

No product decision blocks the proposal. Implementation must confirm whether a first accepted resolved row already has a pre-verification revision available; if not, the `verification_reversal` migration defines the pending-successor transition before batch undo ships.