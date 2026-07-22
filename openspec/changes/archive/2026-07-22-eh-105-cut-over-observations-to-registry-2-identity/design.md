## Context

EH-102 and migration 025 established the Registry 2.0 direction for laboratory observations: `observations.biomarker_key` was removed, semantic `analyte_key` and `measurement_definition_key` links are nullable, and laboratory idempotency is keyed by `source_extracted_biomarker_id`. EH-103 added immutable laboratory provenance and append-only normalization revisions. EH-104 Phase A added a v2, service-only revision-promotion primitive, but deliberately leaves its Phase B lineage guards and the EH-106 runtime cutover deferred.

Instrumental processing did not make that transition. `worker/src/pipeline.ts` deletes prior non-lab observations, then inserts rows containing the removed `biomarker_key` column and ignores the returned Supabase error. It can therefore lose prior measures and still complete the document and job. The current `InstrumentalNumericMeasure` only contains model-derived `key`, `name`, `value`, and `unit`; its normalized key is neither stable source evidence nor sufficient to distinguish repeated left/right, region-specific, or serial measures in one document. `scripts/backfill-biomarker-aliases.mjs` also queries and updates the removed observation column.

This is a pre-launch change. A clean database reset is permitted, but no synthetic source identity or production backfill contract may be invented for legacy rows. EH-106 owns laboratory acceptance/correction cutover and broad consumer migration; EH-104 Phase B owns the final laboratory revision/source relation, guards, purge enforcement, and legacy promotion RPC removal.

The ignored root `openspec/specs/` files are useful reference material but are not versioned in this branch. The tracked artifacts in this change are the authoritative EH-105 contract until the repository's canonical-spec synchronization policy is resolved.

## Goals / Non-Goals

**Goals:**

- Give every extracted instrumental numeric measure an immutable, occurrence-aware source identity.
- Make instrumental write and reprocess behavior atomic, idempotent, and safe when the worker or database write fails.
- Ensure no active writer, reader, or maintenance tool depends on `observations.biomarker_key`.
- Establish an explicit laboratory/instrumental boundary in observation DTOs and laboratory assessment inputs.
- Provide a clean-reset migration path and executable database, worker, and static-regression coverage.

**Non-Goals:**

- Do not repeat migration 025 or recreate a compatibility `biomarker_key` column.
- Do not map instrumental measures to Registry 2.0 analytes or concrete laboratory definitions.
- Do not change EH-104 Phase B constraints, controlled purge behavior, or the legacy/v2 normalization-promotion RPC transition.
- Do not implement EH-106 acceptance/correction CAS cutover, trends, reports, structured context, unit conversion, Health Profile UI, or broader biomarker API migration.
- Do not introduce a `standalone` observation kind. The only supported kinds remain `lab` and `instrumental`.
- Do not construct a production backfill from existing legacy instrumental observations; disposable development data is reset and reprocessed.

## Decisions

### 1. Model instrumental evidence as its own immutable source lineage

Add `document_extracted_instrumental_measures`, separate from `document_extracted_biomarkers`. Each row represents one extracted numeric occurrence and contains at least:

- immutable UUID `id`, `document_id`, and `profile_id`;
- raw/display name, model-generated key as a non-authoritative hint, numeric value, unit, and study/observed date;
- source page, source text or locator, optional bounding box/confidence, modality/body-region context, extraction model, and processing version when available;
- a required occurrence discriminator within its source locator;
- a canonical extraction-snapshot fingerprint, `is_current`, and supersession metadata.

The extractor contract is expanded so every numeric measure carries source location/context and an occurrence discriminator. A model key is stored only as raw extraction output; it is never a database identity. If page/snippet evidence is unavailable, the extractor/worker must still produce a deterministic source locator and ordinal for that document snapshot. A payload without an unambiguous occurrence discriminator is rejected rather than silently collapsed.

`observations` gains nullable `source_instrumental_measure_id`, a foreign key to the new source table, and a partial unique index on that column. New instrumental rows must have this source ID and must not carry laboratory source or normalization-revision lineage. They also do not receive Registry 2.0 analyte or measurement-definition links in EH-105. Existing laboratory source identity remains `source_extracted_biomarker_id`; no generic `MATCH FULL`, laboratory pair constraint, or EH-104 Phase B guard is added here.

The resulting model is deliberately type-specific rather than a premature generic source table:

```text
document_extracted_biomarkers
  -> observations.source_extracted_biomarker_id         (laboratory)
  -> observation_normalization_revisions                (EH-104 / EH-106)

document_extracted_instrumental_measures
  -> observations.source_instrumental_measure_id        (instrumental)
  -> no laboratory semantic/revision linkage in EH-105
```

**Why this over `document_id + measure.key`:** a document can contain repeated equal keys, and a key generated by the extraction model can change without the source evidence changing. A source row preserves the distinction and audit evidence that a composite key cannot.

### 2. Reprocess creates or reuses a source snapshot, never delete-then-insert

The source table is append-only for raw measure evidence. A canonical snapshot fingerprint and locator-plus-occurrence discriminator identify an exact replay of an extraction result. Repeating the same snapshot reuses its source rows and observations; a changed result creates new source rows and marks the preceding current rows as superseded only after the new snapshot has been materialized successfully.

Default document readers select current instrumental source rows. Superseded records remain auditable and do not participate in current projections. This avoids both duplicate observations on retry and destructive replacement before a viable new snapshot exists.

**Alternative considered:** unique `(document_id, normalized_measure_key)`, optionally with an ordinal. It was rejected because it makes model output a persistence identity and cannot safely identify source occurrences across reprocessing.

