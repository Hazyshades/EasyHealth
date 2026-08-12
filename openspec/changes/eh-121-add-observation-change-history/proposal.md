# Add observation change history

## Why

Every observation in EasyHealth already carries a lineage, but nobody can read
it. `observation_normalization_revisions` is append-only and records the actor,
the correction reason, the superseded revision, the verification status and the
catalog/resolver versions for each decision. `document_extracted_biomarkers`
records supersession when a document is reprocessed.
`registry_reprocess_batch_rows` records a full before/after diff for every row a
registry reprocess touched. Three append-only stores, three different shapes,
no shared ordering, and no reader.

The consequence is that the review workspace can only offer the EH-117
"Restore <key>" buttons built from the active row's revision list. A user cannot
see that a value was corrected last week and by whom, a support engineer cannot
answer "what changed and why" without a service-role SQL session, and a
reprocess that silently re-mapped a measurement leaves no user-visible trace at
all.

EH-121 does not need new facts. It needs one canonical, append-only,
ordered event schema over the facts that already exist, a reader for it, and a
compact place to show it.

## What Changes

- Add the `observation_change_events` append-only audit ledger: one row per
  auditable change to an observation's mapping, verification state, or source
  extraction, carrying `event_kind`, subject identifiers, before/after columns,
  actor identity, and the catalog/resolver/extraction versions in force.
- Populate the ledger exclusively from database triggers on the existing
  append-only stores (`observation_normalization_revisions`,
  `document_extracted_biomarkers`, `registry_reprocess_batch_rows`). No
  application code writes audit rows, so no write path can bypass the audit and
  no second observation writer is introduced.
- Backfill the ledger from those same stores inside the migration, so history is
  complete for documents processed before EH-121 instead of starting empty.
- Enforce append-only at three levels: a `BEFORE UPDATE OR DELETE` trigger,
  `revoke update, delete` from every role including `service_role`, and CHECK
  constraints that keep the diff columns to identifiers, enum values, hashes and
  version strings.
- **BREAKING** for audit consumers: `resolver_decision_trace` and raw document
  text are deliberately absent from the ledger. A history entry references the
  revision that holds the trace; it never copies raw labels, raw values,
  reference text or source text.
- Add the change-history read model: a pure projection module that turns ledger
  rows into ordered, human-readable entries with a typed before/after field
  diff, an actor label, and version metadata.
- Add `GET /api/documents/[id]/observation-history`, filterable by observation
  or extracted row, bounded by an explicit `limit`, returning the projected
  entries newest first.
- Render a compact, collapsed-by-default history panel inside the review
  workspace technical details, wired into both the extracted-review and the
  observations-fallback branches.

## Capabilities

### New Capabilities

- `observation-change-history`: the append-only audit event schema for
  observation corrections, verification transitions and reprocessing results,
  its redaction boundary, its read model, and its user-facing surface.

### Modified Capabilities

- None. EH-121 reads stores that EH-104, EH-106, EH-115 and EH-116 already
  define and does not change their requirements.

## Impact

- Affected domains: `documents` (review workspace, observation APIs),
  `health-profile` (observation lineage reads).
- Affected code: `src/lib/documents/observation-change-history.ts` (new),
  `src/lib/documents/observation-change-events.ts` (new reader),
  `src/app/api/documents/[id]/observation-history/route.ts` (new),
  `src/components/documents/review/observation-change-history-panel.tsx` (new),
  `src/components/documents/review/observation-review-row.tsx`,
  `src/components/documents/document-viewer.tsx`,
  `scripts/verify-eh121-observation-change-history.ts` (new).
- Affected data and operations: migration
  `051_eh121_observation_change_history.sql` adds the
  `observation_change_event_kind` enum, the `observation_change_events` table
  with RLS and service-role-only `select, insert`, the three source triggers,
  the append-only guard, and the historical backfill. The table is
  `on delete cascade` from `documents` so that
  `purge_document_derived_laboratory_lineage` keeps working unchanged.
- Dependencies: EH-119 (edit and correction flow) and EH-120 (verification
  transition state machine) are open and unimplemented. EH-121 therefore audits
  the correction and verification events that exist today — writer corrections,
  undo/reversal, confirmation, acceptance, and reprocess supersession — and
  defines the event schema so that EH-119 and EH-120 produce audited events
  without further schema work, because their writes flow through the same
  revision store the triggers observe.
