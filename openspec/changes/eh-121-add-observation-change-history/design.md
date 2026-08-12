# Design: add observation change history

## Context

Three append-only stores already record everything EH-121 must show.

| Store | What it proves | Gap |
| --- | --- | --- |
| `observation_normalization_revisions` (020, 021, 031, 033, 039) | Every acceptance, correction, undo and verification decision, with actor, reason, superseded revision and version metadata | Chained by `supersedes_revision_id`, never read as a timeline; `observation_id` is only set at promotion |
| `document_extracted_biomarkers.is_current` / `superseded_at` (022) | A reprocess retired the extracted row an observation was read from | Old and new extracted rows are not linked, so the retirement is invisible downstream |
| `registry_reprocess_batch_rows` (041) | A full prior/next diff for every row a registry reprocess considered and applied | Service-role CLI only, keyed by extracted row, never surfaced |

They disagree on shape, on key, and on ordering. The review workspace therefore
exposes nothing but the EH-117 "Restore <key>" buttons, which are built from the
active row's raw revision list and say neither who changed a mapping nor why.

Two hard constraints shape the solution. First, EasyHealth has exactly one
observation write path — `write_observation_normalization_revision_v2` wrapping
`..._v2_legacy` wrapping `promote_observation_normalization_revision_v2` — and
migration 046 states in its header that new work patches the delegate and never
the EH-115 wrapper. A second observation writer is not acceptable. Second,
`resolver_decision_trace` carries the comment "never contains raw source
content" and `registry_reprocess_batch_rows` stores 64-hex hashes instead of
text; EH-121's acceptance criterion repeats that boundary.

EH-119 (edit and correction flow) and EH-120 (verification transition state
machine) are still open. EH-121 audits the events that exist today and defines
the schema so those changes need no audit work of their own.

## Goals / Non-Goals

**Goals:**

- One canonical, ordered, append-only event schema covering mapping
  corrections, verification transitions, reversals, acceptances, extraction
  supersession and applied reprocess results.
- Complete history for documents that were processed before EH-121, not an
  empty ledger that only fills going forward.
- A before/after diff a support engineer can read without a SQL session, and
  the catalog/resolver/extraction versions in force at the time of the change.
- A history endpoint scoped to a document, filterable to one observation or one
  extracted row.
- A compact, collapsed-by-default panel in the review workspace, on both the
  extracted-review and the observations-fallback branch.
- Zero new observation writers and zero changes to the EH-115 wrapper.

**Non-Goals:**

- Auditing document-level lifecycle (upload, delete, reprocess *request*).
  EH-121 audits what happened to observations, not to documents.
- Copying `resolver_decision_trace` into the ledger. An entry references the
  revision that owns the trace; EH-115 already guarantees the trace is
  immutable and redacted.
- A support-facing admin console. The endpoint is profile-scoped and the UI is
  the user's own review workspace.
- Cursor pagination. The repository has no cursor convention; the endpoint
  takes an explicit bounded `limit`.
- Implementing EH-119 or EH-120 behaviour.

## Decisions

### 1. A materialized ledger, not a SQL view over the three stores

A `union all` view is tempting: nothing is duplicated and append-only holds by
construction. It fails on the third store. When a reprocess retires an
extracted row, nothing links the retired row to its replacement, so a view can
show "a revision existed" and "a revision exists" but never "this observation
was reprocessed". A view also has no stable per-event identity, which a support
engineer needs to quote, and it must re-derive each event's predecessor with a
window function on every read.

`public.observation_change_events` is therefore a real table: one row per
auditable change, with its own `id`, its own `occurred_at`, and explicit
`prior_*` / `next_*` columns.

*Alternative rejected:* a `union all` view, because it cannot express extraction
supersession, has no stable event identity, and pushes diff derivation into
every reader.

### 2. Database triggers on the source stores are the only writer

The ledger is populated by three `after` triggers:

| Trigger | Source | Fires when | Event kinds |
| --- | --- | --- | --- |
| `eh121_capture_revision_change` | `observation_normalization_revisions` | a revision is inserted active, or becomes active | `observation_accepted`, `mapping_corrected`, `correction_reverted`, `verification_changed` |
| `eh121_capture_extraction_supersession` | `document_extracted_biomarkers` | `is_current` flips true → false | `extraction_superseded` |
| `eh121_capture_reprocess_apply` | `registry_reprocess_batch_rows` | `apply_state` becomes `applied` | `reprocess_applied` |

