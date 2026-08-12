## MODIFIED Requirements

### Requirement: Launch fixtures represent the required corpus coverage

The candidate corpus SHALL maintain all 44 sample rows with exact label, unit, value-kind, and missing-context negative cases, plus representative de-identified documents across target panels, languages (`en`, `ru`, `es`), laboratories, and specialty rows. Language-tagged fixtures MUST satisfy multilingual authenticity rules (operative labels match the declared language). Fixture validation SHALL reject an unclassified row, a missing required fixture class, a malformed expected classification, or a language-tagged fixture whose labels do not authentically represent that language.

#### Scenario: Required fixture coverage is complete

- **WHEN** fixture validation runs on the candidate corpus
- **THEN** it confirms every required sample row and representative document class is present with an explicit expected classification

#### Scenario: Missing-context negative is preserved

- **WHEN** a fixture omits context necessary for a concrete Registry 2.0 definition
- **THEN** the expected result is `partial`, `ambiguous`, or `unmapped` rather than an inferred concrete resolution

#### Scenario: Fake RU English-only fixture rejected

- **WHEN** a document fixture claims `language: "ru"` but only English labels are present
- **THEN** fixture validation fails authenticity

### Requirement: Candidate report is segmented and reproducible

Each corpus run SHALL publish a candidate manifest and segmented report that identify the exact candidate/fixture inputs and their hashes. The report SHALL include raw preservation, recognition, `resolved`/`partial`/`ambiguous`/`unmapped` outcomes, false concrete resolutions, alias and unit coverage, processing errors, manual corrections, and assessment impact. Metrics SHALL be segmented by language (`en`, `ru`, `es`) in addition to panel/family/laboratory/value-kind segmentations already required. Re-running with the same inputs SHALL produce the same classification and threshold result. A passing aggregate MUST NOT override a failed required language segment.

#### Scenario: Same candidate produces the same report result

- **WHEN** the runner is executed twice with identical Registry candidate, fixture, policy, and document inputs
- **THEN** both reports have the same classifications, coverage, and threshold decision and identify the same input hashes

#### Scenario: False concrete resolution is visible

- **WHEN** a corpus row resolves to a concrete definition contrary to its expected classification
- **THEN** the report records it as a false concrete resolution rather than hiding it in an aggregate success count

#### Scenario: Language segment failure is visible

- **WHEN** ES segment false-resolution exceeds its threshold while EN remains within threshold
- **THEN** the report records the ES failure distinctly
- **AND** the launchability decision fails

### Requirement: Thresholds and approvals gate launchability

Candidate-release policy SHALL define numerical thresholds and named approval owners, including per-language thresholds for required EN, RU, and ES segments of the multilingual launch scope. A candidate SHALL not be marked launchable unless its threshold checks pass for each required language segment, false-resolution review is approved, mapping classifications are complete, multilingual authenticity and empty-normalize gates pass, and every score-affecting binding has recorded approval from its named owner.

#### Scenario: Unapproved score-affecting binding blocks candidate

- **WHEN** a candidate contains a score-affecting Registry binding without the required approval evidence
- **THEN** candidate validation fails and the manifest is not launchable

#### Scenario: Threshold failure blocks candidate

- **WHEN** a segmented metric exceeds its configured numerical threshold
- **THEN** the candidate report records the failed threshold and CI rejects release approval

#### Scenario: RU empty-normalize gate blocks candidate

- **WHEN** any required RU alias normalizes to an empty measurement-label token
- **THEN** the candidate is not launchable regardless of EN metrics
