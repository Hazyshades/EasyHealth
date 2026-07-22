## ADDED Requirements

### Requirement: Canonical biomarker catalog

The system SHALL maintain a canonical biomarker catalog as the source of truth for each known `canonical_key`, including display name, body system, score role, coverage flag, aliases, optional specimen/tags, and unit conversion metadata.

#### Scenario: Catalog lookup for known key

- **WHEN** code resolves biomarker metadata for key `hba1c`
- **THEN** the catalog returns a definition with system `metabolic`, a non-empty alias list, and a score role
- **AND** the definition is used for system mapping rather than a separate hardcoded-only marker list

#### Scenario: Unknown key falls back to general

- **WHEN** an observation has a key not present in the catalog
- **THEN** the system assigns body system `general`
- **AND** the observation remains stored and displayable

### Requirement: Alias resolution to canonical keys

The system SHALL normalize lab keys and names through snake_case normalization and an alias map so that common EN and RU abbreviations resolve to a single canonical key.

#### Scenario: Sodium aliases resolve

- **WHEN** extraction or acceptance produces key or name variants such as `Na`, `sodium`, or `натрий`
- **THEN** the stored `biomarker_key` is `sodium`

#### Scenario: BUN and urea are not plain aliases

- **WHEN** a lab reports BUN versus urea (мочевина)
- **THEN** the system stores distinct keys `bun` and `urea`
- **AND** they share an equivalence group for display preference logic rather than collapsing to one storage key

#### Scenario: Dangerous collisions avoided

- **WHEN** a token could mean missing data (`N/A`) rather than sodium (`Na`)
- **THEN** the alias resolver does not map `n_a` / `na` from non-chemistry context incorrectly without name/unit context rules defined in implementation

### Requirement: Write-path canonical storage

The system SHALL resolve canonical keys on all observation write paths (pipeline extraction, document biomarker acceptance, and any legacy extract path still in use).

#### Scenario: Accepted biomarkers store canonical keys

- **WHEN** a user accepts extracted biomarkers from a document
- **THEN** each observation upsert uses the resolved canonical `biomarker_key`

### Requirement: Read-path canonical resolution

The system SHALL resolve keys through the alias map when grouping observations for health profile scoring, biomarker tables, and trends so legacy non-canonical rows still aggregate correctly before or without backfill.

#### Scenario: Legacy alias key groups with canonical

- **WHEN** historical observations exist under `na` and new ones under `sodium`
- **THEN** read-path resolution treats them as the same biomarker for system assignment and trend selection after resolution
- **AND** backfill is still recommended to collapse storage identity

### Requirement: Alias backfill

The system SHALL provide an idempotent backfill that rewrites known alias keys in `observations` to canonical keys and resolves unique-constraint conflicts by keeping the more complete row for the same profile, key, and date.

#### Scenario: Backfill merges conflict rows

- **WHEN** both `na` and `sodium` exist for the same profile and observed date
- **THEN** backfill retains one row under `sodium`
- **AND** prefers the row with reference ranges and non-empty unit when choosing which to keep

### Requirement: Score roles and coverage

The system SHALL assign each catalog marker a `scoreRole` of `core`, `extended`, or `display`, and a boolean indicating whether the marker counts toward system data-confidence coverage.

#### Scenario: Core markers affect state score

- **WHEN** a system has core markers with numeric lab reference ranges
- **THEN** the system state score is computed only from those core markers’ in-range / out-of-range status
- **AND** extended and display markers do not enter the equal-weight state score average

#### Scenario: Missing extended markers do not reduce confidence

- **WHEN** a user lacks extended CBC differential markers but has all coverage-flagged core blood markers present
- **THEN** data confidence is not reduced solely because extended markers are absent

#### Scenario: Display-only markers never score

- **WHEN** observations exist for display-only keys such as acute or specialty markers included in the catalog as display
- **THEN** they do not contribute to body-map system state score or coverage denominator

### Requirement: Layer-1 catalog expansion

The catalog SHALL include Layer-1 markers beyond the prior 34-key set so common CMP/CBC/inflammation/iron/UACR results map to named systems.

#### Scenario: Electrolytes map to kidney

- **WHEN** observations exist for `sodium`, `potassium`, `chloride`, `bicarbonate`, or `calcium`
- **THEN** they map to body system `kidney` (not `general`)

#### Scenario: Inflammation system receives CRP family

- **WHEN** observations exist for `crp`, `hs_crp`, or `esr`
- **THEN** they map to body system `inflammation`

#### Scenario: Iron studies map to blood

- **WHEN** observations exist for `ferritin`, `iron`, `tibc`, `transferrin`, `uibc`, or `transferrin_saturation`
- **THEN** they map to body system `blood`

#### Scenario: UACR maps to kidney

- **WHEN** an observation exists for `uacr`
- **THEN** it maps to body system `kidney`
- **AND** it is eligible as a coverage and/or core score marker per catalog definition

### Requirement: Body system set

The catalog-driven body system ids SHALL be: `cardiovascular`, `metabolic`, `thyroid`, `liver`, `kidney`, `blood`, `nutrients`, `inflammation`, and `general`.

#### Scenario: Nutrients replaces vitamins id

- **WHEN** the health profile lists systems
- **THEN** vitamin D / B12 / folate appear under `nutrients`
- **AND** legacy id `vitamins` is not required for new responses (compat mapping MAY be provided)

#### Scenario: ApoB is extended not equal core lipid

- **WHEN** computing cardiovascular state score
- **THEN** `apob` does not dilute coverage as a required core marker
- **AND** routine lipids remain the primary core set
