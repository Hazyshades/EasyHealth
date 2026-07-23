## Why

The EH-103 trigger permits `NULL → value` updates for provenance fields even though raw evidence, source identity, ownership, observation kind, and processing-version snapshots are specified as immutable after creation. The current service-role policy/privileges also allow direct table writes, and migration 034 exposes a forgeable session-GUC purge exception. Static tests and a missing integration runner do not prove runtime enforcement.

Strict provenance cannot safely deploy before document deletion changes from lineage-nulling to direct transactional row deletion. Once durable deletion owns final purge, the temporary exception must be removed and every observation writer must use a constrained database function.

## What Changes

- Move this change after durable document deletion; remove the temporary provenance purge authorization and the legacy lineage-nulling purge rather than preserving a runtime bypass.
- Enforce one exact common immutable field set: `profile_id`, `document_id`, `observation_kind`, raw evidence, processing-version snapshots, and source identity. Any difference, including `NULL → value`, `value → NULL`, or changed non-null value, requires a new source/observation path.
- Enforce source-specific lineage: laboratory observations require immutable `source_extracted_biomarker_id`; instrumental observations require immutable `source_instrumental_measure_id`; non-document/non-lab source types use explicit source contracts rather than inferred nullable completion.
- Keep only the EH-104/EH-106 active normalization projection mutable: `normalization_revision_id`, `measurement_definition_key`, `analyte_key`, and `resolution_status`, under one constrained SECURITY DEFINER projection writer.
- Revoke direct `INSERT`, `UPDATE`, and `DELETE` on `observations` from runtime roles, including `service_role`. Route source creation, normalization projection, and durable final deletion through fixed-search-path, source/owner-specific database functions with explicit column authority.
- Do not expose a generic arbitrary-field observation mutator. Projection writer inputs identify an observation plus expected revision/source state; the database computes the allowed projection from authoritative revision data.
- Add target-specific, manifest-driven, migration-only backfill for retained null provenance. The manifest records exact ids, old-row digests/null state, exact expected values, provenance source, owner, and writer/version. The private procedure is one-shot, idempotent for equal retry, aborts atomically on drift, has no runtime grant, and is revoked/dropped after use.
- Replace the missing integration runner with real populated-migration plus pgTAP/role suites covering every source type, all null/value mutation matrices, equal retry, projection success, direct privilege negatives, and durable-delete success.

## Capabilities

### New Capabilities

- `extraction-provenance`: Strict immutable observation provenance and controlled migration-only backfill.

### Modified Capabilities

- `observation-identity`: Freeze ownership, observation kind, and source identity while preserving the separately governed normalization projection.

## Impact

- **Domain:** documents.
- **Database:** trigger replacement, runtime table-privilege revocation, constrained writer functions, target-specific migration manifest/procedure, and removal of the temporary purge bypass.
- **Writers:** EH-106 laboratory writer, atomic instrumental finalizer, normalization projection writer, and durable deletion finalizer become the only observation mutation authorities.
- **Security:** service-role possession alone cannot issue arbitrary observation inserts/updates/deletes; function inputs and database source/owner checks bound every write.
- **Verification:** populated migration, pgTAP, direct-role negatives, equal retry, writer success, and durable-delete integration run in CI and target preflight/smoke.
- **Delivery:** depends on durable document deletion. This change is required before production/Sprint 1 closure and must record removal of both temporary purge paths.
