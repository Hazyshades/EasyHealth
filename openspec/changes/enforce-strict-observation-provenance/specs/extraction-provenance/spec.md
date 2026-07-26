## ADDED Requirements

### Requirement: Observation provenance is immutable after INSERT

For every observation source type, the database MUST reject `NEW.field IS DISTINCT FROM OLD.field` for `profile_id`, `document_id`, `observation_kind`, `raw_name`, `raw_value_text`, `raw_reference_text`, `raw_unit`, `source_page`, `source_text`, `bounding_box`, `confidence`, `extraction_version`, `provenance_schema_version`, `catalog_manifest_version`, `catalog_manifest_digest`, `resolver_version`, and `normalization_version`. Equal idempotent retries are allowed; nullable values may be null at INSERT only where the source contract permits and cannot be completed later.

#### Scenario: Null provenance is completed at runtime

- **WHEN** an update changes any protected provenance field from null to a value
- **THEN** the database rejects the update
- **AND** the caller must create the appropriate new source/observation/revision path

#### Scenario: Protected provenance is cleared or changed

- **WHEN** an update changes a protected value to null or another value
- **THEN** the database rejects the update atomically

#### Scenario: Equal retry occurs

- **WHEN** a retry supplies values not distinct from every stored protected field
- **THEN** the provenance guard permits the no-op/equal operation subject to the writer's other constraints

### Requirement: Source-specific provenance is complete at creation

Laboratory observations MUST be created through an authoritative extracted-biomarker source with immutable laboratory raw/version evidence. Instrumental observations MUST be created through an immutable snapshot-content/instrumental-measure source with immutable processing/version evidence. Any other supported observation kind MUST declare and enforce an explicit source policy before runtime writes are enabled.

#### Scenario: Laboratory source or required version is missing

- **WHEN** a laboratory writer cannot prove the extracted biomarker, owner/document, raw evidence, or mandatory version contract
- **THEN** insertion is rejected rather than creating a row for later enrichment

#### Scenario: Instrumental source is missing

- **WHEN** an instrumental writer cannot prove the immutable source measure/content and processing version
- **THEN** insertion is rejected

### Requirement: Protected fields follow an exact lab/instrumental nullability matrix

The database MUST enforce the following creation matrix and then reject any later `IS DISTINCT FROM` change to those fields:

- both kinds: `profile_id`, `document_id`, `observation_kind`, `raw_name`, `extraction_version`, and `provenance_schema_version` are required; `raw_value_text`, `raw_unit`, `source_page`, `source_text`, `bounding_box`, and `confidence` are nullable;
- `lab`: `source_extracted_biomarker_id`, `catalog_manifest_version`, `catalog_manifest_digest`, `resolver_version`, and `normalization_version` are required; `raw_reference_text` is nullable; `source_instrumental_measure_id` is forbidden;
- `instrumental`: `source_instrumental_measure_id` is required; `source_extracted_biomarker_id`, `raw_reference_text`, `catalog_manifest_version`, `catalog_manifest_digest`, `resolver_version`, and `normalization_version` are forbidden.

#### Scenario: Laboratory insert omits required catalog provenance

- **WHEN** a laboratory insert leaves `catalog_manifest_version` or `resolver_version` null
- **THEN** the database rejects the insert

#### Scenario: Instrumental insert sets laboratory-only provenance

- **WHEN** an instrumental insert supplies `catalog_manifest_digest` or `source_extracted_biomarker_id`
- **THEN** the database rejects the insert

#### Scenario: Nullable raw evidence remains null forever

- **WHEN** a laboratory observation is created with null `raw_unit` and a later update supplies a unit
- **THEN** the update is rejected

### Requirement: Normalization projection remains separately mutable

`normalization_revision_id`, `measurement_definition_key`, `analyte_key`, and `resolution_status` SHALL remain mutable only through the constrained normalization projection writer. The database SHALL derive them from the locked authoritative revision/source state; callers SHALL NOT update arbitrary projection values directly.

#### Scenario: Valid EH-106 projection change

- **WHEN** the service writer supplies an owned observation and a valid same-source authoritative revision
- **THEN** the database atomically derives and writes the four allowed projection fields
- **AND** every provenance/identity field remains unchanged

