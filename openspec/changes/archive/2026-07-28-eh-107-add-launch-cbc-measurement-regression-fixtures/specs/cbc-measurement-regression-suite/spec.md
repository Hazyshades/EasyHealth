## ADDED Requirements

### Requirement: CBC regression suite is a pure evaluator

The system SHALL provide a dedicated CBC measurement regression suite that evaluates fixtures against the active Registry 2.0 resolver without writing observations, normalization revisions, trends, readiness scores, manual decisions, or other patient/runtime state.

#### Scenario: Suite run produces evidence only
- **WHEN** an operator or CI runs the CBC regression suite
- **THEN** the runner reports per-fixture classification, concrete key when present, and pass/fail against expected outcomes
- **AND** it does not call acceptance, correction, promotion, trend, readiness, score, or manual-decision writers

#### Scenario: Mutation attempt fails the run
- **WHEN** suite execution attempts a prohibited runtime mutation path
- **THEN** the run fails and does not report a green CBC release gate

### Requirement: Fixture pack covers the EH-107 CBC checklist

The CBC fixture pack SHALL include explicit cases for every EH-107 checklist family: five-part differential absolute versus percent; RDW-CV versus RDW-SD; reticulocytes absolute versus percent; exact RBC, HGB, HCT, MCV, MCH, and MCHC sample labels; platelets, MPV, PDW, and plateletcrit; segmented, band, and manual differential variants; and compatible versus invalid unit cases.

#### Scenario: Checklist families are all represented
- **WHEN** fixture validation runs on the CBC pack
- **THEN** every checklist family has at least one positive or identity-protection fixture
- **AND** missing-family coverage fails the suite before any per-row assertion

#### Scenario: Exact sample forms are present
- **WHEN** the fixture pack is loaded
- **THEN** it includes exact printed forms such as `Hemoglobin (HGB)`, `NEU%`, and manual differential labels from the launch sample
- **AND** punctuation or parenthetical abbreviations do not cause those fixtures to be omitted

### Requirement: Expectations encode positive, negative, ambiguous, and partial outcomes

Each fixture SHALL declare an expected resolver outcome of `resolved`, `partial`, `ambiguous`, or `unmapped`. When a concrete measurement is expected, the fixture SHALL name the expected `measurementDefinitionKey`. When the outcome is intentionally non-concrete, the fixture SHALL forbid any concrete key or an explicit deny-list of wrong keys.

#### Scenario: Positive resolved fixture pins the concrete key
- **WHEN** a fixture expects `resolved` for a reviewed CBC definition with sufficient evidence
- **THEN** the suite fails unless the actual classification is `resolved` and the concrete key matches exactly

#### Scenario: Intentional partial stays non-concrete
- **WHEN** a launch-sample CBC row lacks specimen or other axes required for a reviewed concrete definition
- **THEN** the fixture may expect `partial` (or another non-concrete outcome)
- **AND** the suite fails if a concrete `measurementDefinitionKey` is selected

#### Scenario: Wrong concrete key fails even if classification matches loosely
- **WHEN** the resolver returns any concrete key other than the fixture's expected key, or any concrete key when none is allowed
- **THEN** the suite marks that fixture failed
- **AND** aggregate green status is blocked

### Requirement: Synthetic fixtures fill sample gaps

The pack SHALL include synthetic fixtures for CBC distinctions that the launch sample does not print, including reticulocyte absolute versus percent pairs, RDW-CV versus RDW-SD pairs, and invalid unit combinations, without requiring those rows to exist in `sample_newest.pdf`.

#### Scenario: Reticulocyte pair is covered without sample PDF rows
- **WHEN** the suite runs without reticulocyte rows in the 44-row launch corpus
- **THEN** synthetic reticulocyte absolute and percent fixtures still execute
- **AND** they remain subject to the same identity and unit guards

#### Scenario: RDW variant pair is covered beyond generic RDW percent
- **WHEN** the launch sample only provides a generic RDW percent label
- **THEN** synthetic RDW-CV and RDW-SD fixtures still assert distinct concrete identities or safe non-concrete outcomes with antipair guards

### Requirement: Suite is deterministic and CI-gated

Re-running the suite with the same registry and fixture inputs SHALL produce the same per-fixture outcomes. CI SHALL fail when any fixture fails, when checklist coverage is incomplete, or when the runner is not wired into the measurement-registry verification path.

#### Scenario: Identical inputs reproduce outcomes
- **WHEN** the CBC suite runs twice against the same Registry 2.0 definitions and fixture pack
- **THEN** both runs report the same classification and concrete-key results per fixture id

#### Scenario: Failed fixture blocks the CBC release gate
- **WHEN** any fixture fails identity, classification, unit, or coverage checks
- **THEN** CI marks the CBC regression gate red
- **AND** does not treat the general 44-row candidate corpus alone as sufficient CBC evidence
