## ADDED Requirements

### Requirement: Expanded body systems on profile map

The Health Profile body map SHALL support systems derived from the biomarker catalog including `inflammation` and `nutrients` (replacing the vitamins label), in addition to cardiovascular, metabolic, thyroid, liver, kidney, blood, and general.

#### Scenario: Inflammation markers appear as inflammation system

- **WHEN** the user has CRP, hs-CRP, or ESR observations
- **THEN** the body map includes an inflammation system assessment when those markers are present
- **AND** does not leave those markers solely under General when cataloged

#### Scenario: Nutrients system shows vitamin markers

- **WHEN** the user has vitamin D, B12, or folate observations
- **THEN** they appear under the nutrients system on the body map

### Requirement: Core-only system state scoring

System state scores on the Health Profile SHALL be computed from catalog `core` markers with numeric lab reference ranges only, using the document’s lab ranges (not external optimal targets).

#### Scenario: Extended marker out of range does not drive equal-weight core score

- **WHEN** only an extended marker is out of lab range and all core markers are in range
- **THEN** the system state score remains based on core markers
- **AND** the extended out-of-range value may still be listed factually in the drawer

### Requirement: Coverage uses coverage-flagged markers

Data confidence for a named system SHALL use the catalog coverage set (not the full extended catalog list) so missing extended panel members do not dilute confidence.

#### Scenario: Partial CBC still reports reasonable blood confidence

- **WHEN** the user has hemoglobin, hematocrit, WBC, RBC, and platelets but no differential
- **THEN** blood data confidence is based on coverage-flagged markers present among that core set
- **AND** absence of neutrophils_abs alone does not zero coverage

### Requirement: Preferred units on profile markers

Health Profile marker displays SHALL present values and reference ranges in the user’s lab unit system preference when a safe conversion exists, without changing stored observation units.

#### Scenario: Profile drawer respects SI preference

- **WHEN** the user’s lab unit system is `si` and a marker has a conventional stored unit with a safe conversion
- **THEN** the drawer shows SI unit presentation for value and refs
- **AND** retains factual educational language (no new diagnoses)
