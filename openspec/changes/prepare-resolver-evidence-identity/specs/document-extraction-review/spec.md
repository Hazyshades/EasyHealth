## MODIFIED Requirements

### Requirement: Review preview uses shared prepared evidence

The review adapter SHALL translate extracted rows into the shared prepared
evidence contract before any prospective Resolver preview or manual-option
evaluation. It SHALL preserve the same override, stated-axis, policy-context,
and identity semantics as the normalization writer. Active persisted decisions
remain subject to the separate historical-read authority contract and SHALL
not be reconstructed by this preview path.

#### Scenario: Review and writer previews remain equivalent

- **WHEN** review and writer adapters receive equivalent extracted evidence and
  the same measurement override
- **THEN** both SHALL produce equivalent prepared evidence and policy context
- **AND** any prospective Resolver evaluation SHALL consume that same record

#### Scenario: Ambiguous review policy remains incomplete

- **WHEN** review preparation finds multiple applicable panel policies
- **THEN** the preview SHALL retain `conflict` context
- **AND** it SHALL not present a policy-derived concrete mapping as resolved

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
