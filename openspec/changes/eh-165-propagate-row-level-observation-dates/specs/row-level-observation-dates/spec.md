## ADDED Requirements

### Requirement: Observation day comes from the extracted row first

When promoting an extracted laboratory row to an observation, the system SHALL set `observations.observed_at` from a day-precision `document_extracted_biomarkers.collected_at` when present. If that value is missing or not a complete calendar day, the system SHALL use the document's day-precision `observed_at`. If neither is a complete calendar day, `observations.observed_at` SHALL be null. The system SHALL NOT substitute the current day.

#### Scenario: Two dated glucose columns become two observations

- **WHEN** a document contains glucose collected on `2023-01-10` and glucose collected on `2026-01-08`
- **AND** a reviewer accepts both extracted rows
- **THEN** two observations exist with `observed_at` `2023-01-10` and `2026-01-08`

#### Scenario: Undated column falls back to the document day

- **WHEN** an extracted row has no day-precision `collected_at`
- **AND** the document has `observed_at` `2026-03-04`
- **THEN** the promoted observation uses `2026-03-04`

#### Scenario: Missing dates stay null rather than today

- **WHEN** both the extracted row `collected_at` and the document `observed_at` are null or only year/month precision
- **THEN** the promoted observation has `observed_at` null
- **AND** the write does not use the current calendar day

#### Scenario: Same marker on the same day still upserts

- **WHEN** two extracted rows share analyte identity, specimen, modifier, and the same observation day
- **THEN** uniqueness still upserts them onto one observation

#### Scenario: EH-119 date override still wins

- **WHEN** a reviewer restates `observed_at` through a measurement override
- **THEN** the stored observation day is the override day, not the extracted or document fallback

### Requirement: Writer paths load and apply row collected dates

Every path that writes an observation from an extracted laboratory row SHALL load `collected_at` and SHALL apply the row-first day helper. Those paths include accept, confirm, PATCH correction, batch verification, Registry reprocessing, and automatic verification.

#### Scenario: Accept does not stamp the document date onto dated rows

- **WHEN** `POST /api/documents/:id/biomarkers/accept` promotes a row with `collected_at` `2024-05-01` and document `observed_at` `2026-01-08`
- **THEN** the observation is stored with `2024-05-01`

#### Scenario: Automatic verification uses the inserted row date

- **WHEN** automatic verification runs on a newly inserted extracted row that has a day-precision `collected_at`
- **THEN** the promoted observation uses that collected day rather than the document-level extraction date

### Requirement: History tables extract one candidate per dated cell

Laboratory extraction SHALL emit a separate biomarker candidate for each printed value that belongs to a distinct collected date, including dates taken from column headers. A value whose column has no date SHALL keep `collected_at` null. Extraction SHALL NOT collapse several dated cells of the same analyte into one candidate.

#### Scenario: One analyte across three dated columns

- **WHEN** a table shows one analyte and three columns dated `2023-01-10`, `2024-01-09`, and `2026-01-08`
- **THEN** parsing yields three candidates with those `collected_at` values

#### Scenario: Three analytes across three dated columns

- **WHEN** a table shows three analytes and three dated columns
- **THEN** parsing yields nine candidates, each pairing one analyte with one column date

#### Scenario: Header-only dates apply to the column

- **WHEN** dates appear only in column headers
- **THEN** each candidate under that column receives the header date as `collected_at`

#### Scenario: Column without a date stays null

- **WHEN** a value sits in a column that has no date
- **THEN** that candidate's `collected_at` is null

### Requirement: Collapsed historical observations are not silently deleted

Re-accepting a document after row-level dates are available SHALL create correctly dated observations and SHALL NOT automatically delete an observation that previously collapsed several years onto the document date.

#### Scenario: Re-accept leaves the old collapsed row

- **WHEN** an observation already exists on the document day from a previous collapse
- **AND** the reviewer accepts the newly dated extracted rows
- **THEN** the new dated observations are created or upserted by their own days
- **AND** the previously collapsed observation remains until a human uses the existing correction or deletion workflow
