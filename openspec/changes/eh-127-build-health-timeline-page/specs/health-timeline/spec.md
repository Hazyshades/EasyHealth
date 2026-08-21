## ADDED Requirements

### Requirement: Profile-scoped timeline projection

The system SHALL expose a read-only timeline projection for the authenticated profile. Each event SHALL represent one source document and SHALL include the document id, one supported event type, a display title, the explicit event date or an unknown-date marker, available type-specific details, and a source link to the owned document viewer.

#### Scenario: Authenticated profile receives all supported event types

- **WHEN** an authenticated profile requests the timeline without a type filter
- **THEN** the response includes laboratory, instrumental, consultation, discharge, prescription, and referral document events that belong to that profile
- **AND** each event source link targets `/app/documents/<document-id>`
- **AND** no DICOM event is projected

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to the timeline endpoint has no authenticated profile
- **THEN** the endpoint responds with HTTP 401
- **AND** it does not return event or profile data

#### Scenario: Source ownership is enforced

- **WHEN** the authenticated profile requests the timeline
- **THEN** documents, observations, and typed extraction rows from another profile are excluded from the projection

### Requirement: Truthful event dates and deterministic ordering

The projection SHALL use only explicit medical dates. It SHALL preserve a missing date as unknown, SHALL expose day precision for date-only values, and SHALL sort dated events newest-first before undated events with stable tie-breakers.

#### Scenario: Type-specific dates are preferred

- **WHEN** an accepted consultation, discharge, prescription, or referral extraction contains its type-specific date
- **THEN** the event uses that date before falling back to the document's explicit `observed_at`
- **AND** a discharge event prefers `discharge_date` over `admission_date` when both are present

#### Scenario: Missing medical date stays unknown

- **WHEN** a document and its accepted typed extraction contain no explicit event date
- **THEN** the event has an unknown date marker
- **AND** the event does not use `created_at`, filename, current time, or another inferred value as its medical date

#### Scenario: Ordering is stable

- **WHEN** two or more events have the same event date
- **THEN** they are ordered by `created_at` descending and then document id ascending
- **AND** events with unknown dates appear after all events with known dates

### Requirement: Timeline filters and pagination

The endpoint SHALL support a supported document-type filter, inclusive `from` and `to` ISO day filters, and bounded page pagination. Filtering SHALL operate on normalized event dates before pagination. Invalid filter or pagination values SHALL produce a clear client error rather than silently changing the requested filter.

#### Scenario: Filter by document type

- **WHEN** the user selects a supported document type
- **THEN** only events of that type are returned
- **AND** the result count and pagination metadata describe the filtered set

#### Scenario: Filter by inclusive date range

- **WHEN** the user supplies a `from` date and/or `to` date
- **THEN** events whose normalized event date falls within the inclusive range are returned
- **AND** events with unknown dates are excluded while a date range is active

#### Scenario: Paginate a filtered result

- **WHEN** the user requests a valid page and page size
- **THEN** the response contains only that slice of the sorted filtered events
- **AND** the response includes `page`, `pageSize`, `total`, and `hasNext`
- **AND** the page never exposes more than the configured maximum page size

#### Scenario: Reject invalid query values

- **WHEN** `type`, `from`, `to`, `page`, or `pageSize` is malformed, unsupported, out of range, or `from` is after `to`
- **THEN** the endpoint responds with HTTP 400 and an actionable error message

### Requirement: Event detail projection

The system SHALL show available current laboratory measurements on laboratory events and accepted structured details on instrumental, consultation, discharge, prescription, and referral events. Missing or still-processing details SHALL not remove the source document event.

#### Scenario: Laboratory event includes bounded measurements

- **WHEN** a laboratory document has current observations
- **THEN** its event includes a bounded list of measurement name/value/unit summaries and the total measurement count
- **AND** rejected, superseded, or non-current extracted laboratory rows are not presented as current measurements

#### Scenario: Typed event includes available details

- **WHEN** an instrumental, consultation, discharge, prescription, or referral document has an accepted typed extraction
- **THEN** its event includes the relevant provider, summary, finding, medication, diagnosis, referral, or date details that are available
- **AND** absent fields are omitted rather than rendered as fabricated values

#### Scenario: Processing or extraction failure remains visible

- **WHEN** a source document is processing, failed, or has no accepted typed extraction
- **THEN** its event remains in the timeline with its source link and processing/status context
- **AND** the timeline does not claim that missing structured data was found

### Requirement: Timeline page states and navigation

The authenticated application SHALL provide `/app/timeline` with active-profile context, document-type and date-range controls, event cards, source-document links, pagination controls, and distinct loading, error/retry, empty, and filtered-empty states.

#### Scenario: Active profile and normal timeline are visible

- **WHEN** the user opens `/app/timeline` with available events
- **THEN** the page identifies the active profile
- **AND** it renders the selected event cards in chronological order
- **AND** each card offers an accessible link to open the original document in the existing document viewer

#### Scenario: Filters reset pagination

- **WHEN** the user changes the document type or date-range filter
- **THEN** the page requests the first page of the new filtered result
- **AND** the active filter values remain visible in the controls

#### Scenario: Empty and filtered-empty states are distinct

- **WHEN** the profile has no supported timeline events
- **THEN** the page explains that no timeline events are available and offers a path to upload a document
- **WHEN** events exist but the active filters match none
- **THEN** the page says no events match the filters and offers a clear-filters action

#### Scenario: Loading and error states are actionable

- **WHEN** timeline data is loading
- **THEN** the page shows a timeline loading skeleton without claiming that the result is empty
- **WHEN** the request fails
- **THEN** the page shows an error message and a retry action