No TypeScript writes audit rows. Every existing and future write path — the
EH-106 writer, the EH-116 apply loop, the worker pipeline, whatever EH-119 and
EH-120 add — is audited automatically and in the same transaction as the change
it records, so an audit row cannot exist without its change and a change cannot
commit without its audit row.

*Alternative rejected:* emitting events from `..._v2_legacy` or from the API
routes, because it leaves the worker's supersession path and the CLI apply path
unaudited and re-opens the "second writer" hazard the repository has spent
EH-106 and EH-116 closing.

### 3. Revision events are captured at promotion, deduplicated by revision id

The EH-106 writer inserts a revision with `is_active = false` and `observation_id`
null, then `promote_observation_normalization_revision_v2` flips `is_active`,
binds `observation_id`, and stamps `promoted_at` / `promoted_by`. Capturing on
insert would record an event with no observation. Capturing only on update would
miss any path that inserts an already-active row.

The trigger therefore fires `after insert or update` on
`observation_normalization_revisions`, acts only when the row is active, and
inserts with `on conflict do nothing` against a partial unique index on
`source_revision_id`. Exactly one event per revision, whichever way the revision
became active. The writer's idempotent replay path — which reuses an existing
revision and returns early from `promote` without an `update` — produces no
second event.

*Alternative rejected:* an `after insert` trigger plus a later `update` to fill
`observation_id`, because the ledger must be append-only and cannot be updated.

### 4. `event_kind` is a headline; the diff is always complete

A manual correction is simultaneously a mapping change and a verification
transition to `manually_corrected`. Splitting it into two rows would double the
timeline; picking one kind and dropping the other half of the diff would hide
it.

Every event carries the full pair of diffs — `prior_measurement_definition_key`
/ `next_measurement_definition_key`, `prior_analyte_key` / `next_analyte_key`,
`prior_resolver_result` / `next_resolver_result`, `prior_verification_status` /
`next_verification_status`, `prior_mapping_confidence_band` /
`next_mapping_confidence_band` — regardless of kind. `event_kind` only decides
the headline, resolved in this precedence: `correction_reverted` when the
revision names a `reversal_of_revision_id`, else `mapping_corrected` when the
definition or analyte key changed, else `observation_accepted` when there was no
prior revision, else `verification_changed`.

*Alternative rejected:* one event per changed axis, because a single user action
would produce three rows with the same timestamp and the same reason.

### 5. Identifiers, enums, hashes and versions only — never text from the document

The ledger columns are: subject ids (`profile_id`, `document_id`,
`observation_id`, `extracted_biomarker_id`), source ids (`source_revision_id`,
`source_prior_revision_id`, `source_extracted_biomarker_id`,
`source_reprocess_row_id`), enum-checked state (`resolver_result`,
`verification_status`, `mapping_confidence_band`, `mapping_change_classification`),
64-hex evidence hashes, version strings (`catalog_manifest_version`,
`catalog_manifest_digest`, `resolver_version`, `normalization_version`,
`extraction_version`), actor (`actor_type`, `actor_id`) and `correction_reason`.

`correction_reason` is the one free-text column, and it is operator-authored
review text, never document content — the same field
`observation_normalization_revisions.correction_reason` already stores. Raw
labels, raw values, reference text, source text and `resolver_decision_trace`
are absent, and the hash columns carry `~ '^[0-9a-f]{64}$'` CHECKs that make
"this is a hash, not a value" enforceable rather than conventional.

*Alternative rejected:* a `payload jsonb` column, because it makes the redaction
boundary unenforceable and the diff unqueryable.

### 6. Append-only is enforced three ways

`revoke all ... from public, anon, authenticated` and `grant select, insert to
service_role` — no role holds `update` or `delete`. A
`before update or delete` trigger raises
`observation_change_events_append_only`, so even a superuser session or a future
`grant` cannot silently rewrite history. `on delete cascade` from `documents`
and `profiles` keeps deletion tied to erasing the subject, which is what
`purge_document_derived_laboratory_lineage` (034) already does; the trigger
allows cascaded deletes exactly the way EH-116 allows the parent-batch cascade.

*Alternative rejected:* `on delete restrict`, because it would break the
existing document deletion and lineage purge paths that EH-104 Phase B made
load-bearing.

