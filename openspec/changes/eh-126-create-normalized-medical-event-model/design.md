## Context

The `documents` table currently has one nullable `observed_at date`, while each typed extraction stores its own date (`visit_date`, `study_date`, `prescribed_at`, and similar). Laboratory observations repeat a day-level `observed_at`, and the Documents API orders by `created_at`, so upload chronology and medical chronology are mixed. There is no common identity joining a source document, its extracted measurements, and any future panel/timeline projection.

The worker already knows the typed event that it is processing, but it writes a fabricated current day when an instrumental study has no extracted study date. Several acceptance, correction, batch-verification, and Registry reprocessing paths make the same substitution. EH-103 provenance and later Registry changes must remain intact: this change adds chronology metadata and does not change resolver identity, verification, or clinical interpretation.

## Goals / Non-Goals

**Goals:**

- Give every uploaded document one profile-owned `medical_events` identity with a controlled event type and source-document link.
- Give every event explicit `occurred`, `occurred_end`, `collected`, and `authored` date roles, including an explicit `unknown` state.
- Preserve `YYYY`, `YYYY-MM`, and `YYYY-MM-DD` source precision without converting partial dates into a day; accept timestamp instants only when an explicit UTC offset or `Z` is present.
- Provide deterministic timeline ordering with known dates before unknown dates and stable tie-breakers.
- Link document-derived observations to the same event and enforce profile/document ownership in the database.
- Keep complete day-level compatibility projections while removing all current-date fallbacks.
- Expose an authenticated, no-store timeline API for future UI consumers.

**Non-Goals:**

- No new timeline screen or redesign of Documents, Biomarkers, or Health Profile pages.
- No clinical interpretation, diagnosis, date inference from upload time, or timezone inference for date-only values.
- No change to Registry definitions, aliases, resolver outcomes, verification workflows, provenance evidence, or assessment scoring.
- No historical reconstruction of dates that are absent from stored source evidence; backfill creates unknown event dates where necessary.
- No replacement of the existing audit ledger `observation_change_events`; it remains a lifecycle/history ledger, not a medical-event identity.

## Decisions

### 1. One event per source document, with an extensible typed identity

Create `public.medical_events` with:

- `id uuid primary key`;
- `profile_id uuid not null references profiles(id) on delete cascade`;
- `source_document_id uuid not null references documents(id) on delete cascade`;
- `event_type text not null` constrained to `lab_result`, `instrumental_report`, `consultation_note`, `discharge_summary`, `prescription`, `referral`, `dicom`, or `other`;
- immutable `created_at`.

`source_document_id` is unique, making the document the stable event boundary for this release. An `AFTER INSERT` document trigger creates the row using the document type, and the migration backfills existing documents. This gives an event identity before extraction completes, so a missing date is a represented state rather than a missing row.

**Alternative rejected:** deriving a timeline directly from documents and observations. That keeps two identities, cannot represent a document with no observation, and makes later panels/encounters impossible to attach without another migration.

### 2. Child date records encode precision instead of overloaded nullable columns

Create `public.medical_event_dates` with one unique row per `(medical_event_id, date_role)`. Roles are `occurred`, `occurred_end`, `collected`, and `authored`; every event receives an `occurred` row initialized as unknown, while the other roles remain optional unknown rows for a stable API shape.

Each row stores:

- `precision`: `instant`, `day`, `month`, `year`, or `unknown`;
- `value_text`: canonical source-shaped value (`YYYY-MM-DDTHH:mm:ss(.fraction)(Z|+/-HH:MM)`, `YYYY-MM-DD`, `YYYY-MM`, or `YYYY`); null for unknown;
- `raw_text`: the source string when available, retained independently from the canonical value;
- `timezone`: only for an instant with an explicit offset/UTC marker; null for calendar dates and unknown;
- internal `sort_at`, `sort_start_on`, and `sort_end_on` values used only for ordering.

A `BEFORE INSERT OR UPDATE` database trigger validates the shape, validates real calendar values, requires an explicit timezone for instants, and derives the internal ordering bounds. A month/year bound is an ordering interval, not a displayed date. The API returns `value_text`, `precision`, `raw_text`, and `timezone`, never the internal bounds as a clinical date.

Unknown rows have all value and sort fields null. Date-only values are calendar values and are never converted through a JavaScript `Date`; this avoids local-time shifts. The TypeScript parser and database trigger enforce the same contract.

