## ADDED Requirements

### Requirement: Laboratory source identity is a full same-source pair under Phase B

After Phase B enforcement, a laboratory observation that participates in
document-derived normalization SHALL identify its source through the paired
columns `source_extracted_biomarker_id` and `normalization_revision_id`. The
pair SHALL reference one extracted biomarker and its revision under the
composite `MATCH FULL` relation. Writers SHALL NOT create laboratory
observations that set only one side of the pair. Instrumental observations
SHALL continue to use `source_instrumental_measure_id` with both laboratory
lineage columns null.

#### Scenario: Laboratory accept stores both lineage columns together

- **WHEN** the atomic laboratory writer persists an accepted extraction row
- **THEN** the observation has both `source_extracted_biomarker_id` and
  `normalization_revision_id` set to the same-source pair after promotion

#### Scenario: Instrumental observation stays outside laboratory pair

- **WHEN** an instrumental measure is materialized
- **THEN** the observation has `source_instrumental_measure_id` set
- **AND** both laboratory lineage columns remain null

#### Scenario: Half-link cannot become an identity row

- **WHEN** any writer attempts to persist a laboratory observation with only
  one laboratory lineage column
- **THEN** the database rejects the row and no identity is committed
