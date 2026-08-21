## ADDED Requirements

### Requirement: Every source document has one profile-scoped medical event

The system SHALL create exactly one `medical_events` row for each document, SHALL copy the document's `profile_id`, SHALL link the event to that source document, and SHALL map the existing typed document type to a controlled event type. Event creation SHALL be idempotent and SHALL also cover documents that existed before the migration.

#### Scenario: New document receives an event before processing completes

- **WHEN** a document is inserted with a supported typed document type
- **THEN** one event is created for the same profile and source document
- **AND** the event type matches the document type
- **AND** its occurred date is represented as `unknown` until source evidence supplies a date

#### Scenario: Existing documents are backfilled

- **WHEN** the EH-126 migration runs against documents created before the event model
- **THEN** each existing document has one event with the matching profile and source document
- **AND** rerunning the backfill does not create duplicates

#### Scenario: Unsupported future document type is safe

- **WHEN** a document type is not in the normalized mapping
- **THEN** the event uses the controlled `other` type
- **AND** event creation does not infer a clinical event type from the filename or upload time

### Requirement: Medical event dates preserve source precision

The system SHALL store event date roles `occurred`, `occurred_end`, `collected`, and `authored` independently. Each stored role SHALL declare exactly one precision: `instant`, `day`, `month`, `year`, or `unknown`.

#### Scenario: Exact calendar day is stored without timezone conversion

- **WHEN** source evidence provides `2026-08-24` for an event date role
- **THEN** the role is stored with `precision = day` and `value_text = 2026-08-24`
- **AND** the API returns that calendar value unchanged
- **AND** no timezone is assigned

#### Scenario: Partial month remains a month

- **WHEN** source evidence provides `2026-08` for a date role
- **THEN** the role is stored with `precision = month` and `value_text = 2026-08`
- **AND** the system does not store or return `2026-08-01` as the clinical date

#### Scenario: Partial year remains a year

- **WHEN** source evidence provides `2026` for a date role
- **THEN** the role is stored with `precision = year` and `value_text = 2026`
- **AND** the system does not store or return a month or day for that role

#### Scenario: Missing date remains explicitly unknown

- **WHEN** source evidence has no usable date
- **THEN** the role is represented with `precision = unknown` and a null canonical value
- **AND** upload time and processing time are not copied into any medical date role

#### Scenario: Instant requires an explicit timezone

- **WHEN** source evidence provides a timestamp with `Z` or an explicit numeric offset
- **THEN** the role is stored with `precision = instant`, the canonical instant, and that explicit timezone information
- **AND** a timestamp without an explicit timezone is rejected or represented as unknown rather than assigned the server timezone

### Requirement: Event date roles are source-auditable and database-validated

The system SHALL preserve the original date text when available, SHALL enforce the canonical shape and calendar validity at the database boundary, SHALL allow at most one row per event and role, and SHALL use internal ordering bounds without exposing them as invented clinical precision.

#### Scenario: Invalid calendar date is rejected

- **WHEN** a caller attempts to store `2026-02-31` as a day value
- **THEN** the database rejects the write
- **AND** no event date row is partially persisted

#### Scenario: Role replacement is idempotent

- **WHEN** the worker synchronizes the same event date role twice with the same canonical value
- **THEN** one role row remains
- **AND** the second synchronization does not create a duplicate event date

#### Scenario: Raw source wording is retained

- **WHEN** a source value is normalized from raw text such as `Aug 2026`
- **THEN** the canonical value and precision are stored separately from `raw_text`
- **AND** the raw text is available to an authorized timeline consumer

### Requirement: Documents and observations share event ownership

Document-derived observations SHALL link to the event for their source document when one exists. The database SHALL reject an event link whose profile or source document does not match the observation, while legacy observations without a source document MAY remain unlinked.

#### Scenario: Accepted laboratory observation inherits its document event

- **WHEN** an observation is inserted with a document ID and no explicit event ID
- **THEN** the database links it to that document's medical event
- **AND** its profile remains equal to the event profile

#### Scenario: Instrumental observation remains separate from laboratory lineage

- **WHEN** an instrumental observation is inserted for an instrumental report
- **THEN** it links to that report's medical event
- **AND** it does not acquire laboratory extraction or normalization lineage

#### Scenario: Cross-profile event link is rejected

- **WHEN** a caller inserts an observation whose event belongs to another profile or document
- **THEN** the database rejects the write
- **AND** no cross-profile timeline row is visible

### Requirement: Compatibility date projections never invent a medical day

The existing document and observation `observed_at` projections SHALL contain a value only when the source provides a complete calendar day. Partial and unknown event dates SHALL leave those projections null while remaining available through the event date contract.

#### Scenario: Complete date keeps existing document behavior

- **WHEN** a document's source event date is `2026-08-24`
- **THEN** `documents.observed_at` remains `2026-08-24`
- **AND** its event occurred role is the same day-level value

#### Scenario: Missing instrumental date does not use upload date

- **WHEN** an instrumental extraction has no `study_date`
- **THEN** the source measure, document event, and observation day projection remain unknown/null
- **AND** the worker does not use the current date, upload timestamp, or processing timestamp

### Requirement: Timeline reads are deterministic and profile-scoped

The authenticated timeline API SHALL return only the session profile's medical events, SHALL include source-document metadata, all event date roles, and linked observations, and SHALL order results deterministically. Known occurred dates SHALL sort before unknown occurred dates in both directions; ties SHALL use fixed non-date keys including event type, source document ID, and event ID.

#### Scenario: Equal dates have stable order

- **WHEN** two events have the same occurred value and precision
- **THEN** repeated timeline reads return them in the same order
- **AND** the order does not depend on upload insertion order or database default ordering

#### Scenario: Partial dates expose precision while ordering by bounds

- **WHEN** a year-level event and a day-level event share the same lower calendar bound
- **THEN** the response preserves each event's precision
- **AND** the comparator applies the documented precision/non-date tie-breakers
- **AND** neither response date is expanded to an invented month or day

#### Scenario: Unknown dates are deterministic

- **WHEN** multiple events have unknown occurred dates
- **THEN** all known events appear before them
- **AND** unknown events are ordered by the same fixed non-date tie-breakers

#### Scenario: Unauthorized profile access is denied

- **WHEN** a caller has no authenticated profile session
- **THEN** the timeline API returns `401`
- **AND** it does not reveal event, document, or observation data

#### Scenario: Timeline response is not cached

- **WHEN** an authenticated timeline request succeeds
- **THEN** the response includes `Cache-Control: no-store`
- **AND** linked events reflect the current committed projection
