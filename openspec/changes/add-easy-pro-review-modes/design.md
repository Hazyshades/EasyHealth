## Context

EasyHealth already has a laboratory Document review flow in `DocumentViewer`. The flow reads extracted rows from `document_extracted_biomarkers`, shows source evidence, and sends owner-scoped actions to the acceptance, rejection, correction, manual mapping, batch verification, and reprocess routes. The normalization writer runs the deterministic Resolver and records append-only normalization revisions. Raw value text, provenance, extraction confidence, and resolver evidence are separate fields and must remain separate.

The profile API already exposes persisted preferences such as lab unit display and the Settings page already saves those preferences through `/api/profile`. Laboratory uploads are reserved by the `create_document_upload_reservation` database function, which creates the `documents` row before the worker processes the file. The document bootstrap route returns the review payload used by `DocumentViewer`.

The new behavior crosses profile settings, document persistence, upload reservation, review APIs, normalization revision writes, and the review UI. The server must enforce the boundary because the current correction and verification routes are directly callable by an authenticated owner. The scope is normalized `lab_result` Documents. Other document types keep their current behavior and do not receive Easy or Pro laboratory controls.

## Goals / Non-Goals

**Goals:**

- Store a profile default of `easy` or `pro`, with `pro` as the compatibility default for existing profiles.
- Snapshot that default onto a new laboratory Document, expose the effective mode in the review bootstrap, and allow an owner to change it before the first accepted or manually corrected normalization revision.
- Make Easy a read-only extraction review surface with explicit acceptance and rejection. The surface must show the extracted evidence and source provenance without exposing correction, manual mapping, or batch verification controls.
- Preserve the current Pro workflow, including measurement correction, manual mapping, technical details, verification, and append-only history.
- Enforce the same policy in authenticated server routes and in the database transaction that creates the first accepted normalization revision.
- Let an owner explicitly enter Pro after an Easy acceptance and keep the Easy acceptance as an earlier revision.
- Keep deterministic Resolver behavior, raw evidence, source provenance, and the existing explicit acceptance requirement unchanged.

**Non-Goals:**

- Changing extraction prompts, OCR, extraction models, or the authority of an LLM-proposed identity.
- Silently accepting extracted rows after processing.
- Changing Registry definitions, resolver scoring, incomplete-outcome semantics, or Health Profile eligibility.
- Adding Easy or Pro review policy to imaging, consultation, prescription, referral, DICOM, or other non-laboratory Documents.
- Rewriting historical observations or replacing append-only correction history with an in-place update.

## Decisions

### 1. Snapshot the profile default when a laboratory Document is created

Add `profiles.review_mode_default` with the constrained values `easy` and `pro`, defaulting to `pro`. Add nullable `documents.review_mode` and `documents.review_mode_locked_at` fields. The upload reservation RPC will read the profile default and write it to `documents.review_mode` only for `lab_result`; non-laboratory Documents keep a null mode and no mode policy.

Existing laboratory Documents will be backfilled to `pro`. Documents that already have an accepted or manually corrected active revision will also receive a lock timestamp during migration. Existing Documents still awaiting their first accepted revision can remain switchable, but their starting mode stays Pro so the current workflow is not changed by a profile preference added later.

A dynamic fallback to the current profile setting was rejected. It would let a profile change alter an open Document without an explicit action and would make concurrent review tabs difficult to reason about. A snapshot gives each Document a stable starting mode while retaining an explicit pre-acceptance switch.

### 2. Treat the lock as an initial-review boundary, not an immutable lifetime mode

Before the first accepted or manually corrected normalization revision, the owner may select either mode. The server updates the selection with a conditional write that requires `review_mode_locked_at` to be null. A rejection alone does not lock the Document because it does not create an accepted observation or normalization revision.

The first acceptance, value correction, manual mapping correction, or equivalent Pro write locks the initial review boundary. The lock and the first revision must commit together. After that point, `pro` cannot change back to `easy`. An Easy Document can make one forward transition to Pro through an explicit escalation action. `review_mode_locked_at` remains the timestamp of the initial boundary; `review_mode` represents the current effective mode.

The alternative of allowing arbitrary mode changes after acceptance was rejected because a later Easy view could conceal an already corrected result and make the meaning of the review history unclear.

### 3. Keep Easy writes on the existing acceptance and lifecycle paths

Easy acceptance will call the existing normalization writer without a measurement override, manual definition key, or user verification operation. The writer may still run the deterministic Resolver internally. If the Resolver cannot produce one safe concrete identity, the existing raw or incomplete outcome contract remains in force and the extracted result is still preserved as reported.

Easy will allow explicit row acceptance and the existing rejection flow with a reason. It will not expose or accept correction forms, manual mapping selections, batch verification, batch reversal, or undo of a correction. Pro will continue to use the existing correction and verification paths.

A separate Easy persistence model was rejected. It would duplicate provenance and normalization logic and could make Easy results behave differently from the current laboratory outcome contracts.

### 4. Enforce mode policy in one server-side policy layer

Create a document review mode policy helper that receives the owner, Document, normalized document type, current mode, lock state, and current review state. The helper will be used by the Document bootstrap, mode selection or escalation route, acceptance, rejection, correction, manual mapping, batch verification, batch reversal, confirm-observations, and reprocess paths where the action can affect laboratory review state.

The policy will return stable semantic error codes for stale mode, locked selection, Easy action denial, and invalid escalation. Routes will still perform the existing owner check. The client will send the expected mode and revision or lock snapshot when a mutation needs optimistic concurrency, but the server will treat those values only as conflict checks, never as authorization.

Hiding a button in `DocumentViewer` alone was rejected because an authenticated caller could still post directly to the correction or verification routes.

