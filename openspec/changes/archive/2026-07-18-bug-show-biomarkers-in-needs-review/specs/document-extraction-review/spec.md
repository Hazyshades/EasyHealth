## ADDED Requirements

### Requirement: Needs-review biomarkers remain visible and actionable

For a lab document whose processing status is `needs_review`, the system SHALL display the available document-linked biomarkers and SHALL provide a confirmation action whenever at least one actionable biomarker is present. Current extracted biomarkers SHALL use the existing selection and acceptance flow. When there are no current extracted biomarkers but linked observations exist, the system SHALL display those observations and provide a distinct recovery confirmation that acknowledges them without inserting or duplicating observation rows.

#### Scenario: Reviewable extracted biomarkers are available

- **WHEN** a user opens a `needs_review` lab document with current extracted biomarkers in `needs_review` or `pending_review`
- **THEN** the panel lists those extracted biomarkers with selection controls
- **AND** the confirmation action is visible and accepts the selected extracted biomarker IDs through the existing accept flow

#### Scenario: Only linked observations are available

- **WHEN** a user opens a `needs_review` lab document with no current extracted biomarkers and one or more observations linked by `document_id`
- **THEN** the panel lists the linked observations instead of rendering an empty extracted list
- **AND** the panel identifies them as already stored biomarker results
- **AND** a recovery confirmation action is visible

#### Scenario: No biomarkers are available for review

- **WHEN** a user opens a `needs_review` lab document with neither current extracted biomarkers nor linked observations
- **THEN** the panel shows an explicit inconsistency message and an available recovery action such as reprocess
- **AND** the panel does not show an enabled confirmation action

### Requirement: Observations-only confirmation is guarded and non-duplicating

The system MUST allow observations-only review confirmation only for the authenticated owner, only while the document is `needs_review`, only when the submitted observations belong to that document and profile, and only when no current reviewable extracted biomarkers exist. Successful confirmation SHALL transition the document to its completed/ready state without inserting, upserting, or rewriting observations.

#### Scenario: Owner confirms observations-only recovery state

- **WHEN** the authenticated owner confirms the linked observations for a `needs_review` document with no current reviewable extracted biomarkers
- **THEN** the server validates every observation against the document and profile
- **AND** leaves the observation rows unchanged
- **AND** transitions the document from `needs_review` to `ready`/completed

#### Scenario: Current extracted candidates appeared before recovery confirmation

- **WHEN** an observations-only confirmation request is received after current reviewable extracted biomarkers have become available
- **THEN** the server rejects the recovery confirmation
- **AND** leaves the document in `needs_review`
- **AND** requires confirmation through the extracted-biomarker accept flow

#### Scenario: Observation does not belong to the document

- **WHEN** an observations-only confirmation request contains an observation not owned by the authenticated profile or not linked to the target document
- **THEN** the server rejects the request
- **AND** does not change document or observation state

### Requirement: Review data failures are not represented as empty success

The document detail API and viewer MUST distinguish a successful empty extracted-biomarker query from a database or schema error. A query failure SHALL be surfaced as an actionable review-data error and MUST NOT authorize observations-only confirmation.

#### Scenario: Extracted biomarker query fails

- **WHEN** loading current extracted biomarkers fails while the document is `needs_review`
- **THEN** the bootstrap response or viewer surfaces a review-data error
- **AND** does not silently treat the failure as an empty extracted collection
- **AND** disables confirmation until the server can validate the review state

