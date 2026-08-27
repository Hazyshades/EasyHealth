## Why

The papercut ledger and existing product issue #127 identify a cluster of user-visible failures at the Health Profile/document-review boundary. Reported laboratory values can look absent from the profile even when the uploaded document was processed; extraction prompts can promise context that is not persisted; the review workspace once crashed when batch hooks were evaluated after an early return; batch verification once failed before mutation because a required aggregate state was omitted; and unknown-date drawer copy can repeat the same explanation.

The change complements, rather than duplicates, the existing recovery work in #111 (`add-reviewed-panel-specimen-policy`) and #127. It does not infer clinical identity, alter scoring formulas, or turn a historical incident into a new acceptance path.

## Evidence from `.papercuts.jsonl`

The proposal is grounded in these repository ledger records:

- `pc_65443ff19b23` (`2026-08-06`, `prompts`): `extraction.ts` promised section-heading evidence while the worker persisted `section_context` as `null`, so heading-derived specimen evidence was discarded without a shared contract check.
- `pc_33a58c326255` (`2026-08-13`, `testing`): `DocumentViewer` placed `batchEligibleIds`/`batchExclusionsById` hooks after loading/error returns and crashed with a Rules of Hooks violation after bootstrap.
- `pc_66b71dacfbf0` (`2026-08-13`, `testing`): the EH-122 batch endpoint reached the operation insert and failed on `NOT NULL aggregate_status`, so batch mutation never started.
- `pc_6f2bb4dffb32` (`2026-08-24`, `ui`): the Health Profile drawer rendered `Observed date unavailable` twice for an `unknown-date` marker.

The reported-results product gap is tracked by the existing matching issue [#127](https://github.com/Hazyshades/EasyHealth/issues/127), whose acceptance criteria supply the user-facing count, review, and exclusion requirements. The `pc_656c41a39cd9` EH-141 readiness mismatch is intentionally not re-scoped here: readiness-group/catalog correctness remains governed by EH-141 and its release evidence. Environment, tooling, and test-fixture papercuts are evidence constraints, not product behavior in this change.

## What Changes

- Add an explicit Health Profile state for a processed document that contains reported laboratory results but has no score-eligible observations. Show reported, ready-for-scoring, document-detail, and catalog-review counts separately from the numeric assessment state.
- Add a safe entry point from Health Profile and the dashboard to review the preserved reported results. Keep source label, value, unit, reference range, date, page/source evidence, and one actionable non-score reason visible without presenting an unresolved candidate as a confirmed measurement.
- Keep the no-document, processing, reported-but-not-scoreable, and score-available dashboard states distinct. Do not tell a user to upload a lab when an existing document was processed and produced unresolved results; a clearer-report action remains factual and non-clinical.
- Establish an extraction evidence seam check: every context field promised by the extraction contract must be persisted into the row provenance consumed by resolution. Section headings remain verbatim captured evidence; this change does not infer a specimen from a heading. Reviewed panel policies remain governed by #111 and their own release approval.
- Preserve the hook-order invariant in `DocumentViewer`: batch-derived hooks must be evaluated in a stable order across loading, error, empty, and loaded states. Add a regression guard for the previously observed Rules of Hooks crash.
- Preserve the batch-operation invariant: a new operation records its executing aggregate state before row processing, and an initialization failure cannot partially verify rows. Keep the existing idempotency, eligibility re-check, and conflict behavior.
- Ensure unknown-date UI copy has one state label and one factual date-unavailability explanation; do not render the same `Observed date unavailable` message twice in one marker detail view.
- Keep incomplete, ambiguous, unmapped, unverified, stale, and unknown-date results excluded from scores, trends, conversions, reports, and assessment calculations. No new database migration or scoring formula is implied by this proposal.

## Capabilities

### New Capabilities

- `health-profile-reported-results`: User-facing Health Profile and dashboard states for reported laboratory results that are preserved but not yet ready for scoring, including counts, source review navigation, safe reasons, and non-scoreable empty-state copy.

### Modified Capabilities

- `incomplete-laboratory-outcomes`: Extend the existing raw-result contract through the Health Profile recovery entry point and require status/reason presentation without replacing reported evidence with an inferred identity.
- `health-profile-score-readiness`: Distinguish no reported results from reported-but-unscoreable results while retaining the existing reviewed-binding and complete-required-group admission boundary.
