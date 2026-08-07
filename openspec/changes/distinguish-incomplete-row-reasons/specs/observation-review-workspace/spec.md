## MODIFIED Requirements

### Requirement: Split-view review workspace

The document review route SHALL present the source document and the extracted
or stored observations of that document side by side in a single workspace. The
document pane SHALL occupy the primary column and the observation list the
secondary rail. Both panes SHALL be reachable without leaving the route, and
neither pane SHALL require the other to be dismissed first.

The observation list summary SHALL report incomplete rows split by who can resolve them:
rows awaiting evidence from the source document, rows awaiting catalog review, and rows
rejected by a conflict. A single undifferentiated incomplete count SHALL NOT be the only
figure presented, because it merges work owed by the product with work owed by the
document. The overall total and the matched count SHALL remain available and unchanged.

Any document-level affordance that offers to improve semantics by reprocessing SHALL be
driven only by rows whose outcome could change against the deployed catalog release. Rows
awaiting catalog review SHALL NOT, on their own, present reprocessing as a remedy.

#### Scenario: Both panes are visible on open
- **WHEN** a reviewer opens a laboratory document that has extracted results
- **THEN** the document preview and the observation list are rendered together
- **AND** the observation list reports how many results are matched, incomplete
  and not verified

#### Scenario: Panel mode follows data presence
- **WHEN** the document has current extracted rows
- **THEN** the workspace lists those rows and offers the acceptance action
- **AND** when the document has no extracted rows but has linked observations
  the workspace lists the observations through the same row presentation

#### Scenario: Incomplete rows are counted by who can act
- **WHEN** a document yields rows that are incomplete for different reasons
- **THEN** the summary SHALL report the count awaiting the document and the count awaiting
  catalog review as separate figures
- **AND** their sum together with conflicted rows SHALL equal the total incomplete count

#### Scenario: Catalog-blocked rows do not offer reprocessing
- **WHEN** every incomplete row on a document is awaiting catalog review
- **THEN** the workspace SHALL NOT present reprocessing as the way to complete them