**Alternative rejected:** a single `timestamptz occurred_at` plus nullable precision. It cannot represent `2026`, `2026-08`, or an unknown source without either inventing a day/time or hiding the source value.

### 3. Database-owned event and observation linkage

Add nullable `observations.medical_event_id` with an index. A `BEFORE INSERT OR UPDATE` trigger fills it from `document_id` when omitted and rejects a profile/document mismatch. Existing observations are backfilled by their document event. The observation `observed_at` column becomes nullable: it remains populated only for a complete calendar day and is not the source of truth for partial/unknown dates.

The document event trigger and observation-link trigger are idempotent. They make direct worker/RPC writes safe without requiring every caller to know the event ID. The existing source lineage and Registry constraints remain authoritative.

### 4. Event-date synchronization is an explicit service RPC

Add a service-role-only `eh126_sync_document_event_dates(document_id, dates jsonb)` RPC. The worker parses source values into the date contract, sends only the roles it can support, and the RPC upserts the event date rows after checking the document/profile ownership. Omitted roles remain unknown; conflicting per-row dates are not collapsed into a guessed consensus.

The worker maps source fields as follows:

- laboratory result: `observed_at` → `occurred`; a single consistent `collected_at` → `collected`; a single consistent `reported_at` → `authored`;
- instrumental report: `study_date` → `occurred`;
- consultation: `visit_date` → `occurred`;
- discharge summary: `admission_date` → `occurred`, `discharge_date` → `occurred_end`;
- prescription: `prescribed_at` → `occurred`;
- referral: `referral_date` → `occurred`.

The `documents.observed_at` compatibility projection receives only a complete `YYYY-MM-DD`; partial and unknown values remain null. The same value is passed to the event RPC, so the event retains the original precision. The worker calls synchronization before marking a document complete and treats an RPC failure as a processing failure rather than completing an unsynchronized document.

**Alternative rejected:** letting each API route update dates independently. That would miss reprocessing and worker paths and would allow an accepted observation to diverge from its source event.

### 5. Remove fabricated dates at every write seam

Change instrumental source measures and observations to permit a null day projection, make instrumental snapshot normalization accept a nullable `study_date`, and update the publication RPC to preserve null rather than requiring a date. Change the normalization writer and verification/reprocessing callers to accept `string | null`; all callers use the document/event day projection or null, never `new Date()` as a medical date. Existing timestamp fields used for operational auditing (`created_at`, `processed_at`, leases) are unaffected.

### 6. Timeline projection and API ordering

Create a `medical_event_timeline` view containing event identity, profile, type, source-document metadata, the occurred-date contract, and internal sort fields. Add `GET /api/timeline` with the authenticated session profile, optional `direction=asc|desc`, and a bounded `limit`.

The route reads the view, all date-role rows, and linked observations, then uses a pure comparator shared with tests:

1. known occurred dates sort before unknown dates in either direction;
2. known values sort by their lower ordering bound (and upper bound for equal starts), ascending or descending as requested;
3. ties use precision rank, event type, source document ID, and event ID in a fixed order;
4. unknown ties use the same non-date keys.

The response exposes the source document, event dates with precision, and observations under one event. It sets `Cache-Control: no-store`. No UI is added in this change.

### 7. Verification and release hygiene

Add a pure TypeScript EH-126 verifier for parser/comparator boundaries and current-date fallback scans, a pgTAP migration test for event creation/backfill/ownership/date constraints/nullable projections, and an API contract test for deterministic shape and no-store behavior. Register them as `pnpm test:eh126` and `pnpm test:eh126-db`. Add `QA/eh-126/checklist.md` with a clear not-manually-testable-yet section because no timeline UI exists.

## Risks / Trade-offs

- **Migration complexity:** existing worker RPCs and observation writers have evolved through many migrations. The new migration must use idempotent alters and replace only the affected instrumental function contract; the EH-126 DB test must run on a clean database.
- **Partial date ordering is an interval approximation:** sorting by lower bound is deterministic, but a year/month event may overlap another event. The API explicitly returns precision so consumers do not mistake ordering for exact chronology.
- **Event-per-document scope:** a document with multiple independent encounters is represented as one event in this release. `occurred_end` preserves the discharge window; a future encounter-splitting change can add child events without changing date semantics.
- **Legacy observations without documents:** they remain valid with a null event link and are excluded from the document-event timeline until a source event exists; no synthetic event or date is created for them.
- **No UI:** the API and database contract are delivered first. QA records the unavailable interface instead of claiming a manual timeline pass.
