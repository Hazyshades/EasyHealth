## 1. Identity contract and database foundation

Implementation/deployment notes: [implementation-runbook.md](implementation-runbook.md).

- [x] 1.1 Record the EH-105 tracked observation-identity contract and its explicit handoffs to EH-104 Phase B and EH-106 in the implementation notes/runbook.
- [x] 1.2 Add a post-EH-104 migration for `document_extracted_instrumental_measures` with immutable provenance, source locator, occurrence discriminator, snapshot fingerprint, current/superseded state, ownership indexes, RLS, and service-role policy.
- [x] 1.3 Add `observations.source_instrumental_measure_id`, the partial source-identity uniqueness index, and instrumental-only lineage constraints without modifying EH-104's laboratory source/revision enforcement schedule.
- [x] 1.4 Update generated or maintained Supabase/TypeScript types for the new source table, observation lineage field, RPC payload, and typed observation DTO.
- [x] 1.5 Implement the service-only instrumental materialization RPC with document/job/profile/type validation, deterministic lock order, source snapshot replay, source/observation upsert, supersession, fixed `search_path`, and explicit grants/revokes.
- [x] 1.6 Define and document the disposable-environment reset path for invalid pre-EH-105 instrumental rows; do not create a legacy-key or production backfill path.

## 2. Instrumental extraction and worker safety

- [x] 2.1 Extend the instrumental extraction prompt, schema, and parser so every numeric measure has raw/display data, source context or deterministic locator, and an occurrence discriminator; retain generated key only as a hint.
- [x] 2.2 Add canonical snapshot-fingerprint and duplicate-occurrence validation before instrumental materialization.
- [x] 2.3 Replace `clearPriorExtractions`/`insertInstrumentalObservations` delete-then-insert behavior with the service-only materialization RPC for instrumental documents.
- [x] 2.4 Make all Supabase mutations in the instrumental replacement and document/job completion path inspect errors and throw into the failure path before reporting success.
- [x] 2.5 Preserve the previous current instrumental snapshot on RPC, observation, or completion-write failure and verify retry behavior is idempotent.

## 3. Typed read boundaries and legacy tooling

- [x] 3.1 Update document observation/detail readers to return explicit `observation_kind`, instrumental source lineage, and only current instrumental source records by default.
- [x] 3.2 Add an explicit `observation_kind = 'lab'` boundary to Health Profile laboratory marker, mapping, readiness, confidence, and assessment queries; keep full instrumental presentation deferred to EH-106.
- [x] 3.3 Inventory active `observations` access in `src/`, `worker/`, and `scripts/`; replace any remaining use of the removed `observations.biomarker_key` without changing legitimate raw extraction fields.
- [x] 3.4 Retire `scripts/backfill-biomarker-aliases.mjs` with a fail-fast migration message or remove its runnable entry point; do not retarget it to Registry 2.0 semantics.
- [x] 3.5 Add a scoped static verification script and CI/package command that rejects active `observations.biomarker_key` access while excluding historical migrations, archived specs, and raw extraction-table fields.

## 4. Database, worker, and API verification

- [x] 4.1 Add pgTAP coverage for instrumental source ownership, kind/lineage exclusivity, source uniqueness, repeated equal-key occurrences, RPC authorization, and cross-profile rejection.
- [x] 4.2 Add pgTAP coverage for unchanged snapshot replay, changed reprocess supersession, transactional rollback, and clean-reset behavior.
- [x] 4.3 Add worker integration tests proving a failed materialization or completion write cannot mark the document/job completed or erase the prior current snapshot.
- [x] 4.4 Add document API tests for typed instrumental observations and current-only default reads.
- [x] 4.5 Add Health Profile regression tests proving instrumental observations never enter laboratory marker payloads, mapping, readiness, or assessment calculations.
- [x] 4.6 Run the static legacy-column check, clean `supabase db reset`, database fixtures, worker tests, API tests, typecheck, and production build; record results and any environment blocker. *(Local `supabase db reset` waived; CI `test:eh105-db` + static checks are the recorded authority — see #5.)*

## 5. Rollout and roadmap handoff

- [x] 5.1 Document schema/RPC then compatible-worker deployment order, job pause/drain procedure, forward-only rollback, and disposable reset/reprocess procedure.
- [x] 5.2 Verify a repeated-measure report, an unchanged retry, a changed reprocess, and a forced write failure in a disposable environment before enabling instrumental jobs. *(Local disposable env waived; CI EH-105 pgTAP covers repeated occurrence / replay / reprocess contracts — see #5.)*
- [x] 5.3 Record EH-105 completion evidence and update the EH-106 handoff: acceptance/correction CAS cutover and all remaining trends, reports, structured context, biomarker API/UI, conversion, and assessment migration remain owned by EH-106.
- [x] 5.4 Preserve the EH-104 Phase B handoff: final laboratory guards, `MATCH FULL`, controlled purge enforcement, and legacy promotion-RPC removal begin only after EH-106-compatible writers are deployed.
