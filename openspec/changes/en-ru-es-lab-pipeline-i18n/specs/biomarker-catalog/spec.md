## MODIFIED Requirements

### Requirement: Alias resolution to canonical keys

The system SHALL resolve laboratory labels through the Registry 2.0 authoritative alias-admission path using measurement-label normalization so that common EN, RU, and ES names and abbreviations map to the correct measurement definitions without erasing non-Latin scripts. Legacy identifier snake_case maps MAY remain for historical key compatibility but MUST NOT be the sole multilingual label matcher and MUST NOT claim RU coverage when Cyrillic aliases normalize to empty under identifier rules.

#### Scenario: Sodium aliases resolve across languages

- **WHEN** extraction produces labels such as `Na`, `sodium`, or a reviewed RU/ES sodium alias from the launch pack
- **THEN** alias admission can recognize the sodium measurement family per Registry 2.0 rules
- **AND** concrete definition selection still requires specimen/unit/axes evidence

#### Scenario: BUN and urea are not plain aliases

- **WHEN** a lab reports BUN versus urea (мочевина / urea)
- **THEN** the system keeps distinct measurement identities
- **AND** does not collapse them solely because of loose multilingual aliasing

#### Scenario: Dangerous collisions avoided

- **WHEN** a token could mean missing data (`N/A`) rather than sodium (`Na`)
- **THEN** the alias resolver does not map weak or context-free tokens into a measurement without the declared match policy and weak-token protections

### Requirement: Aliases retain source and match policy

Aliases SHALL record normalized form (via `normalizeMeasurementLabel`), source, match type, approval status, and required locale plus laboratory/fixture provenance when applicable. OCR variants MUST remain distinguishable from reviewed exact aliases. Every resolver-admitted alias MUST include locale `en`, `ru`, or `es`.

#### Scenario: Fixture alias is added

- **WHEN** a parenthetical or abbreviated label is added from a launch document
- **THEN** the alias records that fixture source, locale, and its intended definition or analyte

#### Scenario: Locale required on new alias

- **WHEN** a registry alias lacks locale metadata
- **THEN** catalog validation rejects the alias

## ADDED Requirements

### Requirement: Multilingual launch-slice coverage

The Registry 2.0 launch slice consisting of CBC; basic metabolic/biochemistry; lipid profile; thyroid panel; common liver and kidney markers; glucose and HbA1c; and common qualitative tests already in the launch catalog SHALL provide genuine reviewed alias coverage for EN, RU, and ES on every measurement in that slice. The catalog architecture SHALL support extending the same packs to the rest of the catalog later without a second admission mechanism. Uploaded documents MUST NOT auto-expand the catalog.

#### Scenario: Slice measurement has EN RU ES packs

- **WHEN** multilingual slice validation runs
- **THEN** each slice measurement definition exposes at least one reviewed active alias for locale `en`, one for `ru`, and one for `es`

#### Scenario: Upload does not create definitions

- **WHEN** a user uploads a lab containing an unknown marker
- **THEN** the catalog measurement set is unchanged by that upload alone
