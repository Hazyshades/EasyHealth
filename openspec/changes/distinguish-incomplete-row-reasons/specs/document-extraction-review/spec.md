## MODIFIED Requirements

### Requirement: Extraction and semantic resolution remain independent

The review UI and API SHALL present extraction confidence independently from measurement resolution. `partial`, `ambiguous`, and `unmapped` describe semantic metadata, not the reliability or clinical meaning of the reported value.

The review UI SHALL also distinguish, for every non-`resolved` row, whether the outstanding condition belongs to the source document or to catalog review. A row awaiting catalog review SHALL NOT be described in terms that imply the reviewer, the document, or the extraction is deficient.

#### Scenario: High-confidence partial ALT extraction

- **WHEN** ALT `21 U/L` has extraction confidence 90% but lacks specimen evidence
- **THEN** the UI states that ALT is recognized and concrete measurement details remain incomplete
- **AND** does not label the extraction low-confidence or require a serum/plasma guess
- **AND** names the specimen as the detail the report did not state

#### Scenario: Recognized specialty result awaits catalog review

- **WHEN** a specialty antibody result matches exactly one provisional definition with no conflict and no missing axis
- **THEN** the UI states that the measurement is recognized and awaiting catalog review
- **AND** does not attribute the incompleteness to the document or to extraction quality
- **AND** offers raw acceptance as the available action
