## MODIFIED Requirements

### Requirement: Instrumental findings staging table

The system SHALL persist instrumental findings and impression as immutable children of one instrumental snapshot-content version, linked by composite ownership `(snapshot_content_id, profile_id, document_id)` and carrying deterministic source locator or ordinal, modality/body region, source page/text, confidence, extraction metadata, and prepared/publication visibility. Document-only linkage or accepted status SHALL NOT determine current visibility.

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

### Requirement: Legacy findings relation is a current-only security-invoker view

While old readers exist, the system MUST rename physical findings storage to `document_extracted_finding_versions` linked by composite ownership FK `(snapshot_content_id, profile_id, document_id)` with `ON DELETE RESTRICT` and MUST recreate `document_extracted_findings` as a PostgreSQL view `WITH (security_invoker = true)` that projects the legacy columns from the authoritative current-publication pointer only. The view MUST grant `SELECT` only to `service_role`, MUST revoke DML on the view and versioned table from runtime roles, and MUST preserve cross-profile isolation through pointer ownership keys.

#### Scenario: Historical accepted findings exist

- **WHEN** current, superseded, and prepared publications all have findings with accepted publication semantics
- **THEN** an old reader querying `document_extracted_findings` receives only the current publication's rows
- **AND** no status-only query can mix versions

#### Scenario: Findings migration occurs

- **WHEN** the physical legacy table is renamed and replaced by the security-invoker view
- **THEN** old instrumental workers have already been drained
- **AND** document detail, report eligibility, and structured context retain their current findings until reader cutover

#### Scenario: Cross-profile isolation through the view

- **WHEN** a service query or PostgREST request asks for findings of profile A
- **THEN** no finding belonging only to profile B's current publication is returned
- **AND** direct DML against the compatibility view is denied

### Requirement: Document-level current projections equal the current publication

At finalizer commit the document columns `document_summary`, `observed_at`, `modality`, `lab_name` (equal to current content.`facility_name`), `processing_version`, and `extraction_model` MUST equal the authoritative current publication content/summary, and legacy measure `is_current` flags plus the findings view MUST equal that same current content. Any finalizer failure MUST leave every projection unchanged.

#### Scenario: Finalizer commits a replacement

- **WHEN** atomic finalization publishes content B over content A
- **THEN** all six document projections, measure `is_current` flags, and findings-view rows equal publication B after commit


#### Scenario: Facility label projects into lab_name

- **WHEN** current immutable content has `facility_name = 'City Imaging'`
- **THEN** `documents.lab_name` equals `City Imaging` after finalizer commit
- **AND** a later content version with different `facility_name` updates `lab_name` only in that finalizer transaction

#### Scenario: Finalizer rolls back

- **WHEN** any finalizer step fails after preparing content B
- **THEN** all six document projections and compatibility reads continue to equal publication A

### Requirement: Structured readers use the authoritative current publication

Document detail, reports, and structured context MUST join instrumental measures/findings/impression/summary through the authoritative current-publication pointer and MUST omit prepared, superseded, and abandoned publication children by default.

#### Scenario: Failed replacement remains prepared

- **WHEN** a replacement publication fails before commit
- **THEN** every structured reader continues to return the previous current measures, findings, impression, and summary as one coherent version

#### Scenario: Publication commits

- **WHEN** the finalizer commits a replacement
- **THEN** every structured reader observes the new coherent version after commit
- **AND** no reader observes a mix of old findings and new measures or summary
