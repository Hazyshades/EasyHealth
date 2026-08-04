## 1. Registry 2.0 runtime foundation

- [x] 1.1 Inventory every active Registry v1 and v1-derived launch-catalog dependency, then replace the runtime mapping, conversion, score-role, system, and readiness inputs with Registry 2.0-native reviewed definition data.
- [x] 1.2 Update extraction normalization and measurement resolution to use Registry 2.0 only, including alias/unit/context handling and `resolved|partial|ambiguous|unmapped` outcomes without a v1 fallback or runtime feature mode.
- [x] 1.3 Migrate unit conversion and health-system/assessment binding helpers from legacy keys to reviewed Registry 2.0 definition identity, preserving raw incomplete results without concrete inference.
- [x] 1.4 Remove Registry v1 adapters, generated-v1 launch-catalog runtime use, compatibility-only behavior, configuration flags, and dual-read telemetry; retain frozen fixtures only in allowlisted migration/audit tooling.
- [x] 1.5 Extend static verification and package/CI commands so direct and generated-v1 runtime dependencies fail while legitimate frozen-fixture tooling remains usable.

## 2. Atomic acceptance and correction writers

- [x] 2.1 Build a service-only, per-row transactional Registry 2.0 writer that creates/reuses same-source observation and revision records, derives status/decision metadata, and invokes `promote_observation_normalization_revision_v2` without duplicating its locks, ownership checks, CAS, or projection updates.
- [x] 2.2 Migrate every acceptance entry point, including existing `ids[]` requests, to invoke the v2 adapter independently for each selected laboratory row.
- [x] 2.3 Migrate every correction/confirmation entry point to invoke the v2 adapter with reviewed concrete definitions and `manually_corrected` user decisions.
- [x] 2.4 Preserve resolved reviewed user acceptance as `user_verified` and raw `partial|ambiguous|unmapped` acceptance as `pending`, including idempotent retry and primitive-error propagation behavior.
- [x] 2.5 Add focused API/service/database regression coverage for v2 RPC inputs, per-row atomic behavior, stale CAS, ownership rejection, user decision metadata, incomplete acceptance, and no direct client promotion.

## 3. Registry 2.0 consumer cutover

- [x] 3.1 Add or update the active-revision read boundary so document and biomarker DTOs expose reviewed Registry 2.0 identity and incomplete raw evidence without consulting legacy keys or catalogs.
- [x] 3.2 Migrate Health Profile, trends, unit conversion, readiness, and assessment inputs to reviewed Registry 2.0 laboratory bindings, explicitly excluding instrumental observations and incomplete concrete mappings.
- [x] 3.3 Migrate biomarker APIs/UI, document review presentation, reports, and structured context to Registry 2.0 identity and user-safe `partial|ambiguous|unmapped` presentation.
- [x] 3.4 Add consumer regressions proving resolved reviewed data remains available, incomplete results remain non-concrete, instrumental data stays outside laboratory semantics, and no consumer performs a legacy dual read.

## 4. Candidate-release corpus governance

- [x] 4.1 Version the complete 44-row launch corpus, missing-context negatives, representative de-identified document fixtures, expected classifications, numerical thresholds, named approval roles, and reset/rollback notes.
- [x] 4.2 Implement a deterministic, non-mutating Registry 2.0 candidate-corpus runner that validates coverage and emits segmented reports for preservation, recognition, outcomes, false resolutions, alias/unit coverage, errors, corrections, and assessment impact.
- [x] 4.3 Generate a hash-bound candidate manifest and validate thresholds, classifications, false-resolution review, and score-affecting approvals without invoking any runtime mutation path.
- [x] 4.4 Add package/CI commands and automated tests that reject missing fixtures, unclassified results, non-reproducible output, mutation attempts, missing approval evidence, and missing release artifacts.

## 5. QA, verification, and EH-104 handoff

- [x] 5.1 Create `QA/eh-106/checklist.md` with tester-facing preconditions, safe test data, numbered UI actions and observable expected results, plus separate developer evidence for database/concurrency/non-UI assertions.
- [x] 5.2 Run the static cutover check, focused Registry/worker/API/consumer/corpus tests, clean database fixture suites where available, typecheck, and production build; record results or environment limitations in the QA checklist.
- [x] 5.3 Record the deployed-writer and populated-data-preflight handoff to EH-104 Phase B, explicitly keeping final guards, controlled purge enforcement, and legacy promotion-RPC removal out of this change.