### 7. The migration backfills history from the same three stores

An empty ledger would make every pre-EH-121 document look untouched, which is
worse than no history: it asserts that nothing happened. The migration
therefore replays, in one statement per source:

1. every active and superseded revision, ordered by `created_at`, joined to its
   `supersedes_revision_id` predecessor for the diff;
2. every extracted row with `is_current = false and superseded_at is not null`;
3. every `registry_reprocess_batch_rows` row in `apply_state = 'applied'`.

Backfilled rows are flagged `origin = 'backfill'` so an auditor can tell a row
that was captured live from one that was reconstructed. Reconstructed rows use
the source row's own timestamp as `occurred_at`, so ordering stays truthful.

*Alternative rejected:* starting empty, because the acceptance criterion is that
users and support can see what changed, and the corrections that most need
explaining already happened.

### 8. One document-scoped endpoint with explicit filters

`GET /api/documents/[id]/observation-history` follows the house route shape:
`getSessionProfileId()` → 401, `assertDocumentOwner()` → 404, `createAdminClient()`
for data, `noStoreJson` on success, `{ error }` on failure. Query parameters:
`observationId`, `extractedBiomarkerId`, and `limit` (default 200, maximum 500,
rejected as 400 when not a positive integer). Entries are returned newest first.

A per-observation route was rejected: the review workspace renders many rows at
once and would issue one request per row, and pre-promotion events have no
`observation_id` to route on.

*Alternative rejected:* cursor pagination, because the repository has no cursor
convention anywhere and a bounded `limit` covers a single document's history.

### 9. The projection is a pure module, the UI is a slot

`src/lib/documents/observation-change-history.ts` holds types and pure
functions: it turns a ledger row into an `ObservationChangeEntry` with a
`headline`, a typed `fields: ObservationChangeFieldDiff[]` list of the axes that
actually changed, an `actorLabel`, a `reason`, and `versions`. Being pure, it is
covered by `scripts/verify-eh121-observation-change-history.ts` with no test
runner, exactly like the EH-117 workspace model.

`ObservationReviewRow` gains a `history?: ReactNode` slot rendered after
`technicalDetails`, and `DocumentViewer` passes
`<ObservationChangeHistoryPanel …>` on both the `extracted-review` and the
`observations-fallback` branch. The panel is a collapsed `<details>` showing the
entry count, because the review list is a 60vh scroll container and must stay
compact.

*Alternative rejected:* rendering history inside `ReviewTechnicalDetails`'s
existing `children`, because that slot already carries the manual-mapping select
and the Restore buttons, and the fallback branch does not pass children at all.

## Risks / Trade-offs

- **A trigger on the hot write path adds latency to every acceptance.** → The
  trigger is a single `insert … on conflict do nothing` with one indexed lookup
  of the predecessor revision, on a table that is written once per reviewed row.
- **The ledger denormalizes state that also lives on the revision, so the two
  could disagree.** → Nothing may update the ledger, and the values are copied
  from `new`/`old` inside the same transaction, so a disagreement can only mean
  the revision was mutated — which EH-104 Phase B already forbids.
- **The backfill reconstructs `verification_changed` events that were never
  observed as transitions.** → Reconstructed rows are marked
  `origin = 'backfill'`, the read model labels them accordingly, and the QA
  checklist states the limitation instead of claiming live capture.
- **`correction_reason` is free text and could be misused to paste document
  content.** → It is already stored on the revision, so EH-121 duplicates no new
  text; the redaction requirement is recorded in the spec so a future
  free-text field is a spec violation rather than an oversight.
- **EH-119 and EH-120 may introduce state axes this schema does not carry.** →
  Both write through the revision store the trigger observes, so new rows are
  audited automatically; only a genuinely new axis needs a column, and the spec
  records the extension point.

## Migration Plan

1. Apply `048_eh121_observation_change_history.sql`: enum, table, indexes, RLS,
   grants, append-only guard, three capture triggers, backfill.
2. Deploy the reader, the endpoint and the UI. Both are additive; no existing
   response shape changes.
3. Verify with `pnpm test:eh121` (projection and seams) and
   `pnpm test:eh121-db` (grants, append-only, trigger capture, redaction).
4. No rollback data loss risk: dropping the triggers and the table removes only
   derived rows, and the backfill can regenerate them from the untouched source
   stores.

## Open Questions

No implementation-blocking questions remain.
