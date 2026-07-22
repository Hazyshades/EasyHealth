## ADDED Requirements

### Requirement: Manual corrections are append-only and reversible

Manual verification, correction, or undo SHALL create a normalization revision with actor, timestamp, selected definition, evidence, and supersession links. Prior decisions MUST NOT be deleted or overwritten.

#### Scenario: Correction is undone

- **WHEN** a user undoes an active correction
- **THEN** a reversal/promotion revision is created and history remains intact

### Requirement: Correction choices respect hard evidence

The standard review UI SHALL offer only candidates compatible with explicit value kind, unit, specimen, timing, and method evidence. It MUST NOT force a mapping for partial or unmapped results.

#### Scenario: Specimen is absent

- **WHEN** serum and plasma definitions are candidates but the report states neither
- **THEN** ordinary acceptance remains available without choosing either specimen

### Requirement: Reprocessing preserves manual decisions

Reprocessing SHALL NOT automatically supersede an active user-verified or manually-corrected revision. A newer result MAY be retained as an inactive candidate for review.

#### Scenario: New release disagrees with manual mapping

- **WHEN** a candidate release selects a different definition
- **THEN** the existing manual revision remains active

### Requirement: Review UI separates extraction and mapping certainty

The UI SHALL display resolver state, confidence band, evidence, release versions, and revision relationship without presenting mapping confidence as extraction or clinical certainty.

#### Scenario: Partial specialty result is reviewed

- **WHEN** a specialty result is recognized but incomplete
- **THEN** the UI explains missing metadata and permits raw acceptance
- **AND** does not imply that the printed result itself is invalid
