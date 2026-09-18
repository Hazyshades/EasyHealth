# multi-source-reports

## MODIFIED Requirements

### Requirement: Multi-source report context

Report generation SHALL build a server-owned source catalog from biomarkers, instrumental findings, consultation notes, document summaries, prescriptions, and referrals in the resolved document scope. Every context item SHALL retain its source row ID and document ID through prompt construction and parsing.

#### Scenario: Mixed source context retains identity

- **WHEN** a report includes a lab document, an instrumental report, and a consultation note
- **THEN** the generator receives structured items for all three source kinds
- **AND** each item carries an opaque source ID mapped by the server to a row and document
- **AND** the persisted report can cite those identities without relying on filenames

#### Scenario: Non-lab source remains eligible

- **WHEN** the selected scope contains accepted consultation or instrumental data but no observations
- **THEN** generation may proceed with that structured content
- **AND** missing biomarker history is represented as a limitation rather than an invented value
