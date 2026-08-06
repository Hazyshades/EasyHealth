## MODIFIED Requirements

### Requirement: Matching SHALL use declared bounded policies only
The alias-admission boundary SHALL compare labels only with the active alias's declared `exact`, `normalized`, `ocr_variant`, or `bounded_fuzzy` policy, or with the derived order-insensitive `token_set` projection of an `exact` or `normalized` alias. `exact` MUST use canonical Unicode/trimmed literal comparison; `normalized` MUST use the catalog normalization token; `ocr_variant` MUST match an explicitly declared variant; and `bounded_fuzzy` MUST declare a maximum Damerau-Levenshtein distance of one or two, require a normalized input length of at least five, and have active reviewed-resolution authority. `token_set` MUST compare the sorted distinct token multiset-free projection of the alias's normalization token against the same projection of the input, MUST require at least two tokens on both sides, and MUST NOT be derived from an `ocr_variant` or `bounded_fuzzy` alias. The resolver MUST NOT use substring, token-containment, phonetic, unbounded edit-distance, or implicit proposed-key matching.

#### Scenario: Fuzzy input within a reviewed bound is admitted
- **WHEN** a normalized extraction label of at least five characters is within the declared distance of one from an active reviewed bounded-fuzzy alias
- **THEN** the admission result MUST identify that alias key, its match type, and its authority

#### Scenario: Over-distance text is not admitted
- **WHEN** an extraction label exceeds the bounded-fuzzy alias's declared distance
- **THEN** the alias MUST NOT be admitted

#### Scenario: Unsupported fuzzy authority is rejected
- **WHEN** a provisional or recognition-only alias declares `bounded_fuzzy`
- **THEN** the catalog build MUST reject the alias

#### Scenario: Reordered label is admitted by token set
- **WHEN** an input label's normalization token is a reordering of an active `exact` or `normalized` alias's token, such as `alanine_aminotransferase_alt` against `alt_alanine_aminotransferase`
- **THEN** the alias MUST be admitted with match type `token_set`
- **AND** the admission MUST carry the source alias's own authority, approval status, lifecycle, and provenance

#### Scenario: Single-token labels gain nothing from token set
- **WHEN** either the input or the alias projects to fewer than two distinct tokens
- **THEN** `token_set` MUST NOT admit the alias, because ordered matching already covers that case

#### Scenario: Relaxed modes are not further relaxed
- **WHEN** an alias declares `ocr_variant` or `bounded_fuzzy`
- **THEN** no `token_set` projection MUST be derived from it

#### Scenario: Token containment is still forbidden
- **WHEN** an input's token set is a strict superset or subset of an alias's token set, such as `neutrophils_absolute_neu` against `neutrophils_neu`
- **THEN** the alias MUST NOT be admitted

### Requirement: Resolver evidence SHALL identify the admitted alias
The alias-admission boundary SHALL return the matched alias key, match type, authority, approval status, lifecycle, and source provenance with every candidate admission. The reported match type SHALL be the mode that actually fired, which for an order-insensitive admission SHALL be `token_set` rather than the alias's authored match type. Candidate evidence SHALL preserve the matched alias identity and alias-specific reason code. Downstream resolver policy MUST consume this admission and MUST NOT recreate matching by direct normalized-string comparison.

#### Scenario: Candidate evidence records authority source
- **WHEN** the resolver evaluates a candidate admitted by an alias
- **THEN** its evidence MUST identify the exact alias record and declared matching policy used

#### Scenario: Order-insensitive admission is reported as such
- **WHEN** a candidate is admitted through the derived token-set projection of a `normalized` alias
- **THEN** the candidate evidence MUST report reason code `alias_token_set_match` and match type `token_set`
- **AND** MUST NOT report `alias_normalized_match`

## ADDED Requirements

### Requirement: Token-set projections SHALL be collision-free across reviewed analytes
The catalog build SHALL reject a state in which two distinct reviewed **analytes** expose the same token-set projection through an admission-eligible alias. Specimen, timing and method variants of the same analyte SHALL be permitted to share a projection, because their co-candidacy is the designed input to the compatibility axes and the ordered modes already admit them together. A collision between a reviewed analyte and a provisional or recognition-only definition SHALL be permitted, because such an admission cannot produce a `resolved` outcome. The invariant SHALL be enforced by a static check that runs in the registry verification suite, not only at runtime.

#### Scenario: Colliding reviewed analytes fail the build
- **WHEN** two reviewed definitions with different analyte keys would both be admitted by the same token-set projection
- **THEN** the registry verification suite MUST fail and name both analyte keys

#### Scenario: Specimen variants of one analyte are not a collision
- **WHEN** a serum and a plasma definition of the same analyte share the projection of an authored alias such as `alanine_aminotransferase`
- **THEN** the build MUST succeed
- **AND** both definitions MUST remain co-candidates so the specimen axis can separate them

#### Scenario: Reviewed and provisional collision is allowed
- **WHEN** a reviewed definition and a recognition-only fixture definition share a token-set projection
- **THEN** the build MUST succeed and the recognition-only candidate MUST remain inadmissible for `resolved`

### Requirement: Order-insensitive admission SHALL score below ordered admission
The evidence weight granted to a `token_set` admission SHALL be strictly lower than the weight granted to `exact` and `normalized` admissions, so that a reordered label requires additional compatible axis evidence before it can reach the concrete-resolution bar. Admissibility guards SHALL be unchanged: reviewed maturity, `registry_v2_review` provenance, `reviewed_resolution` alias authority, empty missing axes, the score threshold, and the runner-up margin all continue to apply.

#### Scenario: Reordered label with only a unit stays incomplete
- **WHEN** a reordered label is admitted by token set and the input supplies a compatible unit but no specimen for a specimen-bearing definition
- **THEN** the outcome MUST NOT be `resolved`
- **AND** the missing specimen axis MUST be reported

#### Scenario: Reordered label with full axis evidence can resolve
- **WHEN** a reordered label is admitted by token set and every required axis is present and compatible
- **THEN** the candidate MAY reach the concrete-resolution bar under the unchanged guards
