## MODIFIED Requirements

### Requirement: Document selection modal

The create page SHALL provide a **Select documents** control opening a modal to choose which uploaded records to include, with an optional abnormal-only setting. Eligible documents include completed labs with observations and completed instrumental or consultation documents with accepted structured extractions.

#### Scenario: No eligible documents

- **WHEN** the user has no eligible documents (no observations and no accepted non-lab structured data)
- **THEN** the Select documents control is disabled
- **AND** the Create report submit button is disabled

#### Scenario: Eligible instrumental document shown

- **WHEN** the user opens the document selection modal and has a completed instrumental report with accepted findings
- **THEN** the document appears in the selectable list with its filename and document type label in English

#### Scenario: Abnormal-only toggle

- **WHEN** the user opens the document selection modal
- **THEN** an **Additional settings** section offers **Include only out-of-range indicators**
- **AND** helper text clarifies that non-lab record content is still included when this option is enabled
- **AND** the chosen value is sent as `abnormal_only` on report creation

## ADDED Requirements

### Requirement: Multi-source report copy

The create report page SHALL describe that reports synthesize lab results, imaging reports, and consultation notes when selected.

#### Scenario: Create page helper text

- **WHEN** the user opens `/app/reports/create`
- **THEN** helper copy in English explains that reports can include labs, imaging studies, and consultations

### Requirement: Document type labels in modal

The document selection modal SHALL display each document's type label (Lab results, Imaging study, Consultation) in English.

#### Scenario: Mixed types in modal

- **WHEN** the modal lists documents of multiple types
- **THEN** each row shows the appropriate English type label
