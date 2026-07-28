## ADDED Requirements

### Requirement: Resolver label candidates SHALL originate from alias authority admission
The resolver SHALL use EH-110's active alias-admission boundary as its sole source of label candidates. Every candidate SHALL retain the admitted alias key, match type, authority, approval, lifecycle, scope, and provenance. A model-proposed key or direct normalized-string comparison MUST NOT create, promote, or select a candidate. Only an active reviewed-resolution admission for an active reviewed definition MAY be concrete-eligible; provisional or recognition-only admissions MAY support recognition only.

#### Scenario: Proposed key cannot bypass authority
- **WHEN** an extraction proposes a definition key but its raw label has no active alias admission for that definition
- **THEN** the resolver MUST NOT add or select that definition from the proposed key

#### Scenario: Provisional admission remains recognition evidence
- **WHEN** an active provisional alias admits a provisional definition
- **THEN** the candidate evidence MUST be retained and the result MUST NOT select that definition as a concrete reviewed resolution

### Requirement: Resolver SHALL evaluate the versioned evidence matrix
The `evidence-1` policy SHALL evaluate admitted candidates across label admission, unit, specimen, value kind, timing, method, required modifier, section/panel, neighbouring rows, and reference shape. It SHALL award at most 100 points using these weights: exact/normalized/OCR/bounded-fuzzy alias admission 40/36/32/28; unit 20; specimen 15; value kind 10; timing 5; method 4; required modifier 2; section 2; neighbours 1; reference shape 1. Candidate evidence SHALL record every applicable support, absence, or conflict with its axis and observed/expected values.

#### Scenario: Corroborating document context adds bounded support
- **WHEN** a candidate has compatible section, neighbouring-row, and reference-shape evidence
- **THEN** the resolver MUST add no more than four combined context points and MUST preserve the individual context evidence entries

#### Scenario: Missing timing is recorded rather than inferred
- **WHEN** a concrete candidate declares a timing and the extraction provides none
- **THEN** the candidate MUST record `timing` as a missing identity axis and MUST NOT infer timing from the definition or label

### Requirement: Resolver SHALL make compatibility conflicts explicit
A stated incompatible unit dimension or unaccepted unit, specimen, value kind, timing, method, or required modifier SHALL create a hard conflict that prevents concrete eligibility. Missing unit SHALL be a hard conflict only when the definition's unit policy is `reject`; for `ambiguous` policy it SHALL be recorded as missing. Section/panel, neighbouring rows, and reference shape are corroborative in `evidence-1`: they MUST NOT create a candidate, erase a hard conflict, or independently reject a candidate.

#### Scenario: Value-kind mismatch is a hard conflict
- **WHEN** a numeric definition receives an explicit qualitative extracted value kind
- **THEN** the candidate evidence MUST contain a value-kind conflict and the candidate MUST NOT be concrete-eligible

#### Scenario: Context cannot override incompatible specimen
- **WHEN** a candidate has corroborating panel context but an explicit specimen conflicting with the definition
- **THEN** the candidate MUST remain ineligible for concrete selection

### Requirement: Resolver SHALL select candidates deterministically without lexical medical tie-breaking
A candidate is concrete-eligible only when it has active reviewed-resolution alias authority for an active reviewed definition, no hard conflict, no required missing identity axis, and an `evidence-1` score of at least 70. Candidates SHALL be ordered by descending score and then ascending definition key solely for reproducible evidence output. A sole concrete-eligible candidate, or a leading candidate at least eight points ahead of every other concrete-eligible candidate, SHALL be selected as `resolved`. Two or more concrete-eligible candidates whose leading margin is below eight SHALL be `ambiguous` with no selected definition; lexical order MUST NOT choose the winner.

#### Scenario: High-scoring near tie is ambiguous
- **WHEN** two reviewed concrete-eligible candidates score 86 and 82
- **THEN** the resolver MUST return `ambiguous`, select no definition, and preserve both ordered candidates and their four-point margin

#### Scenario: Decisive candidate is selected
- **WHEN** the highest reviewed concrete-eligible candidate scores 88 and the next scores 80
- **THEN** the resolver MUST return `resolved` with the 88-point definition selected

