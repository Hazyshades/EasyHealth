## ADDED Requirements

### Requirement: Candidate corpus consumes shared prepared identity

The candidate-release corpus SHALL prepare each fixture through the same evidence-preparation and Resolver input identity seam used by production writers. Corpus output SHALL report prepared input identity separately from candidate/release artifact identity, and corpus execution SHALL remain non-mutating.

#### Scenario: Corpus and writer agree on prepared identity

- **WHEN** a de-identified fixture is passed through the candidate corpus and the production preparation adapter with equivalent row evidence
- **THEN** both paths SHALL produce the same prepared identity hash and identity-format version
- **AND** differing candidate release metadata SHALL not be folded into the prepared input identity

#### Scenario: Corpus preserves panel-policy provenance

- **WHEN** a fixture receives a specimen from a reviewed panel policy
- **THEN** the corpus report SHALL identify the policy-derived provenance separately from a stated specimen
- **AND** the report SHALL not persist or hash the raw captured heading as the identity representation


#### Scenario: Fixture panel metadata is not Resolver evidence

- **WHEN** a corpus fixture has a `panel` classification and a captured
  `section_context` heading
- **THEN** preparation SHALL use the captured provenance and source analyte
  allowlist, not the fixture classification, to admit panel policy
- **AND** the corpus SHALL produce the same prepared identity as the
  equivalent production writer row
#### Scenario: Corpus remains non-mutating

- **WHEN** the corpus evaluates a fixture under a candidate release
- **THEN** it SHALL not create, activate, or modify observations, normalization revisions, or reprocessing rows
- **AND** it SHALL retain input and release identities only in the candidate report
