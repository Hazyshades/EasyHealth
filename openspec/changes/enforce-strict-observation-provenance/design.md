## Context

`enforce_observation_provenance_write_once()` currently rejects a field change only when the old value is non-null. That permits runtime enrichment from null, despite EH-103 requiring a new observation/revision path for different source or processing provenance. Migration 034 also lets a caller forge purge context by setting `easyhealth.purge_lineage=on`.

Observation normalization projection is intentionally mutable under EH-104/EH-106 and must not be confused with source provenance. Instrumental raw evidence is primarily held in `document_extracted_instrumental_measures`, while laboratory evidence is copied onto `observations`.

## Goals / Non-Goals

**Goals:**

- Enumerate and enforce the immutable fields for each existing observation source type.
- Reject every distinct post-INSERT provenance transition, including null completion.
- Preserve equal idempotent retries and the legitimate mutable normalization projection.
- Backfill retained nulls only through audited migration machinery.
- Replace the forgeable GUC bypass and give its temporary lifecycle an owner.

**Non-Goals:**

- Make normalization projection fields immutable.
- Infer missing provenance during runtime updates.
- Introduce a new observation kind or EH-115 explanation model.

## Decisions

### 1. Define the immutable field sets explicitly

**Common observation identity/provenance, all source types:**

`profile_id`, `document_id`, `observation_kind`, `raw_name`, `raw_value_text`, `raw_reference_text`, `raw_unit`, `source_page`, `source_text`, `bounding_box`, `confidence`, `extraction_version`, `provenance_schema_version`, `catalog_manifest_version`, `catalog_manifest_digest`, `resolver_version`, and `normalization_version`.

A trigger rejects `NEW.field IS DISTINCT FROM OLD.field` for each field. Nullable values may be null at INSERT but remain null thereafter. Database-managed `id` and `created_at` are also immutable through grants/defaults but are not caller provenance inputs.

**Document-derived laboratory observation:**

- `document_id`, `source_extracted_biomarker_id`, `raw_name`, `provenance_schema_version`, `extraction_version`, catalog manifest version/digest, resolver version, and normalization version are present at the atomic writer boundary.
- Raw value/reference/unit and page/snippet/bounding-box/confidence are stored when source extraction provides them; missing optional evidence remains null.
- `source_extracted_biomarker_id` is immutable.
- `normalization_revision_id`, `measurement_definition_key`, `analyte_key`, and `resolution_status` are the mutable active projection and are excluded from this trigger. At rest, EH-104 still requires the source/revision same-source pair.

**Document-derived instrumental observation:**

- `document_id`, `observation_kind='instrumental'`, and `source_instrumental_measure_id` are required by the source-lineage contract and immutable.
- Both laboratory lineage columns and laboratory catalog/resolver projection fields remain null.
- The referenced instrumental measure is authoritative for `raw_name`, `raw_value_text`, `raw_unit`, `observed_at`, `source_locator`, `occurrence_index`, source context, processing/model versions, and snapshot content/hash; those source fields are immutable through the snapshot-content contract.
- Any provenance copies present on the observation are frozen by the common set.

**Non-document laboratory observation:**

- `document_id`, laboratory source ids, and document-extraction version fields may be null according to the insertion contract.
- Any supplied common provenance is final at INSERT; the row cannot later be converted into a document-derived observation by filling lineage/version fields.

### 2. Validate source policy at INSERT

Insert guards reject cross-type lineage, instrumental observations without their source, document-derived laboratory writes missing mandatory writer-boundary provenance, and attempts to attach document provenance later. Equal upsert retries compare the complete immutable set.

The policy is enforced in database writers as well as application validation so service-role code cannot bypass it with a direct table update.

### 3. Keep projection mutation separate

The strict trigger does not block the EH-106 atomic writer from changing `normalization_revision_id`, `measurement_definition_key`, `analyte_key`, or `resolution_status`, provided immutable source identity remains unchanged and the composite same-source constraint passes.

### 4. Use preflight plus a migration-only backfill

Preflight reports each existing null by source type, field, document, writer/version, and whether an authoritative source exists. Retained environments abort strict enforcement until every approved target has an explicit migration decision.

A migration-only security-definer procedure accepts a fixed manifest of observation ids, expected old-row digests, exact field values, and evidence source. It updates only rows that still match the expected null state, emits result evidence, has no `service_role`/client grant, and is revoked/dropped after the migration. Repeated, broadened, non-null, cross-owner, or unmanifested updates fail.

### 5. Replace GUC bypass with exact private authorization

A private schema owned by a no-login migration/function owner records transaction-, backend-, operation-, observation-, and exact-transition-scoped authorization. Generic `service_role`, `PUBLIC`, `anon`, and `authenticated` cannot read, insert, or manufacture it. The controlled purge entry point can authorize only the exact paired lineage-clearing transition for locked rows of one document; the trigger compares the expected before/after digest and rejects every other field change.

This is an interim compatibility mechanism, not a reusable mutation API. The durable deletion change owns removal of the authorization table/path and the lineage-nulling purge once final deletion directly removes derived observations.

## Risks / Trade-offs

- **[Existing writers rely on null completion]** → Inventory every INSERT/UPDATE path and fail preflight before enabling the strict trigger.
- **[Mandatory laboratory version field is unavailable]** → Reject the write or create a source/revision path; do not weaken runtime immutability.
- **[Private purge authorization becomes permanent]** → Mark its owner/removal condition explicitly in durable deletion tasks and release gates.
- **[Projection updates are accidentally blocked]** → Keep the mutable field list explicit and cover EH-106 writer success in pgTAP.
- **[Service role calls a dangerous generic function]** → Expose only document-scoped exact purge behavior; never grant direct authorization-table or arbitrary-field access.
