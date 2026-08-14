## Why

Registry 2.0 has reviewed concrete measurement identities and assessment bindings, but no explicit representation of a laboratory panel. As a result, documents, future timeline views, and future panel education cannot use one stable, auditable membership model without re-deriving relationships from scoring groups, labels, or legacy Registry v1 data.

## What Changes

- Add a static, versioned Registry 2.0 panel registry for CBC, lipid, thyroid, liver, kidney, and iron studies.
- Define immutable panel definitions with stable keys, canonical display names, alternate names, and ordered required or optional memberships referencing reviewed concrete measurement definitions.
- Add reviewed concrete Registry 2.0 iron-study definitions required to publish a non-empty iron-studies panel; Registry v1 iron records remain migration/audit input only.
- Add deterministic validation, fixtures, release-manifest serialization, digest coverage, and generated canonical documentation for panel data.
- Preserve the separation between panel membership and assessment: panel membership MUST NOT resolve a measurement, supply specimen, alter a score role, satisfy score readiness, or change Health Profile eligibility.
- Preserve the separate reviewed panel-specimen-policy change: panel aliases and membership alone MUST NOT be used to classify document headings or infer specimen.

## Capabilities

### New Capabilities
- `panel-registry`: Static, versioned Registry 2.0 panel definitions and validated many-to-many memberships for reviewed concrete measurements.

### Modified Capabilities
- None.

## Impact

- Target domain: health-profile / Registry 2.0 catalog.
- Affected code: `src/lib/biomarkers` catalog types, static data, exports, release-manifest serialization, validation, fixtures, and generated biomarker documentation.
- Affected release process: a changed panel registry changes the frozen catalog input and requires candidate release evidence and renewed approvals for the new candidate-input hash.
- No database migration, public API route, document extraction change, resolver selection change, observation rewrite, score-policy change, or timeline UI is included.
- Follow-on consumers may use stable panel keys: EH-126 timeline work, EH-135 panel education, and the separate reviewed panel-specimen-policy change.