## ADDED Requirements

### Requirement: EH-132 release validation uses a deterministic cross-feature fixture matrix

The release SHALL provide a named synthetic fixture matrix and an automated validation command that exercises the existing medical-event, Health Timeline, laboratory comparison, unit-presentation, and panel-registry contracts without mutating production data or Registry definitions.

#### Scenario: The release runner covers every declared validation family

- **WHEN** `pnpm test:eh132` runs in the repository
- **THEN** it validates timeline event projection, precision-safe dates, repeated-measurement eligibility, unit compatibility/conversion, panel membership, duplicate boundaries, and source/presentation wiring
- **AND** it exits non-zero on a contract failure
- **AND** it reports the synthetic performance result and fixture counts

#### Scenario: Fixture execution is safe and repeatable

- **WHEN** the release runner is executed repeatedly with the same checkout
- **THEN** it uses only deterministic synthetic/de-identified values
- **AND** it does not require patient data, network access, an authenticated browser, or database writes
- **AND** repeated runs produce the same assertions and fixture counts

### Requirement: Medical-event precision and Health Timeline ordering remain truthful

The release validation SHALL prove that medical dates preserve source precision and explicit timezone evidence, that known events precede unknown events in both supported directions, and that a missing medical date is not replaced by upload or processing time.

#### Scenario: Partial and instant dates retain their source contract

- **WHEN** the fixture matrix includes year, month, day, an explicit-offset instant, and an unknown date
- **THEN** year/month/day values remain partial or day precision without timezone conversion
- **AND** the instant retains its explicit timezone and normalized ordering instant
- **AND** an instant without an explicit timezone and invalid calendar dates are rejected
- **AND** an unknown date has no canonical clinical value

#### Scenario: Ordering is deterministic in both directions

- **WHEN** the fixture matrix sorts known and unknown events ascending and descending
- **THEN** known occurred dates appear before unknown events in both directions
- **AND** partial-date bounds, precision, event type, source ID, and event ID resolve ties deterministically
- **AND** repeating the sort with the same input produces the same order

#### Scenario: Upload time cannot become a medical date

- **WHEN** a supported timeline document has no explicit event date but has a later upload timestamp
- **THEN** its projected event date remains unknown
- **AND** the event remains source-linked and visible to the timeline contract

### Requirement: Repeated measurements are combined only when clinically compatible

The release validation SHALL prove that comparison fixtures use the same concrete measurement definition and an eligible active row as the series boundary, while retaining each point's native value, unit, reference range, laboratory, and source document. Incompatible definitions, incompatible units/specimens, unresolved rows, and ineligible rows SHALL NOT be combined into that series.

#### Scenario: Compatible multi-laboratory points remain source-preserving

- **WHEN** two synthetic laboratories provide the same reviewed concrete definition in accepted unit variants
- **THEN** both eligible points belong to one comparison series
- **AND** each point retains its original unit, reference bounds, laboratory, and source document ID
- **AND** display conversion changes presentation only and does not mutate the native fixture

#### Scenario: Explicit row specimen survives an omitted structured field

- **WHEN** a laboratory extraction row has a null or unusable structured `specimen` field but its captured row `source_text` explicitly says `Specimen: whole blood` or an equivalent supported lexical form
- **THEN** the parser SHALL preserve `whole_blood` as the row specimen
- **AND** the existing stated-axis gate SHALL verify that exact source evidence before resolution
- **AND** a row whose captured provenance does not state a specimen SHALL remain incomplete rather than receiving an inferred specimen

#### Scenario: Incompatible or incomplete rows stay out of the series

- **WHEN** fixtures contain distinct concrete definitions for similar labels, a wrong unit dimension, a specimen conflict, an unresolved row, or a row that is not trend-eligible
- **THEN** the release runner keeps those rows separate or excludes them from the compatible series
- **AND** it does not group rows by display label, analyte label, panel membership, or upload date

### Requirement: Panel membership and duplicate boundaries are release-safe

The release validation SHALL prove that all required curated panels are non-empty, ordered, composed of reviewed concrete definitions, and support intentional many-to-many membership without changing resolver or scoring behavior. Duplicate panel keys, aliases, members, and display orders SHALL be rejected. Persisted medical events and date roles SHALL remain one-to-one at their uniqueness boundaries.

#### Scenario: Curated panel membership is deterministic and many-to-many

- **WHEN** the panel fixture matrix loads the required panel keys
- **THEN** every required panel resolves to its declared ordered definition
- **AND** a deliberately shared concrete definition resolves to each intended panel in stable order
- **AND** panel lookup leaves measurement resolution, score role, readiness, and contribution groups unchanged

#### Scenario: Duplicate panel and event inputs fail safely

- **WHEN** the validation supplies duplicate panel/member/name/order records or attempts to create a second event for one source document or one date role
- **THEN** the pure validator or database uniqueness boundary rejects the duplicate
- **AND** repeated date synchronization is idempotent and does not multiply rows
- **AND** rows from another profile are not visible in the authenticated profile's timeline

### Requirement: Release evidence includes performance and truthful product sign-off

The release SHALL run a bounded pure-projection performance check at the documented synthetic volume and SHALL maintain `QA/eh-132/checklist.md` as the source of manual release evidence. Automated evidence, manual results, blocked dependencies, P0 defects, performance disposition, and product-owner sign-off SHALL remain distinct.

#### Scenario: The pure projection stays within its checked-in regression budget

- **WHEN** the runner projects the documented synthetic event volume after one warm-up run
- **THEN** every fixture event is projected
- **AND** the measured operation is within the checked-in regression budget or the command fails with the measured value
- **AND** the output identifies the volume and elapsed time without claiming an unspecified production SLA

#### Scenario: Release-volume source collection spans the backend row cap

- **WHEN** an authenticated synthetic profile contains the documented 2,000 timeline source documents
- **THEN** the timeline route SHALL collect every profile-owned source document through bounded backend pages
- **AND** the response pagination total SHALL report all 2,000 projected events rather than a truncated first backend page
- **AND** type/date filters and adjacent UI pages SHALL operate over that complete event set without an expanded source-ID request URI

#### Scenario: Unavailable interfaces or sign-off are not reported as passed

- **WHEN** the authenticated environment, panel UI, full EH-129 comparison UI, or product approver is unavailable
- **THEN** the QA checklist records the affected case as Blocked or pending with the missing evidence named
- **AND** green automated checks do not substitute for manual product sign-off or P0 defect disposition
