# EH-121: See what changed on a result and why

**Roadmap status:** In progress  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

Every reviewable result in a document now carries a **Change history** list.
It records when the result was accepted, when its measurement mapping was
corrected or restored, when its verification state moved, and when reprocessing
replaced the extraction it was read from. Each entry names the previous and the
new value, who made the change, when, and the reason if one was recorded.

The list is collapsed until you open it, and it is read-only: nothing in the
product edits or removes an entry. History that existed before this release was
reconstructed from existing records and is labelled `reconstructed`.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check
  intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH121-DOC-01` | A synthetic lab report with at least three recognized results, freshly uploaded and processed on this build | Normal path: acceptance, correction, restore |
| `EH121-DOC-02` | A synthetic lab report with at least one result the system could not fully identify (shown as ambiguous or not recognized) | A row whose only history is its acceptance |
| `EH121-DOC-03` | A synthetic lab report that was uploaded and reviewed **before** this build was deployed and already has a manual correction on it | Reconstructed history |
| `EH121-DOC-04` | Any synthetic lab report you are willing to reprocess | Reprocessing appears in history |

## Interface checks

### EH121-UI-01: A newly accepted result shows its acceptance

**Precondition:** `EH121-DOC-01` has finished processing and no result has been
accepted yet.

1. Go to **Documents** and open `EH121-DOC-01`.
2. In the review list on the right, tick one recognized result and click
   **Accept**.
3. On that same result, open **Change history**.

**Expected result:** The list opens with one entry, **Result accepted**,
attributed to **You** with today's date and time. It lists the measurement,
analyte, recognition outcome, verification and mapping confidence it was
accepted with, each shown as `not set → <value>`. No raw text from the document
is repeated inside the history entry.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH121-UI-02: A mapping correction is recorded with its reason

**Precondition:** `EH121-DOC-01`, a result accepted in EH121-UI-01 that offers
alternative mappings under **Technical details**.

1. Open the result's **Technical details**.
2. Choose a different measurement from the dropdown and click **Use mapping**.
3. Wait for the page to refresh, then open **Change history** on that result.

**Expected result:** A new entry appears above the acceptance,
**Measurement mapping corrected**, attributed to **You**. It shows
`Measurement: <previous> → <new>` and the verification transition to
**Corrected by you**. The counter next to **Change history** now reads `(2)`.
The acceptance entry is still present and unchanged.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH121-UI-03: Restoring a previous mapping is recorded as a reversal

**Precondition:** The corrected result from EH121-UI-02, which now offers a
**Restore …** button under **Technical details**.

1. Open the result's **Technical details**.
2. Click **Restore <previous measurement>**.
3. Wait for the page to refresh, then open **Change history**.

**Expected result:** A third entry appears, **Correction reverted**, attributed
to **You**, showing the measurement moving back to the previous value. The two
earlier entries are unchanged and still in order, newest first.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH121-UI-04: A result with no changes says so

**Precondition:** `EH121-DOC-02` has finished processing and contains a result
that was never accepted or corrected.

1. Go to **Documents** and open `EH121-DOC-02`.
2. Find a result that has not been accepted.

**Expected result:** Under that result the text reads
**No changes recorded for this result yet.** There is no empty expandable
control and no error.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH121-UI-05: History stays compact

**Precondition:** `EH121-DOC-01` after EH121-UI-03, so at least one result has
three entries.

1. Open `EH121-DOC-01`.
2. Scroll the review list without opening anything.

**Expected result:** Every result shows only the single line
**Change history (n)**. No entries are visible until you click that line, and
the review list scrolls the same way it did before this release.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH121-UI-06: History from before this release is shown and labelled

**Precondition:** `EH121-DOC-03` — a document corrected before this build was
deployed. If no such document exists in the environment, mark this check
`Blocked` and say so; do not create one by correcting a result today.

1. Open `EH121-DOC-03`.
2. Open **Change history** on the result that was corrected earlier.

**Expected result:** The earlier correction is listed with its previous and new
measurement, and the entry is marked `reconstructed`. The timestamp is the date
of the original correction, not today.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH121-UI-07: Reprocessing appears in history

**Precondition:** `EH121-DOC-04` has finished processing and has at least one
accepted result.

1. Open `EH121-DOC-04`.
2. Click **Reprocess document** and wait for processing to finish.
3. Open **Change history** on a result that existed before the reprocess.

**Expected result:** An entry **Source extraction replaced by reprocessing**
is present, attributed to **Automatic**, timestamped at the reprocess. Entries
recorded before the reprocess are still listed.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH121-UI-08: History belongs to its own account

**Precondition:** A second dedicated test account with its own synthetic
document.

1. Sign in as the second account.
2. Open that account's own document and confirm its **Change history** shows
   only its own entries.
3. Sign out and back in as the first account, reopen `EH121-DOC-01`, and
   confirm the second account's changes never appear.

**Expected result:** Neither account sees the other's history, and no entry is
attributed to the wrong person. An entry made by someone other than the signed
in user would read **Another reviewer**, never **You**.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

These contracts cannot be proven through the product interface. Backend
supplies the evidence.

- [ ] **Append-only storage.** `pnpm test:eh121-db`
  (`supabase/tests/eh121_observation_change_history.sql`) asserts that
  `service_role` holds only `select` and `insert`, that `anon` and
  `authenticated` hold nothing, that row level security is on, and that a
  direct `update` or `delete` on a stored event is rejected with
  `observation_change_events_append_only`.
- [ ] **Capture cannot be bypassed.** The same suite drives the real
  `write_observation_normalization_revision_v2` writer and asserts that the
  acceptance and the correction each append exactly one event bound to the
  promoted observation, and that a replayed write appends none.
- [ ] **Event classification.** The same suite asserts the precedence:
  reversal, then acceptance, then mapping change, then verification change,
  and that a correction records both the mapping and the verification
  transition on one event.
- [ ] **No duplicated raw document text.** `pnpm test:eh121` asserts the ledger
  DDL declares no `raw_name`, `raw_value_text`, `raw_reference_text`,
  `raw_unit`, `source_text`, `bounding_box`, `resolver_evidence` or
  `resolver_decision_trace` column, and that the API reader selects none of
  them. The DB suite asserts that a value that is not a 64-character hex hash
  cannot be stored in an evidence column.
- [ ] **Erasure still works.** The DB suite asserts that
  `purge_document_derived_laboratory_lineage` and a plain document delete both
  remove the document's history without tripping the append-only guard.
- [ ] **Backfill.** Migration
  `supabase/migrations/048_eh121_observation_change_history.sql` reconstructs
  events from `observation_normalization_revisions`, superseded
  `document_extracted_biomarkers`, and applied
  `registry_reprocess_batch_rows`, stamping `origin = 'backfill'` and the
  source row's own timestamp. Confirm the post-deploy row count against the
  source stores; EH121-UI-06 depends on this having run.
- [ ] **Endpoint contract.** `pnpm test:eh121` asserts
  `GET /api/documents/[id]/observation-history` requires a session, answers
  not found for a document the caller does not own, and rejects a `limit`
  outside 1–500 instead of clamping it.
- [ ] **Read model.** `pnpm test:eh121` covers the complete before/after diff,
  actor labelling (`You` / `Another reviewer` / `Automatic`), version metadata,
  newest-first ordering, and the indexing that lets one document request serve
  every review row.
- [ ] **Render evidence.** `pnpm smoke:eh121-history-panel <events.json>`
  renders the real panel from real ledger rows; attach the produced HTML when
  the interface checks above cannot be run in an environment.

## Automated regression coverage (2026-08-10)

| EH-121 contract | Automated evidence |
| --- | --- |
| Every auditable change is captured, in the same transaction, from the append-only source | `supabase/tests/eh121_observation_change_history.sql` via `pnpm test:eh121-db` — drives `write_observation_normalization_revision_v2` and asserts one bound event per write |
| Event-kind precedence: reversal, acceptance, mapping change, verification change | same suite, tests 9, 14, 20, 21 |
| Every event carries the full before/after diff regardless of kind | same suite, tests 15–16; `scripts/verify-eh121-observation-change-history.ts` via `pnpm test:eh121` |
| Actor and version metadata | same suite, tests 12, 17; `pnpm test:eh121` covers `You` / `Another reviewer` / `Automatic` and the version block |
| Audit rows are append-only | same suite, tests 3, 4, 26, 27; `pnpm test:eh121` asserts the grants and the guard in the migration source |
| Sensitive raw document text is not duplicated | same suite, tests 8, 28; `pnpm test:eh121` asserts the DDL and the API reader declare no raw-text column |
| Erasure paths keep working | same suite, tests 36, 37 |
| Capture is idempotent | same suite, tests 22, 23, 25, 35 |
| History endpoint auth, ownership and limit validation | `pnpm test:eh121` route seam assertions |
| Compact UI on both review branches, with an empty state | `pnpm test:eh121` viewer/row/panel seam assertions; `pnpm smoke:eh121-history-panel` renders the real panel from real ledger rows |

## Local verification record (2026-08-10)

- [x] `pnpm typecheck` — clean.
- [x] `pnpm test:eh121` — all checks passed.
- [x] `pnpm test:eh121-db` — 37/37 pgTAP assertions passed. Run against the
  local database directly (`psql` inside `supabase_db_easyhealth`) because
  `supabase test db` could not mount the tests directory on this Docker
  Desktop host: `mkdir /run/desktop/mnt/host/c: file exists`.
- [x] `pnpm smoke:eh121-history-panel` — rendered three real captured events
  (acceptance, correction with reason, extraction supersession) produced by the
  production writer, plus the empty state.
- [ ] `pnpm build` — **fails before this change**: `@radix-ui/react-select`
  cannot resolve `@radix-ui/react-visually-hidden` from `node_modules`. A pnpm
  hoisting gap in files this change never touches.
- [ ] Manual interface checks EH121-UI-01 … EH121-UI-08 — **not executed.** The
  local Supabase stack in this workspace runs the database only; the
  application cannot be signed into here. A tester must run them.

## Out of scope or not manually testable yet

- **Registry reprocess batches (EH-116).** Applying a registry reprocess batch
  is a service-role CLI operation with no product interface, so the
  `Catalog reprocessing applied` entry cannot be produced by a tester. It is
  covered by the capture trigger on `registry_reprocess_batch_rows` and by the
  developer evidence above. EH121-UI-07 covers the reprocessing path a user can
  actually trigger.
- **EH-119 (edit and correction flow)** and **EH-120 (verification transition
  state machine)** are not delivered. EH-121 audits the correction and
  verification events that exist today; the entries those changes will add flow
  through the same revision store and need no further schema work. Do not fail
  a check because an EH-119 or EH-120 control is missing.
- **Support-facing console.** The history endpoint is profile-scoped and the
  only surface is the user's own review workspace. There is no admin screen to
  test.
- **Instrumental (non-laboratory) findings.** The ledger follows the laboratory
  normalization revision chain; instrumental measures are not covered.
