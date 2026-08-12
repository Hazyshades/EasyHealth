## ADDED Requirements

### Requirement: Health Profile laboratory input projection has one executable boundary

`GET /api/health-profile` SHALL obtain each laboratory input to `buildHealthProfile` exclusively through pure `projectHealthProfileLaboratoryInput` in `src/lib/health-profile-input.ts`. The helper SHALL preserve the route's existing admission and presentation behavior: `projectLaboratoryOutcome` assessment eligibility, `projectActiveRegistryV2LaboratoryBinding`, active resolved trace and selected-candidate consistency, reviewed Registry-v2 provenance, reviewed compatible assessment binding, value-kind handling, numeric conversion via `presentObservation`, original unit/reference-range values, and the exact returned Health Profile input shape.

The route SHALL retain session authorization, profile-scoped observation/document queries, completed/ready/needs-review document filtering, laboratory-only filtering, source construction, `buildHealthProfile` invocation, and response serialization. This extraction SHALL not change which observations are admitted or any Health Profile response or score.

#### Scenario: Helper preserves the existing route projection
- **WHEN** the route processes resolved, partial, ambiguous, unmapped, inactive, trace-mismatched, incompatible-binding, provisional, qualitative, numeric-conversion, and missing-reference fixtures
- **THEN** the helper produces exactly the prior route input or `null` for each fixture
- **AND** the resulting `buildHealthProfile` output is unchanged
