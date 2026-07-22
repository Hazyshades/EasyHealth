## ADDED Requirements

### Requirement: Unit normalization precedes resolution and conversion follows it

Document processing SHALL normalize raw unit spelling and dimension before candidate selection. Numerical conversion SHALL occur only after one reviewed concrete definition with a compatible unit policy is selected.

#### Scenario: Partial result has a known unit family

- **WHEN** a unit family is recognized but concrete identity remains partial
- **THEN** the raw/normalized unit evidence is retained
- **AND** no definition-specific conversion is applied

### Requirement: Resolver evidence is structured per candidate

The resolver SHALL record accepted and rejected evidence for each candidate using stable reason codes, evidence source, strength, and observed/expected context. Human-readable text MUST be derived from the structured record.

#### Scenario: Accurate OCR remains incomplete

- **WHEN** a label and unit are extracted confidently but required specimen is missing
- **THEN** the resolver returns partial or ambiguous with explicit missing-context evidence
- **AND** extraction confidence remains independent

### Requirement: Weak context cannot override hard conflicts

Section, neighbours, and reference-range shape MAY rank compatible candidates but MUST NOT override incompatible units, value kind, specimen, timing, or method.

#### Scenario: Panel context conflicts with explicit specimen

- **WHEN** section context suggests blood but the source explicitly states urine
- **THEN** blood-only candidates remain rejected
