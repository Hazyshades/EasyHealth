## ADDED Requirements

### Requirement: Document delete clears laboratory lineage through controlled purge

`DELETE /api/documents/:id` SHALL remove document-derived laboratory observation
lineage through the service-only controlled purge path before or as part of
document removal. The delete path SHALL NOT rely on `ON DELETE SET NULL` alone
to detach normalization revisions, and SHALL NOT leave an observation with
exactly one of `normalization_revision_id` or `source_extracted_biomarker_id`
set. Storage object cleanup for the document MAY continue to run as today.
Authorization remains owner-only for the profile's document.

#### Scenario: Owner deletes a laboratory document with accepted observations

- **WHEN** an authenticated owner deletes a laboratory document that has
  linked observations and normalization revisions
- **THEN** the API returns success only after laboratory lineage on retained
  observations is a full null pair or the observations are removed per existing
  retention rules
- **AND** no half-linked laboratory observation remains for that document

#### Scenario: Delete failure does not partially detach lineage

- **WHEN** controlled purge or document delete fails mid-operation
- **THEN** the transaction or compensating path does not commit a half-linked
  laboratory observation

#### Scenario: Unauthorized delete remains denied

- **WHEN** a caller without ownership attempts `DELETE /api/documents/:id`
- **THEN** the response is 401 or 403 and no purge runs
