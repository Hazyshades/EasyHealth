## MODIFIED Requirements

### Requirement: Manual corrections are append-only and reversible

Manual verification, correction, or undo SHALL create a normalization revision with actor, timestamp, selected definition, persisted decision evidence, input evidence hash, input identity-format version when available, and supersession links. Prior decisions MUST NOT be deleted or overwritten. An undo/reversal SHALL restore the selected revision's saved decision contract and SHALL NOT reinterpret it through current evidence-admission or Resolver policy.

#### Scenario: Correction is undone

- **WHEN** a user undoes an active correction by selecting a prior revision from the same extracted source
- **THEN** a reversal/promotion revision SHALL be created and history SHALL remain intact
- **AND** the new revision SHALL copy the selected revision's saved evidence, input hash, identity-format version, decision trace, and release metadata
- **AND** the reversal path SHALL not call the current Resolver or panel-specimen policy

#### Scenario: Invalid reversal target is rejected

- **WHEN** an undo target is not part of the current extracted source or cannot provide the saved decision contract
- **THEN** the reversal SHALL fail without creating a revision or changing the active observation projection
