## Context

EH-132 is a release-validation change, not a new patient-data feature. The checkout already contains three relevant seams: the static six-panel Registry 2.0 catalog (`src/lib/biomarkers/panel-registry.ts`), the precision-safe medical-event parser/comparator and database model (`src/lib/documents/medical-events.ts`, migration 069), and the EH-127 pure Health Timeline projection/page (`src/lib/timeline.ts`, `/api/timeline`, `/app/timeline`). The existing Biomarkers API/page exposes exact concrete-definition trend eligibility and display-unit conversion, but EH-129 has no dedicated release evidence in this checkout.

The validation must therefore exercise existing pure contracts with synthetic data, add only test/release evidence, and preserve truthful boundaries: no upload timestamp can become a medical date, incompatible measurements cannot be grouped, panel membership cannot mutate resolver behavior, and unavailable UI or product sign-off cannot be reported as passed.

## Goals / Non-Goals

**Goals:**

- Provide one deterministic EH-132 TypeScript runner covering the issue checklist across timeline, event-date, comparison, unit, and panel fixtures.
- Prove known/unknown and year/month/day/instant ordering, explicit timezone handling, date-only timezone absence, and no current/upload-date substitution.
- Prove multi-laboratory comparison eligibility is keyed by the same concrete measurement definition and eligible status; preserve native values, units, reference ranges, and source document IDs; keep incompatible definitions/units/specimens out of a shared series.
- Prove curated panel membership is valid, ordered, many-to-many where intended, duplicate-safe, and independent from resolution/scoring lookups.
- Add a transactional database fixture for event ownership, source-document uniqueness, date-role idempotency, partial/instant validation, and profile isolation.
- Measure the pure timeline projection over a fixed synthetic volume and expose the measured result as release evidence.
- Preserve an explicitly printed specimen from a row's own captured source text if the model omits the structured field, while retaining the existing rule that an unstated axis remains incomplete.
- Register both suites in the repository CI coverage policy/workflow and provide an honest tester-facing QA checklist.

**Non-Goals:**

- Do not add a panel screen, a new comparison API/chart/date selector, or any other missing EH-129 product feature.
- Do not infer a specimen from an analyte label, document-level default, or model convention; only lexical evidence preserved with the individual row may supply it.
- Do not change Registry definitions, aliases, conversions, resolver behavior, assessment bindings, or panel membership data.
- Do not add production migrations or alter persisted data; the database fixture is transactional and rolls back.
- Do not infer a production performance SLA from an issue that does not specify one. The fixed benchmark is a regression budget for the checked-in pure projection and remains subject to product-owner sign-off.
- Do not mark authenticated UI, panel UI, full EH-129 UI, or product sign-off as passed without their actual environment/evidence.

## Decisions

### 1. Use one cross-feature runner over existing pure contracts

Add `scripts/verify-eh132-timeline-panel-release.ts`. It will construct a small named fixture matrix and call existing exported functions rather than duplicating production rules: `parseMedicalEventDate`, `calendarDateProjection`, `sortTimelineEvents`, `buildTimelineEvents`, `evaluateUnitCompatibility`, `resolveMeasurementDefinition`, `presentObservation`, and panel-registry lookup/validation. It will also inspect the existing API/page wiring only where the contract is otherwise not callable without an authenticated browser, following the established EH-127 verifier pattern.

**Alternative considered:** Chain the existing EH-125/EH-126/EH-127/EH-111 scripts and call the release gate complete. Rejected because that proves each feature in isolation and does not test cross-feature fixtures, duplicate boundaries, source/range retention, or the performance budget.

### 2. Keep comparison grouping exact-definition and eligibility based

The EH-132 fixture rows will model the public Biomarkers response shape: `measurement_definition_key`, `trend_eligible`, native `value`/`unit`/reference bounds, and `document_id`/laboratory source. The runner will group only rows with a non-null identical definition key and `trend_eligible === true`, then assert that compatible unit variants for that concrete key remain two source-preserving points while RDW-CV/RDW-SD, serum/plasma variants, unresolved rows, and ineligible rows remain separate or excluded. Unit conversion is tested through the existing `presentObservation` path and never mutates the native fixture.

**Alternative considered:** Group by display name, analyte key, panel membership, or normalized unit. Rejected because those axes can collapse clinically distinct definitions; EH-129 explicitly requires compatible definitions only.

### 3. Treat dates as source precision and use the shared comparator

Date fixtures will cover year, month, day, explicit-offset instant, timezone-less timestamp rejection, invalid calendar dates, and unknown values. The runner will assert the parser's canonical value/precision/timezone and the comparator's stable known-before-unknown ordering in both directions. A separate EH-127 projection fixture will keep a document with a future upload timestamp and no explicit event date to prove the UI projection remains unknown.

**Alternative considered:** Convert every fixture through JavaScript `Date` or use `created_at` as a fallback. Rejected because date-only values are calendar facts and upload/processing time is not clinical evidence.

### 4. Put duplicate and ownership proof at the database boundary

Add `QA-Db_tests/eh132_timeline_panel_release.sql` and `test:eh132-db`. The SQL runs in one transaction and uses synthetic profiles/documents. It will verify trigger-created one-event-per-document identity, the unique source-document/date-role constraints, repeated event-date synchronization without row multiplication, invalid timezone/precision rejection, partial-date projection behavior, and profile-scoped timeline rows. Static duplicate panel member/alias cases stay in the TypeScript runner because panel data is not persisted.

