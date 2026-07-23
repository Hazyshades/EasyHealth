## Why

The EH-103 trigger permits `NULL → value` updates for provenance fields even though the specification says raw evidence, source identity, and processing-version snapshots are immutable after observation creation. The same trigger also trusts a caller-settable custom GUC for laboratory purge, so ordinary service-role code can forge the bypass context.

## What Changes

- Enforce `NEW.field IS DISTINCT FROM OLD.field` for the exact immutable common fields: `profile_id`, `document_id`, `observation_kind`, `raw_name`, `raw_value_text`, `raw_reference_text`, `raw_unit`, `source_page`, `source_text`, `bounding_box`, `confidence`, `extraction_version`, `provenance_schema_version`, `catalog_manifest_version`, `catalog_manifest_digest`, `resolver_version`, and `normalization_version`.
- Enforce source-specific immutable lineage: `source_extracted_biomarker_id` for laboratory observations and `source_instrumental_measure_id` for instrumental observations.
- Keep active normalization projection fields—`normalization_revision_id`, `measurement_definition_key`, `analyte_key`, and `resolution_status`—outside this immutable set because EH-104/EH-106 deliberately update them atomically.
- Define INSERT policy by source type: document-derived laboratory, document-derived instrumental, and non-document laboratory. Nullable-at-creation provenance stays null; runtime may not complete it later.
- Add populated-data preflight and a separate migration-only controlled backfill for approved existing nulls. The backfill has an explicit target set, exact expected-null guards, audit output, negative role tests, and no runtime enrichment grant.
- Replace the forgeable `easyhealth.purge_lineage` GUC with a private, exact-operation authorization that cannot be manufactured by ordinary roles or used to mutate arbitrary fields. Mark this exception temporary and require durable deletion to remove it when final purge no longer clears lineage in place.
- Add pgTAP for `NULL → value`, `value → NULL`, changed value, equal retry, each source policy, controlled-backfill rejection, and purge-bypass forgery attempts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `extraction-provenance`: Make provenance fully immutable after INSERT, define source-type insertion requirements, and separate audited migration backfill from runtime writes.
- `observation-identity`: Freeze observation ownership, kind, and source-lineage identity while preserving the separately governed active normalization projection.

## Impact

- **Domain:** documents.
- **Database:** strict trigger replacement, populated-data preflight, controlled backfill, and temporary private purge authorization.
- **Writers:** every source type must provide its final provenance at INSERT or intentionally retain null forever.
- **Security:** role/grant negative tests prove callers cannot forge purge or backfill context.
- **Delivery:** implementation may proceed independently of atomic instrumental publication; production and Sprint 1 closure require this change plus removal or explicit temporary lifecycle of the purge exception.