### 5. Make the initial write and mode lock one atomic operation

Extend the existing acceptance and correction transaction boundary so a first user write locks the Document only if its expected mode is still current and the Document has no prior accepted or manually corrected active revision. A concurrent write in another tab must either commit under the winning mode or fail with a conflict and no partial revision or observation.

The mode selection endpoint will use a conditional update. The acceptance and correction writers will pass the current Document mode into the database-side operation that creates and activates the revision. The implementation must not lock the Document in a separate post-acceptance update, because that would permit a Pro correction and an Easy acceptance to race between two transactions.

### 6. Record the review mode on user-created normalization revisions

Add nullable `observation_normalization_revisions.review_mode_at_write` with the values `easy` and `pro`. New owner-driven acceptance, correction, mapping, and verification-related normalization writes will record the effective mode. Historical rows and system-only writes that predate this capability may remain null. The field is audit metadata; it is not Resolver input and cannot replace raw evidence or identity fields.

This lets the history view distinguish an Easy acceptance from a later Pro correction after the Document's current mode has changed to Pro. The existing revision chain, observation projection, raw-field write-once constraints, and change history remain authoritative.

### 7. Expose one bootstrap contract and an explicit escalation action

The owner-scoped Document bootstrap will return:

- the effective `review_mode` for laboratory Documents,
- `review_mode_locked_at`,
- whether pre-acceptance selection is available, and
- whether explicit escalation to Pro is available.

Add an authenticated mode route with two guarded operations: select `easy` or `pro` before the initial lock, and explicitly escalate `easy` to `pro` after an Easy acceptance. Escalation requires a confirmation payload and cannot be used to move Pro back to Easy. The response returns the new effective mode and lock state so the UI can refresh without guessing.

A client-only local mode was rejected because a refresh, second tab, or direct API call would then use a mode different from the persisted review boundary.

### 8. Render two clear review surfaces without duplicating review semantics

Add a compact mode control to the laboratory Document review header while the selection is available. Easy rows will render extracted name, value or text, unit, reference text, dates, source page or snippet, and extraction confidence as read-only evidence. The surface will provide explicit accept and reject actions and a clear explanation that Easy keeps the extracted result as reported and does not offer manual editing.

Pro will keep the existing correction form, technical details disclosure, manual mapping, batch verification, and history components. After an Easy acceptance, the UI will show an explicit `Enter Pro mode` action. Switching or escalating will refresh the bootstrap and preserve the currently displayed evidence.

The controls must remain keyboard reachable, have visible focus, announce lock and error states, and reflow without horizontal scrolling on narrow screens. Mode must not be communicated by color alone. Product copy must avoid claiming that Easy bypasses automatic Resolver processing; it only removes manual intervention from the user path.

### 9. Preserve reprocess behavior

Reprocess will leave `documents.review_mode` and `documents.review_mode_locked_at` unchanged. New extraction rows inherit the Document's current review mode for review policy, while existing append-only supersession and source provenance rules continue to apply. Reprocess cannot unlock a Document or silently switch it to the current profile default.

## Risks / Trade-offs

[Risk] Existing Documents may have inconsistent legacy status signals for accepted rows. -> The migration will detect active normalization revisions and accepted extracted rows, backfill their mode to Pro, and set the lock timestamp. The owner-scoped policy will also fail closed when a locked review state cannot be determined.

[Risk] Acceptance and correction currently use several writer and RPC paths. -> Centralize mode checks in one policy helper and thread the expected mode through every user-driven writer; add integration coverage for each mutation route.

[Risk] Two review tabs can submit different modes at the same time. -> Use conditional mode updates and an atomic first-write lock. Return a conflict that tells the losing tab to reload instead of creating a partial revision.

[Risk] Users may read Easy as a guarantee that the extraction is medically correct. -> Keep source evidence, extraction confidence, raw text, and existing Resolver guidance visible. State that Easy preserves what was extracted and does not remove the existing data-quality limitations.

[Risk] Registry documentation can drift when the new revision metadata or persistence contract lands. -> Treat the Registry documentation synchronization workflow, generated biomarker docs, Wiki staging, and tracking issue as implementation gates before the change is closed.

## Migration Plan

1. Add the profile and Document mode columns with check constraints and compatibility defaults.
2. Backfill existing laboratory Documents to Pro, locking Documents with an existing accepted or corrected active revision. Keep non-laboratory mode fields null.
3. Add `review_mode_at_write` to normalization revisions and update the writer contract for new owner-driven writes. Historical rows remain readable with null metadata.
4. Update the upload reservation RPC to snapshot the profile default for new laboratory Documents.
5. Add the profile API and Settings control, the Document bootstrap fields, the guarded mode route, and the server policy checks.
6. Render Easy and Pro surfaces, including pre-acceptance selection, post-Easy escalation, keyboard and narrow-screen states, and conflict recovery.
7. Verify acceptance, rejection, correction, manual mapping, batch verification, reversal, reprocess, and concurrent stale-mode behavior against the existing lifecycle and Registry contracts.

Rollback keeps existing rows and revisions readable. If the UI or route rollout must be disabled, default new laboratory Documents to Pro and hide the mode selector while leaving the persisted columns and revision metadata in place. Do not delete mode columns or rewrite revisions during rollback. A later migration can remove unused mode fields only after all consumers and audit requirements are retired.

## Open Questions

- The implementation must choose stable HTTP status and error code names for mode conflicts, Easy action denial, and invalid escalation. The semantic outcomes above are fixed; the exact identifiers remain an implementation detail.
- The implementation must confirm the existing Supabase type-generation and migration naming convention before adding the migration files. No product behavior is blocked by that choice.
