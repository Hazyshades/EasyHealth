## 1. Timeline projection

- [x] 1.1 Add the typed timeline event model and pure projection helpers for the six supported document types, including explicit date precedence, unknown-date representation, source links, bounded laboratory measurements, and typed extraction details.
- [x] 1.2 Add deterministic event filtering, ordering, ISO-date validation, and bounded pagination helpers with inclusive date-range semantics and stable tie-breakers.

## 2. Profile-scoped API

- [x] 2.1 Implement `GET /api/timeline` with session authentication, supported query validation, profile-owned document and extraction reads, current laboratory observation filtering, normalized projection, and pagination metadata.
- [x] 2.2 Preserve processing, failed, empty-extraction, and unknown-date source documents in the response without exposing upload time as an event date or leaking other profiles' rows.

## 3. Timeline interface

- [x] 3.1 Build `/app/timeline` with active-profile context, document-type/date-range filters, event cards, measurement and typed-detail summaries, source-document links, pagination, and distinct loading, error/retry, empty, and filtered-empty states.
- [x] 3.2 Add Health Timeline to authenticated navigation and page metadata using existing shell and UI component conventions.

## 4. Verification and QA

- [x] 4.1 Add deterministic EH-127 verification coverage for projection, date precedence, unknown dates, current measurements, filtering, ordering, pagination, endpoint seams, and source-link wiring; expose it through a package script.
- [x] 4.2 Create `QA/eh-127/checklist.md` with tester-facing synthetic-data checks, developer evidence requirements, and explicit limits for normalized EH-126 behavior not delivered here.
- [x] 4.3 Add the synthetic transactional EH-127 database contract fixture and a `test:eh127-db` script, and record local-stack availability in the QA evidence.
