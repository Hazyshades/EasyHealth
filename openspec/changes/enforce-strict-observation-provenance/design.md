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

### 1. Maintain one exact immutable-field and nullability matrix

Every protected field has one of three creation statuses per observation kind: **required**, **nullable** (may be null at INSERT and forever), or **forbidden** (MUST be null). After INSERT, every field below is immutable under `NEW.field IS DISTINCT FROM OLD.field`.

| Field | `lab` | `instrumental` |
| --- | --- | --- |
| `profile_id` | required | required |
| `document_id` | required | required |
| `observation_kind` | required (`lab`) | required (`instrumental`) |
| `source_extracted_biomarker_id` | required | forbidden |
| `source_instrumental_measure_id` | forbidden | required |
| `raw_name` | required | required |
| `raw_value_text` | nullable | nullable |
| `raw_reference_text` | nullable | forbidden |
| `raw_unit` | nullable | nullable |
| `source_page` | nullable | nullable |
| `source_text` | nullable | nullable |
| `bounding_box` | nullable | nullable |
| `confidence` | nullable | nullable |
| `extraction_version` | required | required |
| `provenance_schema_version` | required | required |
| `catalog_manifest_version` | required | forbidden |
| `catalog_manifest_digest` | required | forbidden |
| `resolver_version` | required | forbidden |
| `normalization_version` | required | forbidden |

Notes:

- Laboratory raw unit/reference/value text may be null for unitless or qualitative printed results, but once set they cannot change.
- Instrumental observations MUST NOT carry laboratory catalog/resolver/normalization provenance columns; those remain null and immutable.
- Instrumental raw reference text is forbidden because instrumental measures do not use lab reference ranges on the observation row.
- Any future non-document/non-lab kind MUST publish the same matrix before runtime writes are enabled.
- Constraints/check constraints encode required/forbidden nullness at INSERT; the write-once trigger encodes immutability thereafter.
- Equal idempotent retries pass only when every protected field is not distinct from the stored value.

### 2. Keep normalization projection separate and bounded

Only these observation columns remain mutable for EH-104/EH-106 projection:

- `normalization_revision_id`;
- `measurement_definition_key`;
- `analyte_key`;
- `resolution_status`.

A constrained SECURITY DEFINER writer accepts observation identity, expected source/revision state, and requested authoritative revision id/action. It locks the observation/revision, verifies owner/source and same-source constraints, derives the projection fields from authoritative revision rows, and updates only the four listed columns. It does not accept arbitrary JSON or caller-supplied values for arbitrary columns.

All other observation mutation must create/delete through source-specific lifecycle functions.

### 3. Make functions the exclusive runtime mutation authority for observations and authoritative sources

After all callers are migrated:

- revoke direct `INSERT`, `UPDATE`, and `DELETE` on `public.observations` from `service_role`, `authenticated`, `anon`, and `PUBLIC`;
- revoke direct `INSERT`, `UPDATE`, and `DELETE` on authoritative source/revision tables that can mutate observation identity indirectly:
  - `public.observation_normalization_revisions`
  - `public.document_extracted_biomarkers`
  - `public.document_extracted_instrumental_measures`
  - versioned instrumental content/findings tables owned by atomic publication
- retain SELECT only where existing server reads require it;
- permit writes only through fixed-search-path SECURITY DEFINER functions with explicit ownership/source/version checks;
- keep function ownership in the migration/admin role and grant execute only to `service_role` for the exact runtime functions;
- revoke execute from `PUBLIC`, `anon`, and `authenticated`.

The allowed runtime authorities are:

- the EH-106 atomic laboratory source/revision/observation writer for laboratory creation and revision append/activation;
- the atomic instrumental prepare/finalizer writer for instrumental source/content/observation creation/publication;
- the constrained normalization projection writer for the four mutable observation columns;
- the durable deletion finalizer for direct observation and source/revision deletion after storage proof.

No generic direct table fallback or broad observation/source/revision mutation function remains.

Cascade-capable parent paths MUST NOT silently delete or mutate observations outside those writers:

- replace `observations_instrumental_source_owner_fk ... ON DELETE CASCADE` with `ON DELETE RESTRICT` (or equivalent deny), so deleting an instrumental measure cannot implicitly delete observations;
- inventory and lock down every parent FK from profile/document/source/revision that can cascade into observations or clear protected lineage;
- durable deletion deletes children explicitly in deterministic order inside its finalizer;
- negative tests attempt indirect observation mutation/deletion through source, revision, document, and profile parents and expect denial or explicit finalizer-only success.

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
- **[Revision/source table DML bypasses observation revocation]** → Revoke authoritative source/revision DML and route through the same exclusive writers.
- **[ON DELETE CASCADE deletes observations indirectly]** → Switch instrumental source FK to RESTRICT and add parent-path negative tests.
- **[Nullability matrix disagrees with writers]** → Encode one shared matrix in constraints, trigger tests, and writer validation.
- **[Strict writer accidentally blocks projection]** → Keep the mutable list explicit and cover EH-106 projection success in pgTAP/API integration.
- **[SECURITY DEFINER becomes broad authority]** → Fixed search path, private ownership, typed inputs, row locks, owner/source checks, and no arbitrary field payload.
- **[Backfill manifest is stale]** → Exact old-row digest/evidence checks abort the whole transaction; regenerate/review rather than force.
- **[Private migration helper becomes permanent]** → No runtime grants and an explicit drop/revoke gate in deployment evidence.
- **[Direct document deletion triggers identity mutation]** → Durable finalizer deletes observations first; strict provenance deploys only after that path is proven.
- **[No valid required source/version exists]** → Reject retained migration or reset disposable data; do not create synthetic provenance.
