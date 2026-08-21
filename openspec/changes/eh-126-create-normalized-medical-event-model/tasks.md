## 1. Database event model

- [x] 1.1 Add migration `069_eh126_normalized_medical_events.sql` with profile-scoped `medical_events`, controlled event types, source-document uniqueness, event/date indexes, RLS, service grants, document creation trigger, and idempotent backfill.
- [x] 1.2 Add precision-safe `medical_event_dates` roles, database validation/derivation trigger, unknown defaults, source text/timezone fields, and service-only `eh126_sync_document_event_dates` RPC.
- [x] 1.3 Add observation event linkage/ownership trigger and nullable day projections; make instrumental source measures/publication accept an unknown study date without altering laboratory lineage constraints.
- [x] 1.4 Add the `medical_event_timeline` view with source-document metadata and internal deterministic sort fields.

## 2. Date contract and worker integration

- [x] 2.1 Implement shared medical-event date types, parser, canonical precision handling, calendar-day projection, event-type mapping, and deterministic timeline comparator.
- [x] 2.2 Integrate event-date synchronization into each typed worker pipeline path, preserve partial/unknown source values, and remove current-date fallbacks from instrumental publication and automatic verification.
- [x] 2.3 Update normalization writer, correction, batch-verification, confirmation, and Registry reprocessing callers to pass nullable source day projections rather than fabricated current dates.
- [x] 2.4 Update extraction/snapshot types and structured contexts so nullable/partial event dates flow without `Date` timezone conversion.

## 3. Timeline API and regression coverage

- [x] 3.1 Add authenticated `GET /api/timeline` with profile scoping, bounded direction/limit parameters, event dates, source documents, linked observations, deterministic ordering, and `Cache-Control: no-store`.
- [x] 3.2 Add EH-126 TypeScript contract tests for date parsing, precision boundaries, comparator stability, event mapping, and no current-date medical fallback.
- [x] 3.3 Add pgTAP coverage for event creation/backfill, date validation and precision, ownership/linkage, nullable projections, sync RPC, and deterministic timeline rows; register `test:eh126` and `test:eh126-db` scripts.

## 4. Roadmap delivery evidence

- [x] 4.1 Create `QA/eh-126/checklist.md` from the roadmap template with executable manual scope, unavailable-UI limitation, synthetic data rules, and developer-evidence requests.
- [x] 4.2 Validate the OpenSpec change and document the delivered API/database contracts without claiming a timeline UI or Registry documentation changes.
