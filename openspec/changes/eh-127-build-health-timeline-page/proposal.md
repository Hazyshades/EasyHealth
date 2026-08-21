## Why

EasyHealth currently exposes documents and biomarkers in separate, upload-oriented screens, so users cannot review laboratory, instrumental, consultation, discharge, prescription, and referral records as one chronological health story. EH-126 defines the normalized medical-event direction, but the frontend needs a usable read-only timeline projection now: a profile-scoped page with explicit event dates, document-type/date filters, source navigation, and bounded pagination.

## What Changes

- Add a `health-timeline` capability in the `documents` product domain.
- Add a profile-scoped timeline read model/API that projects existing documents, current laboratory observations, and accepted typed extraction rows into event cards without inventing missing dates.
- Represent unknown event dates explicitly and sort dated events deterministically before undated events.
- Add the `/app/timeline` page with active-profile context, document-type and date-range filters, event cards, source-document links, pagination, and loading, empty, filtered-empty, and error/retry states.
- Add the timeline route to the authenticated application navigation and page metadata.
- Add focused deterministic verification for event projection, date handling, filtering, ordering, pagination, and source-link contracts.
- Add a transactional synthetic database contract fixture for profile ownership, source-date fields, and the existing server-side read privilege boundary.
- No database migration or write path is introduced; the projection remains replaceable by the EH-126 normalized medical-event model.

## Capabilities

### New Capabilities

- `health-timeline`: Profile-scoped chronological presentation of medical-document events and their available measurements, typed details, dates, and source links.

### Modified Capabilities

- None. No existing capability spec under `openspec/specs/` currently defines timeline requirements; existing document and profile behavior is consumed without changing its contract.
