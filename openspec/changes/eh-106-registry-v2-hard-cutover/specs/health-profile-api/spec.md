## MODIFIED Requirements

### Requirement: Biomarker to system mapping

The server SHALL map an observation into existing body-system aggregation through the active Registry 2.0 revision only when it is resolved to a concrete measurement definition with a reviewed compatible assessment binding. The binding's assessment input key SHALL then be mapped by the existing static system configuration. The server MUST NOT use Registry v1 fallback identity to admit an observation. Partial, ambiguous, unmapped, or non-reviewed-definition observations remain factual data and do not enter definition-specific system aggregation.

#### Scenario: Resolved reviewed binding maps to a system

- **WHEN** an active resolved observation has a concrete definition with a reviewed compatible assessment binding whose input key is defined in the system mapping
- **THEN** the observation contributes to that system's existing coverage and marker list

#### Scenario: Incomplete or unreviewed observation is not admitted

- **WHEN** an active observation is partial, ambiguous, unmapped, or resolved only to a non-reviewed definition
- **THEN** it does not contribute through a definition-specific system mapping
- **AND** the API does not invent a legacy biomarker key to make it eligible

## ADDED Requirements

### Requirement: EH-106 preserves final score/readiness ownership

EH-106 SHALL not introduce a final verification-status eligibility predicate, freshness rule, null-score behavior, score-required-group change, or score explanation rule. Those requirements remain owned by EH-141 through EH-147. The Registry 2.0 binding admission in this change only replaces the legacy identity path feeding the existing aggregation.

#### Scenario: Pending active result reaches Health Profile data

- **WHEN** Health Profile encounters an active pending partial observation
- **THEN** it preserves the observation as non-concrete factual data where the existing response exposes it
- **AND** EH-106 does not use it to alter final score/readiness semantics
