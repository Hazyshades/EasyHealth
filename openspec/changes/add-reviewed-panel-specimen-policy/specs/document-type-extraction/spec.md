## ADDED Requirements

### Requirement: Lab extraction SHALL transcribe the section heading

The laboratory extraction contract SHALL include a field for the section heading a row was printed under, and the prompt SHALL instruct the model to transcribe that heading exactly as printed. The instruction SHALL distinguish transcription from classification: the model records the words on the page and does not decide what panel or specimen they represent.

#### Scenario: Prompt asks for the printed heading

- **WHEN** the laboratory extraction prompt is issued
- **THEN** it requests the section heading as printed for each row

#### Scenario: Model must not classify

- **WHEN** a section is printed as `Complete blood count with manual smear microscopy + ESR`
- **THEN** the model returns that text
- **AND** does not substitute a panel code, a specimen, or a normalized category

#### Scenario: Heading transcription does not reopen specimen inference

- **WHEN** the heading field is added to the contract
- **THEN** the existing instruction forbidding inferred specimen remains in force
- **AND** the model still emits a specimen only when the document states one
