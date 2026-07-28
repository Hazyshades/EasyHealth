## MODIFIED Requirements

### Requirement: Source extraction lineage recorded, final identity deferred to EH-105

EH-103 SHALL record the immutable `source_extracted_biomarker_id` lineage on every accepted observation and SHALL retain nullable analyte and measurement-definition links. The final replacement of the legacy `biomarker_key` persistence identity and the legacy composite `(profile_id, biomarker_key, observed_at, specimen, modifier)` uniqueness constraint is owned by EH-105 and is out of scope for EH-103. EH-103 SHALL NOT enforce a composite uniqueness constraint that would require a synthetic `biomarker_key` for partial or unmapped observations.

#### Scenario: Source lineage is recorded

- **WHEN** a user accepts an extracted biomarker
- **THEN** the observation stores the `source_extracted_biomarker_id` linkage
- **AND** nullable analyte and measurement-definition links are recorded when available

#### Scenario: Partial result has no concrete identity

- **WHEN** a result is accepted in a partial or unmapped state
- **THEN** the observation stores the source lineage and null semantic links
- **AND** no synthetic `biomarker_key` is required

#### Scenario: Distinct source rows are not collapsed

- **WHEN** two accepted rows share analyte and time but differ in source extraction identity
- **THEN** both are stored as separate observations
- **AND** the final identity/uniqueness cutover remains with EH-105
