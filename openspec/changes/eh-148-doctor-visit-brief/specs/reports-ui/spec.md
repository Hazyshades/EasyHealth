# reports-ui

## MODIFIED Requirements

### Requirement: Report detail page

The report detail page SHALL render a versioned Doctor Visit Brief from typed sections, including metadata, limitations, citations, source snapshots, and the medical disclaimer. It SHALL render legacy content separately and SHALL NOT create citations from filenames alone.

#### Scenario: Validated brief is displayed

- **WHEN** a signed-in user opens a validated report belonging to the profile
- **THEN** the page displays the report sections and generated-at metadata
- **AND** factual items expose their source references and relevant value/range snapshots
- **AND** no raw storage path or unrelated document appears

#### Scenario: Limitation is visible

- **WHEN** a brief has an unavailable or insufficient evidence limitation
- **THEN** the limitation is displayed in the relevant section or limitation block
- **AND** the page does not substitute a confident trend or clinical instruction

#### Scenario: Legacy content is identified

- **WHEN** a user opens an unversioned legacy report
- **THEN** the existing content remains readable
- **AND** the page indicates that source-grounded share/export is unavailable for that report
