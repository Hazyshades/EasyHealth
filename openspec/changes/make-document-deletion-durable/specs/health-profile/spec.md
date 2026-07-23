## MODIFIED Requirements

### Requirement: Health Profile uses active source documents

Health Profile source lists, laboratory observations, deterministic presentation, and provenance MUST exclude documents in `deleting` state and document-derived rows whose source document is deleting or absent. Service-role queries MUST enforce this boundary before projection.

#### Scenario: Laboratory source enters deletion

- **WHEN** a laboratory document is tombstoned but its observations remain during asynchronous cleanup
- **THEN** Health Profile omits the document and its observations immediately after commit
- **AND** no source filename, clinical value, or normalization result from it is returned

#### Scenario: Source is hard purged

- **WHEN** final database purge removes the document and derived rows
- **THEN** Health Profile remains semantically unchanged from its tombstoned view
