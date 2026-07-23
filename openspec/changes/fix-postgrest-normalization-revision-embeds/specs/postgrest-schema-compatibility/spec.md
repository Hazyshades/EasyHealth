## ADDED Requirements

### Requirement: Named PostgREST relationships remain compatible during deployment

The system MUST provide a transition schema in which both `observations_normalization_revision_fk` and `observations_normalization_revision_same_source_fk` resolve to the same composite observation-to-revision relationship while old and new application instances may coexist.

#### Scenario: Migration 034 is already applied

- **WHEN** a target environment has the new composite FK but still runs code using the old hint
- **THEN** the compatibility alias is applied and the PostgREST schema cache is reloaded before new-hint code is deployed
- **AND** both old and new explicit hints resolve to the same revision row during the transition

#### Scenario: Migration 034 is not yet applied

- **WHEN** a target environment still has the old single-column FK
- **THEN** affected API traffic is paused while migration 034 and the compatibility alias are applied in one controlled window
- **AND** traffic is not resumed until cache reload and an old-hint embedded read succeed
- **AND** new-hint code is not deployed before the new relationship exists

### Requirement: Every affected consumer proves the migrated relationship through PostgREST

The deployment gate MUST execute real PostgREST relationship embedding after migrations for document observations, Biomarkers, Health Profile, Reports, and structured context; mocked Supabase query builders are not sufficient evidence.

#### Scenario: Five read paths pass on the transition schema

- **WHEN** one linked laboratory observation and active same-source revision exist
- **THEN** all five consumers complete without a relationship-resolution error
- **AND** each consumer preserves its existing projection and eligibility semantics

#### Scenario: Schema cache is stale

- **WHEN** a relationship migration is applied but PostgREST has not observed it
- **THEN** the rollout remains blocked until cache reload and embedded-read evidence succeed

### Requirement: Compatibility alias removal is separately gated

The old relationship alias MUST remain until every target environment and live application instance uses the new hint. Its removal MUST be a separate migration action backed by instance/environment inventory and a static runtime scan.

#### Scenario: An old application instance still exists

- **WHEN** deployment inventory finds any instance using `observations_normalization_revision_fk`
- **THEN** the compatibility alias is not removed

#### Scenario: Cutover is complete

- **WHEN** all instances use the new hint and all five reads pass in every target environment
- **THEN** the cleanup migration may remove the old alias
- **AND** active runtime code contains no old hint
