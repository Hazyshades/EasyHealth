## ADDED Requirements

### Requirement: The printed section heading SHALL be captured verbatim

Laboratory extraction SHALL capture, for each extracted row, the section heading the row was printed under, stored verbatim as it appears in the document. The captured heading SHALL be a transcription, not a summary, translation, normalization or classification, so that it can be checked against the page text. When a row is printed under no heading, the field SHALL be empty rather than filled with an inferred panel name.

#### Scenario: Heading is transcribed as printed

- **WHEN** a row is printed under `Complete blood count with manual smear microscopy + ESR`
- **THEN** the stored section heading is that string as printed
- **AND** it is not shortened to `CBC` or otherwise rewritten

#### Scenario: Rows without a heading store nothing

- **WHEN** a row appears outside any titled section
- **THEN** the stored section heading is empty
- **AND** no panel name is inferred for it

#### Scenario: A heading is not a specimen claim

- **WHEN** a heading is captured
- **THEN** it carries no specimen by itself
- **AND** a specimen may follow only from a reviewed panel policy that matches it

### Requirement: Captured headings SHALL be verifiable against page text

A captured section heading SHALL be checkable against the stored page text for the row's page. The system SHALL provide a check that reports headings which do not occur in the page text, so a fabricated or paraphrased heading is detectable without re-running extraction.

#### Scenario: Fabricated heading is detected

- **WHEN** a stored section heading does not occur in the page text for that row's page
- **THEN** the check reports the row and the heading

#### Scenario: Transcribed heading passes

- **WHEN** every stored heading occurs in its page text
- **THEN** the check passes
