## ADDED Requirements

### Requirement: Biomarker panel selects the best available source by data presence

The lab document viewer SHALL choose the right-panel biomarker source from the data actually returned by the bootstrap response, not from processing status alone. Current extracted biomarkers SHALL take precedence; linked observations SHALL be the fallback; an explicit empty or error state SHALL be used when neither source is available. The panel title and actions SHALL match the selected source mode.

#### Scenario: Extracted biomarkers take precedence

- **WHEN** the bootstrap response contains both current extracted biomarkers and linked observations
- **THEN** the panel displays the current extracted biomarkers
- **AND** exposes review controls appropriate to their statuses

#### Scenario: Observations provide fallback during needs review

- **WHEN** the bootstrap response has an empty current extracted biomarker collection, contains linked observations, and reports `needs_review`
- **THEN** the panel displays the linked observations
- **AND** does not render an empty `extracted_biomarkers` list merely because of the document status
- **AND** exposes the guarded observations-only confirmation mode

#### Scenario: Ready document displays linked observations

- **WHEN** a ready lab document has linked observations and no current extracted biomarkers
- **THEN** the panel displays the linked observations without review confirmation controls

#### Scenario: Review state changes after confirmation

- **WHEN** confirmation succeeds in either extracted or observations-only mode
- **THEN** the viewer refreshes its bootstrap data without blanking the document preview
- **AND** reflects the resulting biomarker rows, actions, and document status consistently

