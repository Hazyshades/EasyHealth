## ADDED Requirements

### Requirement: Extraction and semantic resolution remain independent

The review UI and API SHALL present extraction confidence independently from measurement resolution. `partial`, `ambiguous`, and `unmapped` describe semantic metadata, not the reliability or clinical meaning of the reported value.

#### Scenario: High-confidence partial ALT extraction

- **WHEN** ALT `21 U/L` has extraction confidence 90% but lacks specimen evidence
- **THEN** the UI states that ALT is recognized and concrete measurement details remain incomplete
- **AND** does not label the extraction low-confidence or require a serum/plasma guess

### Requirement: Every extracted result can retain raw evidence

An authenticated user SHALL be able to accept a resolved, ambiguous, partial, or unmapped result for raw recordkeeping. Acceptance SHALL preserve the source row and raw evidence. A concrete measurement-definition link SHALL be written only for resolved results, and an analyte link MAY be written for partial results when recognition is supported.

#### Scenario: Unmapped specialty result is accepted

- **WHEN** a user accepts a result that is still unmapped
- **THEN** the observation retains raw label, value, unit, source, and resolution status
- **AND** no synthetic analyte or measurement-definition identifier is fabricated

#### Scenario: Partial result is accepted

- **WHEN** a known analyte lacks enough evidence for one concrete definition
- **THEN** acceptance may store the supported analyte identity and candidate revision evidence
- **AND** excludes the row from definition-specific trends and assessment

### Requirement: Technical mapping controls use progressive disclosure

The ordinary review action SHALL not require registry, resolver, specimen, or candidate knowledge. Candidate evidence, versions, manual mapping, and correction history SHALL be available under optional technical details. Manual correction MUST require source evidence and MUST NOT encourage selection of an unstated specimen.

#### Scenario: Sample antibody result has missing specimen

- **WHEN** a reviewer sees a recognized qualitative antibody result without specimen evidence
- **THEN** the primary UI permits raw acceptance without a mapping decision
- **AND** any manual specimen-specific options remain inside technical review with an evidence warning

### Requirement: Reprocessing can improve semantics without changing raw evidence

Registry or resolver updates SHALL create append-only normalization revisions for previously partial or unmapped observations. Raw extraction evidence SHALL remain immutable, and a newer reviewed definition MAY become active only through the normal verification/promotion policy.

#### Scenario: Specialty definition is reviewed later

- **WHEN** a later registry release adds a reviewed definition matching a previously partial antibody result
- **THEN** reprocessing records a new candidate revision
- **AND** the prior raw evidence and resolution history remain auditable
