## MODIFIED Requirements

### Requirement: Generated reports persist their actual source set

Every newly generated report MUST persist the exact non-null `source_document_ids` whose data was supplied to generation, separately from requested scope. Report content and summary preview are derived from that immutable source set. A report SHALL be owner-visible only while its source state is known and none of its sources is deleting or purged.

#### Scenario: Report uses labs and imaging

- **WHEN** a user generates a report from a laboratory document and an instrumental report
- **THEN** the stored source set contains both document ids actually supplied to generation
- **AND** eligibility/read logic can invalidate the report if either source is deleted

#### Scenario: Generation used fewer documents than requested

- **WHEN** requested scope contains an ineligible or unavailable document
- **THEN** the stored actual source set records only documents whose content was supplied
- **AND** requested scope remains separately auditable

### Requirement: Report deletion policy is privacy-safe and whole-report

At document tombstone, every persisted report whose actual source set contains the document MUST become immediately inaccessible and be marked for final purge. A multi-document report SHALL be invalidated as a whole; generated text MUST NOT be rewritten by removing the deleted source id.

#### Scenario: One source of a multi-document report is deleted

- **WHEN** a report contains content generated from documents A and B and A is tombstoned
- **THEN** the complete report and summary preview become inaccessible in the tombstone transaction
- **AND** final database purge deletes the report rather than preserving text derived partly from A

#### Scenario: Report API is queried during cleanup

- **WHEN** invalidated report rows remain physically present
- **THEN** report list/detail and structured context exclude them

### Requirement: Legacy source-unknown reports are conservatively invalidated

Migration MUST backfill explicit historical `document_ids` as known source sets. A legacy report with `document_ids = NULL` MUST be marked source-unknown rather than assigned invented sources. When any document in that profile is tombstoned, all source-unknown legacy reports for the profile MUST become inaccessible and be purged at final deletion.

#### Scenario: All-documents legacy report cannot prove sources

- **WHEN** a retained report has `document_ids = NULL`
- **THEN** migration marks `source_scope_known = false`
- **AND** a later deletion in that profile invalidates it conservatively

### Requirement: Report generation excludes deleting sources

Eligibility, source loading, prompt/context construction, persistence, and final response MUST revalidate that every actual source document is active. Generation MUST abort without persisting a report if a source becomes deleting before commit.

#### Scenario: Deletion races report generation

- **WHEN** a selected source is tombstoned during report generation
- **THEN** generation cannot commit a new report containing its content
- **AND** no summary preview or persisted narrative is exposed
