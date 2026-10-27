# structured-assistant-retrieval Specification

## ADDED Requirements

### Requirement: Structured retrieval is profile-scoped and verified-only

Structured assistant retrieval SHALL use the current session profile and SHALL include only active, upload-complete, processed documents and accepted structured rows that pass the existing current-source and `structuredContextEligible` boundary. The service SHALL reject client-supplied profile identifiers.

#### Scenario: Active accepted observation

- **WHEN** an invited user asks about an accepted current laboratory observation in an active processed document
- **THEN** the observation can be returned as a `verified_structured` source with its document identifier and observation date

#### Scenario: Unreviewed extracted row

- **WHEN** a matching value exists only in `document_extracted_biomarkers` with a review status that is not accepted or auto-accepted
- **THEN** structured retrieval excludes it
- **AND** the assistant does not present it as a verified personal fact

#### Scenario: Archived document

- **WHEN** a source document is archived, deleting, or not upload-complete
- **THEN** its structured rows are excluded from retrieval

### Requirement: Structured retrieval supports bounded filters

The server SHALL support optional measurement, document-type, and inclusive date filters. Filters SHALL be validated, intersected with the active profile scope, and bounded by a server-side source limit before any model call.

#### Scenario: Date-bounded measurement question

- **WHEN** a request includes a valid date range and measurement filter
- **THEN** only eligible sources matching both filters are returned
- **AND** the source payload preserves the recorded date and unit

#### Scenario: Invalid filter

- **WHEN** a request contains an invalid date, document type, or oversized filter
- **THEN** the API returns a validation error without querying another profile or calling an LLM

### Requirement: Structured sources preserve provenance

Each structured source SHALL include an opaque source identifier, source row identifier, document identifier, document type, display filename, recorded date where available, a bounded factual payload, and a stable document route. The client SHALL not receive internal authorization-only rows that are not needed to render evidence.

#### Scenario: Source citation

- **WHEN** the assistant returns a claim based on a structured source
- **THEN** the response includes a citation that opens the owning document route
- **AND** the citation identifies the source type and recorded date when available

### Requirement: Retrieval never mutates health data

Assistant retrieval and answer generation SHALL be read-only. The assistant SHALL not accept, reject, correct, normalize, archive, or delete documents, extracted rows, observations, or medical events.

#### Scenario: Unsafe tool request

- **WHEN** an assistant request asks to change a laboratory result or medication record
- **THEN** the assistant returns a safety limitation
- **AND** no write RPC or mutation route is called
