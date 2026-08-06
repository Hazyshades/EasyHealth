## MODIFIED Requirements

### Requirement: Medical safety in extraction prompts

All extraction system prompts SHALL instruct the model to use educational language, cite source document dates and values, and avoid generating new clinical diagnoses or treatment plans.

Laboratory extraction prompts SHALL additionally instruct the model to emit a clinical axis — specimen, modifier, method or timing — only when the document explicitly states it, and SHALL forbid inferring it from the analyte label or from which specimen the test is usually measured in. The instruction SHALL cover specimen with the same force it already covers method. Prompt wording alone SHALL NOT be relied on as the enforcement mechanism; it reduces fabrication at the source while the storage and projection boundaries enforce it.

#### Scenario: Extraction output safety

- **WHEN** any type-specific extraction completes
- **THEN** stored structured fields reflect document content only
- **AND** processing does not write PHI on-chain

#### Scenario: Specimen is not inferred from the analyte

- **WHEN** a laboratory report lists a test that is conventionally measured in serum, without stating a specimen anywhere
- **THEN** the extraction output does not assert a specimen for that row

#### Scenario: Prompt instruction is not the only guard

- **WHEN** an extraction model ignores the instruction and returns an unstated specimen
- **THEN** the storage boundary records the axis as unspecified
- **AND** the resolver input projection presents the axis as absent