#### Scenario: Direct projection update is attempted

- **WHEN** service role or an application role updates an observation table column directly
- **THEN** permission is denied

### Requirement: Runtime observation writes use constrained database functions only

Direct `INSERT`, `UPDATE`, and `DELETE` privileges on `observations` MUST be revoked from `service_role`, `authenticated`, `anon`, and `PUBLIC`. The same direct DML privileges MUST be revoked on `observation_normalization_revisions`, `document_extracted_biomarkers`, `document_extracted_instrumental_measures`, and versioned instrumental content/findings tables that can change observation identity indirectly. Laboratory creation, instrumental creation/publication, normalization projection, and durable final deletion MUST use distinct fixed-search-path SECURITY DEFINER functions with internal ownership/source/version checks and the smallest column authority. No generic arbitrary-field mutator SHALL exist.

#### Scenario: Service role issues direct observation mutation

- **WHEN** service role attempts direct insert, update, or delete on `observations`
- **THEN** permission is denied and no row changes

#### Scenario: Application role invokes a writer function

- **WHEN** `anon` or `authenticated` invokes a service-only observation writer
- **THEN** permission is denied

#### Scenario: Service role mutates an authoritative revision or source table directly

- **WHEN** service role attempts direct insert/update/delete on `observation_normalization_revisions`, `document_extracted_biomarkers`, or `document_extracted_instrumental_measures`
- **THEN** permission is denied outside the exclusive writer functions

### Requirement: Cascade-capable parents cannot silently mutate observations

Foreign keys from observation source/parent rows MUST NOT implicitly delete or clear protected observation identity outside the durable deletion finalizer. In particular, `observations_instrumental_source_owner_fk` MUST use `ON DELETE RESTRICT` (or equivalent deny) rather than `ON DELETE CASCADE`, and negative tests MUST cover source, revision, document, and profile parent deletes.

#### Scenario: Instrumental measure delete is attempted while observations exist

- **WHEN** a caller deletes a `document_extracted_instrumental_measures` row that still has observations
- **THEN** the delete is rejected
- **AND** the observations remain unchanged

#### Scenario: Durable finalizer deletes in explicit order

- **WHEN** durable deletion has verified storage absence and runs final purge
- **THEN** it deletes observations and source/revision rows explicitly through its constrained finalizer
- **AND** no surviving observation has cleared lineage

### Requirement: Retained null provenance is backfilled only from an exact manifest

A target-specific reviewed manifest and private migration-only procedure MAY backfill retained null provenance before strict enforcement. The manifest MUST name exact observation ids, expected protected old-row digests/nulls, exact target values, authoritative evidence, owner, and writer/version. The procedure MUST lock and validate every row before writing any row, be idempotent only for exact already-applied results, have no runtime grants, and be revoked/dropped after use.

#### Scenario: Approved manifest row still matches

- **WHEN** every target row, owner/source, old-row digest, evidence, and exact target value matches the reviewed manifest
- **THEN** all backfill writes commit atomically and produce attributable evidence

#### Scenario: Backfill target is absent or drifted

- **WHEN** any row is absent, belongs to another owner/source, differs from expected old state/evidence, or already contains another value
- **THEN** the procedure rejects the entire run without partial backfill

#### Scenario: Runtime role invokes backfill

- **WHEN** service role, authenticated, or anonymous role attempts to execute the migration procedure
- **THEN** permission is denied

### Requirement: Provenance has no runtime purge bypass

The strict guard MUST contain no caller-settable GUC or role-based bypass. Durable deletion MUST directly delete observations through its constrained finalizer after storage proof, and the legacy lineage-nulling purge MUST be removed.

#### Scenario: Caller sets the old purge GUC

- **WHEN** a runtime caller sets `easyhealth.purge_lineage` and attempts a protected update
- **THEN** the update is still rejected or the setting is unused

#### Scenario: Durable final deletion runs

- **WHEN** the service-only deletion finalizer has verified tombstone, generation, writer quiescence, and storage absence
- **THEN** it directly deletes the document observations and commits the rest of final purge atomically
- **AND** it never clears protected lineage on a surviving row
