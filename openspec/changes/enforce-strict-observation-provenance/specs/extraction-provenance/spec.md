## ADDED Requirements

### Requirement: Observation provenance is immutable after INSERT

For every observation source type, the database MUST reject `NEW.field IS DISTINCT FROM OLD.field` for `profile_id`, `document_id`, `observation_kind`, `raw_name`, `raw_value_text`, `raw_reference_text`, `raw_unit`, `source_page`, `source_text`, `bounding_box`, `confidence`, `extraction_version`, `provenance_schema_version`, `catalog_manifest_version`, `catalog_manifest_digest`, `resolver_version`, and `normalization_version`. Equal retries are allowed; nullable values may be null at INSERT but cannot be completed later.

#### Scenario: Null provenance is completed at runtime

- **WHEN** an update changes any protected field from null to a value
- **THEN** the database rejects the update
- **AND** the caller must create the appropriate new source/revision path

#### Scenario: Protected provenance is cleared or changed

- **WHEN** an update changes a protected value to null or another value
- **THEN** the database rejects the update

#### Scenario: Equal retry occurs

- **WHEN** a retry supplies values not distinct from the stored protected fields
- **THEN** the provenance guard permits the no-op retry

### Requirement: Source-type INSERT policies are explicit

Document-derived laboratory, document-derived instrumental, and non-document laboratory observations MUST satisfy their own source policy at INSERT. A row cannot later change source type or acquire document lineage through runtime enrichment.

#### Scenario: Document-derived laboratory observation is inserted

- **WHEN** the atomic laboratory writer creates an observation
- **THEN** profile/document/kind, extracted-source identity, raw name, provenance schema, extraction version, catalog manifest version/digest, resolver version, and normalization version are present
- **AND** optional raw reference/unit/page/snippet/bounding-box/confidence fields are final whether populated or null

#### Scenario: Instrumental observation is inserted

- **WHEN** an instrumental observation is prepared
- **THEN** `source_instrumental_measure_id` is present and immutable
- **AND** laboratory source/revision/catalog projection fields are null
- **AND** its immutable source measure contains the required raw value/unit, occurrence, locator, processing/model, and snapshot provenance

#### Scenario: Non-document laboratory observation is inserted

- **WHEN** a laboratory observation has no source document
- **THEN** document and extraction-lineage fields remain null according to policy
- **AND** later attachment to document-derived lineage is rejected

### Requirement: Existing nulls use migration-only controlled backfill

Runtime roles MUST NOT have a provenance enrichment path. Any approved retained-data backfill MUST run from an explicit manifest with expected old-row digests and exact target values, produce auditable results, and be revoked or dropped after migration.

#### Scenario: Approved manifest row still matches

- **WHEN** migration backfill targets an authorized row whose protected fields still match the expected null state/digest
- **THEN** the exact approved values are written and recorded before strict enforcement

#### Scenario: Backfill target is broadened or repeated

- **WHEN** a row is absent from the manifest, no longer matches expected state, belongs to another owner/source, or was already changed
- **THEN** the procedure rejects it without partial backfill

#### Scenario: Service or authenticated role invokes backfill

- **WHEN** a runtime role attempts to execute the migration procedure
- **THEN** permission is denied
