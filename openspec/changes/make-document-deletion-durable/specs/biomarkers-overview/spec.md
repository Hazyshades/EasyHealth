## MODIFIED Requirements

### Requirement: Biomarker overview reads active document evidence only

The Biomarkers API and page MUST exclude document-derived observations whose source document is `deleting` or absent. This filter MUST apply in the service-role database query before normalization projection, eligibility selection, grouping, or response serialization.

#### Scenario: Source document is tombstoned

- **WHEN** deletion of a laboratory document is accepted while its observations remain physically present during cleanup
- **THEN** Biomarkers no longer returns those observations
- **AND** no normalization-revision embed or client-side grouping can reintroduce them

#### Scenario: Deletion races overview read

- **WHEN** the read locks/queries before tombstone commit
- **THEN** it may return the pre-deletion active view
- **AND** every read started after tombstone commit excludes the document evidence
