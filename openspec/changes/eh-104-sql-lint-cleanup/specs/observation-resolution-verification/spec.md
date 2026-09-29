## ADDED Requirements

### Requirement: Current-schema preflight has no retired shadow dependency

The EH-104 populated-data preflight SHALL execute against the fully migrated current schema when `public.measurement_resolution_shadow_events` is absent. It SHALL inspect the live resolver and verification relations without recreating, requiring, or dynamically querying the retired shadow telemetry relation.

#### Scenario: Preflight runs after shadow telemetry removal

- **WHEN** the migration chain has applied the shadow-table removal and the current verification relations are present
- **THEN** `public.eh104_resolution_verification_preflight()` executes successfully
- **AND** the database does not need `public.measurement_resolution_shadow_events` to create or execute the function

#### Scenario: Live verification finding remains visible

- **WHEN** a current resolver or verification relation contains an invalid verification state
- **THEN** the preflight returns its existing finding code and subject details
- **AND** removing the retired shadow compatibility branch does not suppress live-schema findings
