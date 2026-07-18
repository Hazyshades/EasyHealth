## ADDED Requirements

### Requirement: Exclude specialty display markers from organ scores

Health Profile body-map system state scores SHALL ignore specialty display-only markers (hormones, tumor markers, coagulation, acute cardiac, autoimmune) regardless of lab reference range status.

#### Scenario: Hormone panel does not tint body map systems

- **WHEN** the user only has hormone specialty observations
- **THEN** the body map does not present a scored organ assessment driven by those hormones as core wellness markers

### Requirement: Exclude non-numeric observations from organ scores

Health Profile scoring SHALL ignore qualitative, ordinal, and text-only observations when computing system state scores and coverage.

#### Scenario: Only dipstick under kidney

- **WHEN** kidney-related data is only qualitative urine dipstick
- **THEN** the profile does not produce a kidney state score from those rows alone as if they were numeric core labs

### Requirement: Educational language for specialty values if shown

If specialty or qualitative values appear in profile-adjacent UI, the system SHALL use factual educational language and MUST NOT present diagnostic or risk labels as conclusions.

#### Scenario: No disease label from tumor marker

- **WHEN** a tumor marker is visible in any profile-related factual list
- **THEN** the UI does not label the user with a cancer diagnosis or risk grade from that marker alone
