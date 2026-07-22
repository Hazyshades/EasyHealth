## ADDED Requirements

### Requirement: Specimen and modifier on observations

Each observation SHALL store a `specimen` dimension and a `modifier` dimension with documented defaults when the lab does not specify them.

#### Scenario: Defaults for legacy-like inserts

- **WHEN** an observation is created without explicit specimen or modifier
- **THEN** specimen defaults to `unspecified` (or catalog-implied value when known)
- **AND** modifier defaults to `none` unless extraction or catalog supplies one

#### Scenario: Urine panel sets specimen urine

- **WHEN** a urine dipstick or urine quantitative marker is accepted
- **THEN** the observation specimen is `urine`

### Requirement: Expanded uniqueness constraint

The system SHALL enforce uniqueness of observations per profile on the composite of biomarker key, observed date, specimen, and modifier (not biomarker key and date alone).

#### Scenario: Serum and urine same key same day

- **WHEN** two accepted results share the same canonical key and date but differ in specimen (for example blood vs urine)
- **THEN** both observations are stored without uniqueness conflict

#### Scenario: Free vs total modifier

- **WHEN** two results differ only by modifier `free` vs `total` on the same key and date
- **THEN** both may be stored as separate observations

#### Scenario: True duplicate still upserts

- **WHEN** a second accept targets the same profile, key, date, specimen, and modifier
- **THEN** the system upserts the existing observation rather than creating a duplicate row

### Requirement: Health profile latest-by identity

Health profile aggregation SHALL treat latest observation identity as the latest row per `(biomarker_key, specimen, modifier)` (after canonical key resolution), not only per biomarker key when specimen/modifier differ.

#### Scenario: Latest urine and serum both available

- **WHEN** serum creatinine and urine creatinine exist as distinct identities
- **THEN** both can appear in aggregation according to their keys/specimen
- **AND** one does not silently overwrite the other solely by date collision on key

### Requirement: Migration of existing rows

Existing observations SHALL receive specimen and modifier values during migration so the new unique constraint can be applied without data loss.

#### Scenario: Existing rows get defaults

- **WHEN** the migration runs on historical numeric observations
- **THEN** each row has non-null specimen and modifier
- **AND** pre-existing single-row-per-key-per-day data remains unique under the new constraint after backfill
