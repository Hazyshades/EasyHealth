## ADDED Requirements

### Requirement: Panel specimen policies are reviewed catalog entities

A panel specimen policy SHALL be a catalog entity declared alongside measurement definitions, carrying a stable key, the normalized heading forms it matches, the specimen it supplies, an explicit allowlist of analytes it may apply to, a maturity, a source provenance and a review reference. Policies SHALL be serialized into the release manifest so that the catalog manifest digest covers them and the candidate approval hash moves whenever a policy is added, changed or removed. A policy whose maturity is not `reviewed` SHALL NOT supply a specimen at runtime.

#### Scenario: Adding a policy moves the release digest
- **WHEN** a panel specimen policy is added to the catalog
- **THEN** the catalog manifest digest changes
- **AND** every approval pinned to the previous candidate input hash is invalidated

#### Scenario: A provisional policy supplies nothing
- **WHEN** a policy is declared with maturity other than `reviewed`
- **THEN** it MUST NOT supply a specimen to resolution

#### Scenario: Policies are stored where the catalog lives
- **WHEN** the release manifest is serialized
- **THEN** panel specimen policies appear in it alongside analytes and measurement definitions

### Requirement: A policy applies only to the analytes it declares

A panel specimen policy SHALL declare an explicit allowlist of analyte keys and SHALL supply its specimen only to candidates whose analyte appears in that allowlist. An analyte absent from the allowlist SHALL be treated exactly as if no policy matched, even when the row was printed under a matching heading. Analytes that have a reviewed definition for the policy's specimen but are not constituents of that panel SHALL be excluded by name.

#### Scenario: A constituent analyte receives the specimen
- **WHEN** a haematology analyte listed in the complete-blood-count allowlist is printed under a matching heading
- **THEN** the policy supplies `whole_blood` for that row

#### Scenario: A mis-sectioned analyte does not inherit the specimen
- **WHEN** a glucose row is printed under a complete-blood-count heading
- **THEN** the policy MUST NOT supply a specimen
- **AND** the row reports the specimen axis as missing

#### Scenario: Score-affecting non-constituents are excluded by name
- **WHEN** the complete-blood-count policy is evaluated
- **THEN** `glucose` and `hba1c` MUST be absent from its allowlist even though both have reviewed whole-blood definitions

### Requirement: Heading matching is deterministic and fails closed

Heading matching SHALL compare the captured section heading against the policy's declared normalized forms using the catalog normalization token. Matching MUST NOT use regular expressions, substring containment of arbitrary fragments, or model inference. A heading that matches no declared form SHALL yield no policy and the specimen axis SHALL remain missing.

#### Scenario: Declared form matches
- **WHEN** a row's captured heading normalizes to a form declared by a reviewed policy
- **THEN** that policy is selected

#### Scenario: Unrecognized heading yields nothing
- **WHEN** a row's captured heading matches no declared form
- **THEN** no specimen is supplied and the outcome reports the specimen as missing

#### Scenario: Absent heading yields nothing
- **WHEN** a row has no captured section heading
- **THEN** no policy is evaluated for that row

### Requirement: A policy-derived specimen is never presented as stated

A specimen supplied by a policy SHALL be recorded with its source distinguished from a specimen the document printed. Resolution SHALL emit the reason code `specimen_from_reviewed_panel` for a policy-derived specimen and `specimen_compatible` only for a specimen the document states. The evidence weight of a policy-derived specimen SHALL be strictly lower than that of a stated specimen, so that a panel heading alone cannot lift a candidate over the concrete-resolution bar that a stated specimen would.

#### Scenario: Trace distinguishes the two sources
- **WHEN** a candidate is satisfied by a policy-derived specimen
- **THEN** its accepted evidence contains `specimen_from_reviewed_panel`
- **AND** does not contain `specimen_compatible`

#### Scenario: Policy evidence carries less weight
- **WHEN** the same candidate is evaluated once with a stated specimen and once with a policy-derived specimen
- **THEN** the policy-derived evaluation scores strictly lower

### Requirement: Policies run after the stated-evidence filter, never before

The stated-evidence filter that removes an axis value the document does not state SHALL run first and unconditionally. A panel policy SHALL only ever supply a specimen where the filter left the axis absent, and SHALL NOT preserve, restore or confirm a value supplied by the extraction model.

#### Scenario: A model guess is replaced, not preserved
- **WHEN** the extraction model supplied `serum` for a row printed under a complete-blood-count heading
- **THEN** the stated-evidence filter removes `serum`
- **AND** the policy supplies `whole_blood`, not the model's value

#### Scenario: A stated specimen is not overridden
- **WHEN** a row states its specimen in its own provenance and also matches a policy whose specimen differs
- **THEN** the stated specimen is used and reported as stated

### Requirement: Policy heading coverage is measurable

The system SHALL be able to report captured section headings that matched no reviewed policy, so that laboratories whose heading wording is not yet covered are visible rather than silently degrading to `partial`.

#### Scenario: Uncovered heading is reportable
- **WHEN** a document carries a heading that no policy matches
- **THEN** an audit can list that heading together with the number of affected rows
