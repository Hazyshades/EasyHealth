## Context

`enforce_observation_provenance_write_once()` currently rejects a protected-field change only when the old value is non-null. That permits runtime enrichment from null despite EH-103 requiring a new observation/revision path for different source or processing provenance.

Migration 034 retains this behavior and adds `easyhealth.purge_lineage=on`, a caller-settable session switch that temporarily clears source/revision lineage during document purge. Durable document deletion now precedes this change and deletes observations directly before deleting the document, so no runtime provenance exception is needed.

Observation normalization projection is intentionally mutable under EH-104/EH-106 and must not be confused with source provenance. Instrumental raw evidence is primarily held by immutable snapshot content/source rows, while laboratory evidence is copied onto observations. Runtime roles currently have broad service-role table authority, so a strict trigger alone does not provide least privilege.

## Goals / Non-Goals

**Goals:**

- Enforce the exact immutable contract for every source type, including null completion.
- Preserve equal idempotent retries and the narrowly mutable normalization projection.
- Make database writer functions, not trusted caller convention, the exclusive observation write boundary.
- Backfill retained nulls only through attributable, drift-checked, target-specific migration machinery.
- Remove both the forgeable purge GUC and the legacy lineage-nulling purge.
- Prove behavior with populated data, real roles, real writers, and durable final deletion.

**Non-Goals:**

- Infer missing provenance during normal application execution.
- Make normalization projection immutable.
- Grant service role a generic arbitrary-field update/delete function.
- Allow null source lineage when a required source row/version does not exist.
- Deploy before durable deletion direct-purges observations.

## Decisions

### 1. Maintain one exact immutable-field contract

A shared database/application contract defines common immutable columns:

- ownership/identity: `profile_id`, `document_id`, `observation_kind`;
- raw evidence: `raw_name`, `raw_value_text`, `raw_reference_text`, `raw_unit`, `source_page`, `source_text`, `bounding_box`, `confidence`;
- version provenance: `extraction_version`, `provenance_schema_version`, `catalog_manifest_version`, `catalog_manifest_digest`, `resolver_version`, `normalization_version`.

Source-specific identity is also immutable:

- laboratory: `source_extracted_biomarker_id` is required and immutable; `source_instrumental_measure_id` is null;
- instrumental: `source_instrumental_measure_id` is required and immutable; `source_extracted_biomarker_id` is null;
- any supported non-document/non-lab kind: an explicit source policy defines required/null source fields before deployment.

The database compares each immutable column using `NEW.field IS DISTINCT FROM OLD.field`. Therefore null completion, clearing, and changed non-null values all fail; equal retries pass.

### 2. Keep normalization projection separate and bounded

Only these observation columns remain mutable for EH-104/EH-106 projection:

- `normalization_revision_id`;
- `measurement_definition_key`;
- `analyte_key`;
- `resolution_status`.

A constrained SECURITY DEFINER writer accepts observation identity, expected source/revision state, and requested authoritative revision id/action. It locks the observation/revision, verifies owner/source and same-source constraints, derives the projection fields from authoritative revision rows, and updates only the four listed columns. It does not accept arbitrary JSON or caller-supplied values for arbitrary columns.

All other observation mutation must create/delete through source-specific lifecycle functions.

### 3. Make functions the exclusive runtime mutation authority

After all callers are migrated:

- revoke direct `INSERT`, `UPDATE`, and `DELETE` on `public.observations` from `service_role`, `authenticated`, `anon`, and `PUBLIC`;
- retain SELECT only where existing server reads require it;
- permit observation writes only through fixed-search-path SECURITY DEFINER functions with explicit ownership/source/version checks;
- keep function ownership in the migration/admin role and grant execute only to `service_role` for the exact runtime functions;
- revoke execute from `PUBLIC`, `anon`, and `authenticated`.

The allowed runtime authorities are:

- the EH-106 atomic laboratory source/revision/observation writer for laboratory creation;
- the atomic instrumental prepare/finalizer writer for instrumental creation/publication;
- the constrained normalization projection writer for the four mutable columns;
- the durable deletion finalizer for direct observation deletion after storage proof.

No generic direct table fallback or broad observation mutation function remains.

### 4. Remove runtime purge exceptions

The strict migration drops the lineage-nulling purge function/path and removes all use of `easyhealth.purge_lineage`. The provenance trigger contains no session-setting bypass. Durable deletion's fixed-search-path finalizer directly deletes observations before the document row, avoiding the `ON DELETE SET NULL` identity mutation.

Preflight fails if any application/worker/function still calls the old purge RPC or sets the GUC.

### 5. Backfill through a target-specific exact manifest

Retained nulls are grouped by source type, protected field, document/profile, authoritative evidence availability, and writer/version. No inference query directly updates observations.

For each approved target environment, an immutable manifest records:

- observation id and owner/source type;
- digest of the exact expected old protected fields (including nulls);
- exact target values;
- authoritative evidence ids/digest;
- review owner, timestamp, and backfill version.

A private migration-only procedure with fixed search path:

1. locks all manifest target observations in deterministic id order;
2. verifies row ownership/source and old-row digest for every row;
3. verifies authoritative source/revision evidence;
4. verifies every target value equals the reviewed manifest;
5. writes all rows in one transaction and emits aggregate/result evidence;
6. treats an exact already-applied row as idempotent success;
7. aborts the whole run for an absent, drifted, cross-owner, source-mismatched, or already differently changed row.

The procedure is never granted to runtime roles. After target application/evidence, execute is revoked and the procedure/manifest staging table is dropped in the same release sequence or an explicitly gated immediate cleanup migration.

### 6. Order rollout to avoid unsafe intervals

1. Deploy durable deletion and prove direct final purge.
2. Inventory all observation writers and revoke candidates.
3. Run retained-data preflight and review the target manifest.
4. Deploy writer-compatible functions/code before or in the same maintenance window as table privilege revocation and strict trigger.
5. Execute the reviewed manifest, enable strict trigger, revoke direct table mutation, remove old purge/GUC, and reload PostgREST schema cache.
6. Smoke laboratory, instrumental, non-document (if present), equal retry, projection update, direct-role denial, and durable deletion.

If required laboratory/instrumental lineage/version evidence is unavailable, preflight aborts or explicitly routes disposable data to reset/reprocess; runtime immutability is never weakened.

## Risks / Trade-offs

- **[Existing writer relies on direct table access]** → Complete source/RPC inventory and role-negative tests before revocation.
- **[Strict writer accidentally blocks projection]** → Keep the mutable list explicit and cover EH-106 projection success in pgTAP/API integration.
- **[SECURITY DEFINER becomes broad authority]** → Fixed search path, private ownership, typed inputs, row locks, owner/source checks, and no arbitrary field payload.
- **[Backfill manifest is stale]** → Exact old-row digest/evidence checks abort the whole transaction; regenerate/review rather than force.
- **[Private migration helper becomes permanent]** → No runtime grants and an explicit drop/revoke gate in deployment evidence.
- **[Direct document deletion triggers identity mutation]** → Durable finalizer deletes observations first; strict provenance deploys only after that path is proven.
- **[No valid required source/version exists]** → Reject retained migration or reset disposable data; do not create synthetic provenance.
