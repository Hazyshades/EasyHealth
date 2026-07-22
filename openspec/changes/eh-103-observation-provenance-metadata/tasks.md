## 1. Launch Observation Schema

- [x] 1.1 Add the additive provenance foundation: source extraction lineage, resolution status, nullable analyte key, nullable measurement-definition key, and active revision linkage. The legacy `biomarker_key` identity removal and uniqueness cutover are owned by EH-105; EH-103 does not declare the cutover complete.
- [x] 1.2 Add immutable raw label, raw value text, raw reference text, nullable raw unit, source location/evidence (page index, bounding box when available, page-only fallback), extraction version, and provenance schema version. `provenance_schema_version` is assigned by the persistence layer, not copied from extraction.
- [x] 1.3 Add applicable catalog manifest version/digest, resolver version, and normalization version for every resolver state. The catalog manifest identifies the EH-102 launch catalog release; do not introduce a bare `manifest_version` field.
- [x] 1.4 Add database write-once enforcement and clean-database migration verification; permit development-data reset.

## 2. Normalization Revisions

- [x] 2.1 Snapshot raw inputs, source extraction, resolution status, optional semantic identifiers, evidence, and release versions on every revision.
- [x] 2.2 Include raw value text and other identity-bearing inputs in evidence hashing.
- [x] 2.3 Prove reprocessing is append-only across resolved, ambiguous, partial, and unmapped states.

## 3. Acceptance and Idempotency

- [x] 3.1 Update bulk acceptance and manual review to populate one provenance contract for every resolver state.
- [x] 3.2 Record source extraction id as immutable lineage for idempotency; EH-105 establishes it as the canonical acceptance idempotency key.
- [x] 3.3 Reject mutation of distinct raw/source provenance and preserve separate source facts.
- [x] 3.4 Add integration tests for thresholds, decimal commas, qualitative unitless values, duplicate retries, same-time distinct sources, partial results, and unmapped results.

## 4. APIs and Consumers

- [x] 4.1 Expose raw provenance, resolution status, semantic links, and release snapshots in document/observation APIs.
- [x] 4.2 Update current clients to the launch schema; do not retain legacy response fields solely for backward compatibility.
- [x] 4.3 Add API contract tests for resolved, partial, and unmapped observations.

## 5. Verification and Delivery

- [x] 5.1 Run migrations from a clean database and verify the development reset/cutover procedure.
- [x] 5.2 Run launch-corpus normalization, acceptance, reprocessing, and API suites.
- [x] 5.3 Verify immutable raw provenance, applicable release snapshots, source-id lineage, append-only history, and nullable semantic identity.
- [x] 5.4 Validate OpenSpec and record EH-103 linkage in the delivery commit or pull request.