### 3. Use a service-only atomic instrumental materialization RPC

Add a dedicated, service-only RPC (for example `replace_document_instrumental_observations`) instead of sequencing source inserts, observation inserts, and prior-row deletion from the worker. It accepts the document/job identity, processing metadata, study date, and validated measure payload, then in one transaction:

1. locks and verifies the document, processing job, profile ownership, and `instrumental_report` type;
2. validates each measure's numeric value, source locator, and occurrence uniqueness;
3. creates or reuses the immutable source records for the submitted snapshot;
4. creates or reuses exactly one instrumental observation per source ID;
5. changes the current/superseded source state only after steps 1–4 succeed; and
6. returns the materialized IDs and whether the request was an idempotent replay.

The RPC uses a fixed `search_path`, has execution revoked from `PUBLIC`, `anon`, and `authenticated`, and is granted only to `service_role`. It validates source/profile/document ownership inside the transaction. This is separate from EH-104's laboratory normalization-revision CAS primitive and does not activate or modify normalization revisions.

The worker awaits the RPC result, throws on every Supabase write error, and updates `documents` and `document_processing_jobs` to completed only after the materialization succeeds. Any RPC or final-status write failure follows the existing failure path and leaves the previous current instrumental snapshot intact. The non-lab branch of `clearPriorExtractions` must no longer directly delete instrumental observations before replacement.

**Why an RPC over ordered client writes:** a client sequence can still fail after deleting or partially replacing data. A database transaction gives the source snapshot and its observations a single commit point and makes a network retry safe.

### 4. Establish a minimal typed reader boundary, not a consumer migration

Document observation DTOs include `observation_kind` and expose instrumental records only as typed instrumental data linked to their source document. Readers do not infer laboratory semantics from an observation's numeric fields.

Laboratory aggregation and assessment queries explicitly select `observation_kind = 'lab'`. Until EH-106 owns a complete typed presentation and runtime-consumer migration, instrumental rows are excluded from laboratory marker arrays, readiness, scoring, conversion, and assessment inputs. EH-105 does not add new trends, report, or Health Profile UI behavior.

**Why this narrow change:** EH-106 explicitly owns full biomarker APIs/UI, trends, reports, structured context, and runtime Registry 2.0 mapping. The safety boundary prevents accidental clinical interpretation without pre-empting that work.

### 5. Retire legacy observation-key tooling and verify active paths structurally

`scripts/backfill-biomarker-aliases.mjs` is retired or replaced with an explicit fail-fast notice; it must not be retargeted to a semantic Registry 2.0 field because alias rewrite semantics belong to the EH-106 mapping workflow. All active writer and reader paths are audited, including `src/`, `worker/`, and `scripts/`.

Add a scoped static check that fails when active runtime/tooling code queries, inserts, updates, filters, or selects `biomarker_key` on `observations`. The check distinguishes the `observations` table from legitimate raw extraction fields such as `document_extracted_biomarkers.biomarker_key`, and excludes historical migrations, archived OpenSpec material, and intentionally legacy test fixtures. It is run in CI with the relevant worker and application tests.

## Risks / Trade-offs

- **[Extraction output lacks stable source context]** → Require locator and occurrence fields in the instrumental extraction schema, reject invalid payloads, and test repeated equal-looking measures.
- **[Concurrent reprocesses race]** → Lock the document/job in the RPC, retain the existing active-job invariant, and test competing snapshot attempts.
- **[Superseded source history increases storage]** → Keep current-row indexes for normal reads, retain document-owned evidence for audit, and let document deletion/reset clean document-derived rows according to the existing lifecycle policy.
- **[A reader accidentally treats an instrumental row as laboratory data]** → Make `observation_kind` required in DTOs, add an explicit laboratory query filter, and test the assessment input boundary.
- **[Old utility scripts continue to fail after migration 025]** → Retire the alias backfill and enforce the structural static check in CI.
- **[A migration is deployed before the compatible worker]** → Deploy schema/RPC and compatible worker as one release; do not resume instrumental jobs until the worker is live. A rollback is forward-only because migration 025 already removed the old column.

## Migration Plan

1. Add the new instrumental source table, indexes, RLS/service grants, `observations.source_instrumental_measure_id`, and instrumental-only lineage constraints in a new migration after EH-104 Phase A. Do not alter the existing laboratory source index or recreate `biomarker_key`.
2. Add the service-only materialization RPC and pgTAP coverage for ownership, source uniqueness, current/superseded transitions, idempotent replay, and denied client execution.
3. Extend instrumental extraction output and validation with page/context/occurrence information. Replace the worker's delete-then-insert branch with the RPC and make every relevant Supabase write error fatal before success status is written.
4. Retire the legacy alias-backfill script, add the scoped static check, and update document/Health Profile read boundaries.
5. Run `supabase db reset` on a disposable database, the database fixture suite, worker integration tests, and the static check. Reprocess development instrumental documents rather than migrating legacy instrumental observations.
6. Deploy in schema/RPC then compatible-worker order while jobs are paused or drained. Verify a duplicate-key instrumental report, an unchanged retry, a changed reprocess, and a forced write failure before treating the release as complete.

Rollback is not a return to `biomarker_key`. If a post-deployment issue is found before valuable data exists, stop instrumental processing, apply a forward corrective migration or reset the explicitly disposable environment, then reprocess documents. Persistent environments must report invalid legacy instrumental rows rather than fabricate lineage.

## Open Questions

- No implementation-blocking question remains. EH-106 will decide the complete product presentation and consumer semantics for instrumental observations once its Registry 2.0 runtime cutover begins.
