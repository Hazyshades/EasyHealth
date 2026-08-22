## Why

EH-126 needs one chronological model for documents, measurements, and clinical panels. The current product stores a nullable `documents.observed_at` date and separate source-specific dates, orders document lists by upload time, and has no shared event identity; the worker also substitutes the current date when an instrumental study date is missing. That makes chronology non-deterministic and can present upload time as if it were a medical event.

## What Changes

- Add a profile-scoped normalized medical-event record with an explicit event type and source-document link. Supported types mirror the existing typed document pipeline: laboratory result, instrumental study, consultation, discharge/hospitalization, prescription, referral, DICOM, and other.
- Add one date record per supported role (`occurred`, optional `occurred_end`, `collected`, and `authored`) with an explicit precision (`instant`, `day`, `month`, `year`, or `unknown`), preserved source text, and an explicit timezone only for instants. Partial values stay partial; unknown values stay null/unknown.
- Add database validation and internal ordering bounds for event dates. Timeline ordering uses known event bounds first, then stable event-type/source/event identifiers as tie-breakers; internal bounds are never returned as fabricated clinical dates.
- Create events for new and existing documents, link observations to their document event, and enforce profile/document ownership at the database boundary. Keep the existing raw/source provenance and source-specific extraction fields intact.
- Replace current-date fallbacks in ingestion, acceptance, correction, batch verification, reprocessing, and instrumental publication with nullable event dates. `documents.observed_at` and observation `observed_at` remain compatibility projections for complete calendar days and become nullable where the source date is not known at day precision.
- Expose an authenticated timeline API that returns event dates with precision, source documents, and linked observations in deterministic order. This change does not invent a timeline screen; the existing Documents and Biomarkers screens remain unchanged until a later UI roadmap item.
- Add focused TypeScript, database, API, and QA coverage for event ownership, date precision/timezone rules, missing-date handling, stable ordering, and no upload-date substitution.

## Capabilities

### New Capabilities

- `medical-event-timeline`: Normalized profile-scoped medical events, precision-safe event dates, source/observation linkage, and deterministic timeline projection.

### Modified Capabilities

- None. The repository has no existing main capability spec for timeline chronology; the new capability owns the contract without changing Registry or observation-resolution requirements.

## Impact

- **Target domain:** `documents` (worker pipeline, document/observation persistence, and an authenticated timeline projection).
- **Database:** new `medical_events` and `medical_event_dates` tables, ownership triggers/indexes, document backfill/creation trigger, nullable date projections, and a timeline view/RPC boundary.
- **Application/worker:** date parsing and precision mapping, event-date synchronization, removal of fabricated current dates, and a new `/api/timeline` read route.
- **Compatibility:** existing complete `YYYY-MM-DD` documents and observations retain their displayed date. Partial/unknown sources return a precise date shape instead of a guessed day; no clinical values or Registry identity rules change.
- **Verification:** migration pgTAP coverage, pure ordering/parser regression coverage, API contract checks, and `QA/eh-126/checklist.md`. Registry documentation synchronization is intentionally not applicable because this change does not alter Registry definitions, aliases, resolver behavior, persistence semantics, or generated biomarker documentation.
