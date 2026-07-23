## MODIFIED Requirements

### Requirement: Instrumental findings staging table

The system SHALL persist instrumental findings and impression as immutable children of one instrumental snapshot-content version, linked to the source document/profile and carrying deterministic source locator or ordinal, modality/body region, source page/text, confidence, extraction metadata, and prepared/publication visibility. Document-only linkage or accepted status SHALL NOT determine current visibility.

#### Scenario: Finding row is prepared

- **WHEN** instrumental extraction produces one or more findings or an impression
- **THEN** the rows are stored under the exact immutable prepared snapshot content
- **AND** normal document, report, and structured-context readers continue to see only the prior current publication

#### Scenario: Content is republished

- **WHEN** `A → B → A` republishes previously stored exact content A
- **THEN** the publication reuses A's immutable findings/impression
- **AND** publication history identifies the newly current event

### Requirement: Auto-accept non-lab structured data

Instrumental findings SHALL require no user acceptance action but SHALL become accepted/visible only when their prepared publication atomically becomes current. Clinical notes MAY continue to become accepted immediately after their successful extraction according to their existing processing boundary.

#### Scenario: Instrumental finding is finalized

- **WHEN** atomic instrumental finalization commits
- **THEN** that publication's findings/impression are accepted and visible without an accept API call
- **AND** the previous publication's findings become superseded in the same commit

#### Scenario: Instrumental finalization fails

- **WHEN** findings are prepared but summary or finalization fails
- **THEN** prepared findings do not appear in viewer, reports, or structured context

#### Scenario: Lab biomarkers still require review

- **WHEN** lab biomarker extraction succeeds
- **THEN** biomarker rows remain `needs_review` until the user accepts them through the existing flow

## ADDED Requirements

### Requirement: Legacy findings relation is current-only during cutover

While old readers exist, `document_extracted_findings` MUST retain its existing read columns and MUST return only findings belonging to the authoritative current publication. Immutable historical findings SHALL live behind the versioned content relation; old workers MUST NOT write through the compatibility relation.

#### Scenario: Historical accepted findings exist

- **WHEN** current, superseded, and prepared publications all have findings with accepted publication semantics
- **THEN** an old reader querying `document_extracted_findings` receives only the current publication's rows
- **AND** no status-only query can mix versions

#### Scenario: Findings migration occurs

- **WHEN** the physical legacy table is converted to versioned storage plus a compatibility relation
- **THEN** old instrumental workers have already been drained
- **AND** document detail, report eligibility, and structured context retain their current findings until reader cutover

### Requirement: Structured readers use the authoritative current publication

Document detail, reports, and structured context MUST join instrumental measures/findings/impression/summary through the authoritative current-publication pointer and MUST omit prepared, superseded, and abandoned publication children by default.

#### Scenario: Failed replacement remains prepared

- **WHEN** a replacement publication fails before commit
- **THEN** every structured reader continues to return the previous current measures, findings, impression, and summary as one coherent version

#### Scenario: Publication commits

- **WHEN** the finalizer commits a replacement
- **THEN** every structured reader observes the new coherent version after commit
- **AND** no reader observes a mix of old findings and new measures or summary
