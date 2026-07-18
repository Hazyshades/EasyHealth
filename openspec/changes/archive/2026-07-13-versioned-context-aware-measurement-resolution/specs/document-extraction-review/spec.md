## ADDED Requirements

### Requirement: Review of measurement resolution
The extraction review surface SHALL show resolver result, proposed measurement definition, mapping confidence, and relevant raw evidence for extracted laboratory rows.

#### Scenario: User verifies an unambiguous mapping
- **WHEN** a user accepts a resolved extracted row without changing its measurement definition
- **THEN** the promoted normalization revision is marked `user_verified`
- **AND** its raw evidence and resolver metadata remain available

#### Scenario: User manually corrects a mapping
- **WHEN** a user selects a different allowed measurement definition for an ambiguous or incorrect candidate
- **THEN** the system creates a new normalization revision marked `manually_corrected`
- **AND** the previous candidate remains preserved for audit

### Requirement: Controlled revision promotion
The acceptance path SHALL materialize an active observation only from a promoted, resolved, assessment-compatible normalization revision or an explicitly supported legacy compatibility path.

#### Scenario: Ambiguous row is not accepted into assessment data
- **WHEN** an extracted row remains ambiguous or unmapped
- **THEN** accepting other rows from the document SHALL NOT materialize it as an assessment observation
- **AND** the row remains factual review data
