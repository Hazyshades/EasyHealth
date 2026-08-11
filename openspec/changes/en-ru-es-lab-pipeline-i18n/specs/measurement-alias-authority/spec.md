## MODIFIED Requirements

### Requirement: Registry aliases SHALL be explicit authority records

The Registry 2.0 catalog SHALL represent every resolver-admitted alias as an `AliasDefinition` with a stable key, owning measurement-definition key, literal value, deterministic normalized value produced by `normalizeMeasurementLabel`, source, match type, match authority, approval status, lifecycle, source-record provenance, a required locale (`en` | `ru` | `es`), and any applicable laboratory scope, review reference, and fixture references. The catalog MUST reject an alias with missing required provenance, missing locale, a duplicate stable key, a fixture source without one or more fixture references, or a normalized value that is empty or excessively weak under the measurement-label normalization contract.

#### Scenario: Catalog rejects an unprovenanced alias

- **WHEN** a registry build contains an alias without its required source-record provenance
- **THEN** the build MUST fail before the alias can be exposed to the resolver or manifest

#### Scenario: Catalog rejects a missing locale

- **WHEN** a registry build contains an alias without locale `en`, `ru`, or `es`
- **THEN** the build MUST fail

#### Scenario: Fixture alias retains corpus ownership

- **WHEN** a fixture-derived alias is included in the launch catalog
- **THEN** its record MUST identify the de-identified source fixture and the owning measurement definition

#### Scenario: Empty normalized multilingual alias is rejected

- **WHEN** a RU or ES alias literal normalizes to an empty or excessively weak measurement-label token
- **THEN** the catalog build MUST fail before release

### Requirement: Matching SHALL use declared bounded policies only

The alias-admission boundary SHALL compare labels only with the active alias's declared `exact`, `normalized`, `ocr_variant`, or `bounded_fuzzy` policy. `exact` MUST use canonical Unicode/trimmed literal comparison; `normalized` MUST use `normalizeMeasurementLabel` primary form equality (with optional collision-gated Spanish accent-fold fallback only where explicitly enabled for that alias set); `ocr_variant` MUST match an explicitly declared variant; and `bounded_fuzzy` MUST declare a maximum Damerau-Levenshtein distance of one or two, require a normalized input length of at least five, and have active reviewed-resolution authority. The resolver MUST NOT use substring, token-containment, phonetic, unbounded edit-distance, identifier-`snakeCaseToken` comparison, or implicit proposed-key matching as alias admission.

#### Scenario: Fuzzy input within a reviewed bound is admitted

- **WHEN** a normalized extraction label of at least five characters is within the declared distance of one from an active reviewed bounded-fuzzy alias
- **THEN** the admission result MUST identify that alias key, its match type, and its authority

#### Scenario: Over-distance text is not admitted

- **WHEN** an extraction label exceeds the bounded-fuzzy alias's declared distance
- **THEN** the alias MUST NOT be admitted

#### Scenario: Unsupported fuzzy authority is rejected

- **WHEN** a provisional or recognition-only alias declares `bounded_fuzzy`
- **THEN** the catalog build MUST reject the alias

#### Scenario: Pure Cyrillic normalized alias admits

- **WHEN** the raw label is pure Cyrillic and equals a reviewed RU alias under `normalizeMeasurementLabel`
- **THEN** the alias MUST be admitted with its declared match type
- **AND** admission MUST NOT depend on a residual Latin abbreviation

### Requirement: Laboratory scope SHALL constrain alias matching

An alias with a laboratory scope SHALL be admitted only when the extraction input identifies the same laboratory. An unscoped alias MAY be admitted globally. Locale SHALL be recorded on every alias as required provenance and coverage metadata. Locale MUST NOT expand an alias beyond its literal/normalized match rules. Laboratory-specific aliases SHOULD be authored only when wording is genuinely laboratory-specific; language packs for common clinical names SHOULD remain unscoped.

#### Scenario: Foreign-laboratory alias is excluded

- **WHEN** an input identifies laboratory A and only a matching alias scoped to laboratory B exists
- **THEN** the alias MUST NOT be admitted

#### Scenario: Global reviewed alias remains available

- **WHEN** an input matches an unscoped active reviewed-resolution alias
- **THEN** the resolver MAY admit it regardless of laboratory attribution

#### Scenario: Locale is present on admitted alias evidence

- **WHEN** the resolver admits an alias
- **THEN** candidate evidence retains the alias locale for audit and release reporting

## ADDED Requirements

### Requirement: Multilingual alias packs for the launch slice

Every measurement definition in the multilingual launch slice (CBC; basic metabolic/biochemistry; lipids; thyroid; common liver and kidney markers; glucose and HbA1c; launch qualitative tests) SHALL include reviewed aliases for locales `en`, `ru`, and `es` covering full localized names, common abbreviations, localized names with international codes in parentheses where used in practice, real-world laboratory wording, and safe OCR variants as applicable. Architecture SHALL allow the same alias-pack mechanism for the remainder of the catalog without requiring a different admission path.

#### Scenario: Slice definition missing RU pack fails gate

- **WHEN** a launch-slice measurement has reviewed EN aliases but no reviewed RU aliases
- **THEN** the multilingual slice coverage gate fails

#### Scenario: Non-slice definition may remain EN-only until extended

- **WHEN** a non-slice measurement lacks RU/ES packs
- **THEN** the catalog may still build if other gates pass
- **AND** the multilingual slice completeness gate does not claim full-catalog language coverage
