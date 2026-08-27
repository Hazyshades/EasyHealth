## MODIFIED Requirements

### Requirement: Raw result and provenance visibility
The system SHALL preserve and expose raw laboratory evidence independently of semantic resolution. For every outcome, the document review surface SHALL retain the source label, raw value text or numeric value, raw and normalized unit where present, raw reference range, specimen, modifier, page/source text, extraction confidence, extraction model/version, and stable extracted-row identity available from the existing provenance contract.

The Health Profile reported-results projection SHALL use the same current-row lineage and SHALL link to the authenticated document review surface rather than replacing raw evidence with a profile-specific inferred record. The document review UI SHALL render raw evidence before mapping explanation and SHALL NOT replace an incomplete raw result with a candidate display name, converted value, inferred unit, inferred specimen, or inferred reference range. Specimen, modifier, and method SHALL be rendered only when the source document stated them; the stored `unspecified` and `none` defaults SHALL NOT be rendered as reported evidence. The same raw-evidence block SHALL be used for extracted rows and for the observations-only recovery list, and the per-document observations read SHALL therefore expose extraction confidence.

#### Scenario: Unmapped row remains visible from the profile recovery entry point
- **WHEN** no authorized Registry 2.0 candidate matches a laboratory row and the Health Profile summary links to its document
- **THEN** the document review surface shows the original result and provenance with `Measurement not recognized`
- **AND** the profile summary does not present a candidate key as the row's confirmed identity

#### Scenario: Partial row keeps missing context visible
- **WHEN** a recognized row is partial because a required unit, value kind, specimen, modifier, timing, or method is missing
- **THEN** the UI preserves the raw result and lists the missing context without claiming compatibility or conflict
- **AND** the row remains excluded from Health Profile scoring

#### Scenario: Ambiguous row does not choose a display identity
- **WHEN** multiple reviewed candidates remain admissible
- **THEN** the UI shows `Multiple possible matches`, preserves the source result, and SHALL NOT render one candidate as the confirmed measurement

#### Scenario: Unstated axes are not presented as evidence
- **WHEN** a stored row carries the default `unspecified` specimen and `none` modifier
- **THEN** the UI omits those axes instead of presenting them as reported values

#### Scenario: Recovery list renders the same raw evidence
- **WHEN** the document has no current extracted rows and linked observations are listed instead
- **THEN** each observation shows the same reported name, value, reference range, provenance, and extraction confidence as an extracted row
- **AND** a Health Profile recovery link opens that source document without changing the observation's raw values
