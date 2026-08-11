## ADDED Requirements

### Requirement: Measurement-label normalization is separate from identifier tokens

The system SHALL provide a dedicated `normalizeMeasurementLabel` function for human-readable laboratory measurement labels used in alias admission, collision detection, and label comparison. Identifier normalization (`snakeCaseToken` / key tokens) SHALL remain a separate contract and MUST NOT be the admission normalizer for multilingual labels.

`normalizeMeasurementLabel` SHALL:

- apply Unicode NFKC;
- apply Unicode lowercase;
- for Russian source text, map `ё`/`Ё` to `е`;
- for Spanish, preserve `á`, `é`, `í`, `ó`, `ú`, `ü`, and `ñ` in the primary normalized form;
- normalize whitespace and common punctuation without removing Cyrillic or Spanish letters;
- refuse to produce a matchable token that is empty or excessively weak (including pure-digit collapses such as treating `свободный Т4` as only `4`).

#### Scenario: Pure Cyrillic label keeps letters

- **WHEN** `normalizeMeasurementLabel` receives `Гемоглобин`
- **THEN** the primary normalized form is non-empty and still represents the Cyrillic word content
- **AND** the form is not produced by stripping to Latin-only `a-z0-9`

#### Scenario: Spanish diacritics remain in the primary form

- **WHEN** `normalizeMeasurementLabel` receives `Hemoglobina glucosilada`
- **THEN** the primary normalized form retains the language letters including any diacritics present in the input after NFKC/lowercase rules
- **AND** matching against a reviewed ES alias does not require stripping accents first

#### Scenario: Identifier normalizer is unchanged for keys

- **WHEN** code normalizes an internal biomarker key token such as `free_t4`
- **THEN** it continues to use the identifier token contract rather than `normalizeMeasurementLabel`

#### Scenario: Weak collapse is rejected

- **WHEN** a candidate alias value would normalize to an empty string or to an excessively weak token under the measurement-label rules
- **THEN** catalog validation MUST reject that alias before release
- **AND** runtime admission MUST NOT treat the empty/weak form as a match key

### Requirement: Optional Spanish accent-fold fallback is collision-gated

The system MAY compute an accent-folded secondary form for Spanish labels only as a controlled fallback when the primary form does not admit an alias. Accent-fold fallback SHALL be disabled for any folded form that would actively collide across different measurement definitions under reviewed-resolution aliases. The primary accent-preserving form remains authoritative whenever it matches.

#### Scenario: Fallback blocked by cross-definition collision

- **WHEN** two active reviewed-resolution aliases on different measurement definitions share the same accent-folded form but differ in primary form
- **THEN** catalog validation fails or marks fold-fallback inadmissible for those aliases
- **AND** runtime MUST NOT use fold-fallback to admit either alias via that collision

#### Scenario: Safe fold fallback admits unique alias

- **WHEN** an input differs from a unique reviewed ES alias only by accent folding and no other definition owns that folded form
- **THEN** admission MAY use fold-fallback and MUST record that the match used the fallback policy

### Requirement: Catalog validation detects multilingual normalize hazards

Registry build and release validation SHALL detect and fail on:

- aliases whose measurement-label normalization is empty;
- active reviewed-resolution collisions on the same locale and primary normalized form across different measurement definitions (unless explicitly disallowed by higher-priority axis-qualified policy documented in the catalog validator);
- excessively generic/weak aliases;
- regressions in the locked English label corpus after the normalizer cutover.

#### Scenario: Empty normalized alias fails the build

- **WHEN** a registry candidate contains a RU alias that normalizes to empty under `normalizeMeasurementLabel`
- **THEN** validation fails and the candidate is not launchable

#### Scenario: English corpus remains stable

- **WHEN** the multilingual normalizer is enabled
- **THEN** the existing English alias regression fixtures continue to admit the same definitions for the same inputs