**Alternative considered:** Test duplicate behavior only by reading migration text or by mutating production-like fixtures from TypeScript. Rejected because uniqueness, triggers, and profile ownership are database contracts and require pgTAP against the migrated schema.

### 5. Make the performance check bounded, reproducible, and end-to-end complete

The runner builds `EH132_PERFORMANCE_EVENT_COUNT = 2000` minimal synthetic documents, warms the projection once, measures a second projection with `performance.now()`, and fails only when it exceeds a conservative `EH132_PERFORMANCE_BUDGET_MS = 2000`. It asserts all events are projected and reports count/elapsed milliseconds. The constants and environment assumptions are copied into the QA checklist; they are not presented as an unapproved production SLA.

The controlled browser fixture also exposed the backend's default response cap: a single document query returned only the first 1,000 source rows, so a seemingly responsive 2,000-event profile silently projected 1,000 events. The timeline route now uses a bounded 500-row `collectTimelinePages` collector and rejects an oversized page; the EH-132 runner proves it collects all 2,000 source records across five requests. Related timeline rows stay profile-scoped rather than expanding a source-document ID list into a request URI.

**Alternative considered:** Benchmark the authenticated API or browser in the unit runner. Rejected because network/database/browser noise would make the release regression non-deterministic; manual/API performance evidence belongs in the QA checklist and deployment environment.

### 6. Wire suites through the existing CI coverage contract

Add `test:eh132` and `test:eh132-db` package scripts, entries in `ci/verification-suite-policy.json`, and steps in the existing `verify` and `database` jobs. This keeps the new scripts from becoming orphaned under `check:ci-suite-coverage` and runs the DB fixture only after local Supabase starts.

**Alternative considered:** Keep the runner local-only until product sign-off. Rejected because a P0 release-validation suite that is not workflow-reachable cannot protect the release gate.

### 7. Use QA as the product-signoff boundary

Create `QA/eh-132/checklist.md` from the repository template. It will include synthetic fixtures, executable Health Timeline and Biomarkers actions where those interfaces exist, a clear unavailable/deferred section for panel/full EH-129 UI, developer evidence links for the two automated suites and DB checks, a performance result field, defect/P0 disposition, and a product-owner sign-off field. No case receives a passing result from static inspection alone.

**Alternative considered:** Treat green automated checks as product sign-off. Rejected because release acceptance is a human product decision and the issue does not identify an authenticated environment or approver.

### 8. Recover an explicitly stated specimen only from row provenance

The fixture exercise exposed a safe extraction loss: the PDF row said `Specimen: whole blood`, but the structured extraction omitted `specimen` even while preserving the row snippet. The parser will map a specimen from that captured row text only when the structured field is absent or unusable, then pass the mapped value through the existing `statedAxisValue` gate. The gate remains authoritative: a label, document-level convention, or model-supplied axis without lexical row/section evidence stays `unspecified` and resolves `partial`.

The prompt will require a model to keep printed specimen wording in `source_text`, and targeted parser tests will cover the positive `whole_blood` row and a negative no-specimen row. This corrects evidence transport rather than changing a Registry definition or clinical compatibility rule.

**Alternative considered:** Directly mark the EH-132 pair as `whole_blood` in a fixture loader or manually override its rows. Rejected because that would bypass the production provenance boundary and leave genuine explicit-row evidence vulnerable to the same data loss.

## Risks / Trade-offs

- **[EH-129 UI is incomplete or unavailable in this checkout]** → Keep its UI/date-selector cases explicitly Blocked/Out of scope and validate only the existing API/data eligibility seam; do not claim the full dependency delivered.
- **[The 2,000-event local budget is slower on a heavily loaded runner]** → Use a conservative two-second budget, report measured values, and require product/release-owner confirmation before treating the benchmark as the production gate.
- **[Local Supabase is unavailable]** → Finish the pure runner and checklist, mark `test:eh132-db` Blocked with the exact command/environment requirement, and rely on CI for database evidence; never mark it passed locally.
- **[Existing comparator/API ordering diverges between pure and database paths]** → Keep both the TypeScript comparator assertions and transactional view-order assertions; any mismatch is a release defect, not a test relaxation.
- **[Registry contract is accidentally altered while adding fixtures]** → Keep fixture data outside runtime Registry sources, run existing panel/measurement checks, and document that generated Registry documentation is intentionally unchanged.

## Migration Plan

No production migration or data transformation is introduced. Additive test scripts, the transactional SQL fixture, CI policy/workflow entries, OpenSpec artifacts, and the QA checklist ship with the release branch. Rollback is deleting those test/evidence files and package/workflow entries; production rollback is not applicable.

## Open Questions

- Which authenticated deployment and synthetic account will execute the manual Health Timeline/Biomarkers cases?
- What exact data volume and supported browser constitute the release owner's performance baseline? The runner's 2,000-event/2-second budget is a conservative checked-in regression budget until that decision is recorded.
- Has EH-129's full comparison UI/date-selector scope been delivered before EH-132 sign-off? If not, the corresponding checklist cases remain Blocked and the Health Timeline beta gate cannot be reported as fully accepted.