### Requirement: Resolver SHALL preserve the four-state incomplete outcome matrix
The resolver SHALL return `unmapped` only when no active alias admits recognition. It SHALL return `partial` when one or more aliases admit recognition but no reviewed concrete candidate qualifies because of provisional authority/definition, missing required identity axes, or non-winning compatible evidence. It SHALL return `ambiguous` only for the close reviewed concrete-eligible case. `resolved` SHALL contain exactly one selected reviewed definition. `partial`, `ambiguous`, and `unmapped` MUST contain no selected measurement-definition key and MUST remain compatible only with pending verification under the existing verification contract.

#### Scenario: Missing required evidence yields partial
- **WHEN** a reviewed alias and definition match but the required specimen evidence is absent
- **THEN** the resolver MUST return `partial`, retain the candidate and `specimen` missing axis, and select no definition

#### Scenario: No admission yields unmapped
- **WHEN** no active alias is admitted for an extracted label
- **THEN** the resolver MUST return `unmapped` with no selected definition

### Requirement: Mapping confidence SHALL be calculated from evidence
Every candidate SHALL expose its score and confidence as `score / 100`, rounded to two decimals. `MeasurementResolution.mappingConfidence` SHALL equal the selected candidate's calculated confidence and SHALL be zero when no candidate is selected. Confidence bands SHALL be high at 0.80 or above, medium from 0.50 through 0.79, and low below 0.50. The decision payload SHALL retain candidate score, selected score, qualification threshold, and winner margin; it MUST NOT assign confidence constants based solely on the final resolver-result enum.

#### Scenario: Two resolved mappings have distinct confidence
- **WHEN** two independent inputs each meet the selection rule with candidate scores of 82 and 96
- **THEN** their selected mapping confidences MUST be 0.82 and 0.96 rather than one shared resolved constant

#### Scenario: Ambiguity retains candidate confidence without selected mapping confidence
- **WHEN** closely scored candidates yield `ambiguous`
- **THEN** the response MUST retain each candidate's calculated confidence and report selected mapping confidence as zero

### Requirement: Manual correction SHALL retain calculated evidence
A manual correction SHALL require a reviewed candidate without a hard conflict and SHALL append manual audit evidence using the existing verification workflow. It MUST NOT assign a fixed mapping-confidence value or bypass the candidate evidence policy.

#### Scenario: Manual selection does not erase a conflict
- **WHEN** a user attempts to select a reviewed definition whose candidate has a hard unit conflict
- **THEN** the writer MUST reject the selection

### Requirement: Active revisions SHALL persist a versioned decision envelope
New normalization writes SHALL persist an `evidence-1` decision envelope containing ordered candidate evidence, alias-admission provenance, missing axes, conflicts, selected key, selected score/confidence, score threshold, winner margin, and evidence-policy version. Extracted-biomarker and normalization-revision records SHALL store the evidence-policy version. Input-evidence and writer-request hashes MUST include timing, method, laboratory, reference shape, value kind, and evidence-policy version. The existing atomic normalization writer SHALL be the sole writer for this envelope and active observation projections SHALL remain limited to the selected key and resolver result.

#### Scenario: Retry with changed timing is not reused
- **WHEN** a normalization retry has identical raw label and unit but a different timing input
- **THEN** its input-evidence hash and normalization request identity MUST differ

#### Scenario: Historic revision remains explicitly legacy
- **WHEN** a revision predates `evidence-1`
- **THEN** it MUST retain its legacy or null evidence-policy version without being rewritten or interpreted as an `evidence-1` decision

### Requirement: Read DTOs SHALL expose reproducible resolver evidence
Document normalization review and document-detail DTOs SHALL expose the active revision's evidence-policy version and typed decision envelope, including candidate alias keys, scores, confidence, conflicts, missing axes, and selection fields. DTO consumers MUST NOT reconstruct candidate matching or confidence from raw strings or the resolver result alone.

#### Scenario: Review response exposes the selected decision basis
- **WHEN** a document row has an active `evidence-1` revision
- **THEN** its normalization response MUST identify the policy version, ordered candidates, selected definition if any, and the evidence fields that justify the result