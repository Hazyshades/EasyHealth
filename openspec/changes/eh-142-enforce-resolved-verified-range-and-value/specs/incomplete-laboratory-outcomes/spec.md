## MODIFIED Requirements

### Requirement: Definition-specific consumer exclusion
The system SHALL derive consumer eligibility from the active reviewed Registry 2.0 binding. Only eligible `resolved` rows SHALL enter definition-specific trend keys or series, conversion, abnormality interpretation, report biomarker context, or structured biomarker context.

Health Profile assessment admission SHALL additionally require all of the following from the same active revision and source observation:

- a current active `resolved` revision whose selected candidate matches a concrete reviewed Registry 2.0 measurement definition;
- a reviewed compatible assessment binding;
- verification status `auto_verified`, `user_verified`, or `manually_corrected`;
- value kind `numeric` and one finite numeric value; and
- a non-blank document-native `raw_reference_text` with at least one finite persisted reference boundary, where two supplied boundaries are not inverted.

A one-sided document-native reference range MAY be used. The system SHALL NOT invent a range from Registry, population, or generic thresholds when the source document has no usable range.

The assessment predicate SHALL fail closed and serialize one stable first-failure reason. Mapping failures SHALL retain `no_active_revision`, `incomplete_resolution`, `candidate_only_identity`, or `assessment_binding_ineligible` as applicable. The additional reasons SHALL be `verification_required`, `non_numeric_value`, `numeric_value_missing`, `numeric_value_invalid`, `missing_document_reference_range`, or `invalid_document_reference_range`.

An observation excluded by this predicate SHALL NOT affect Health Profile readiness, data confidence, highlighted findings, state scores, persisted assessment payloads, or holistic assessment inputs. It SHALL remain list-visible where raw results are shown. The Biomarkers API SHALL expose the strict `assessment_eligible` result and its `assessment_exclusion_reason`; the UI SHALL render safe assessment-specific guidance that explains non-inclusion without stating or implying that the source laboratory result is invalid.

`partial`, `ambiguous`, and `unmapped` rows SHALL remain list-visible where raw results are shown but SHALL be excluded from all definition-specific consumers with a stable exclusion reason.

#### Scenario: Pending resolved result is excluded from assessment
- **WHEN** a laboratory observation has an active resolved reviewed definition and compatible reviewed assessment binding but its verification status is `pending`
- **THEN** its assessment eligibility SHALL be false with `verification_required`, it SHALL not enter the Health Profile assessment input, and its raw result SHALL remain visible with safe non-inclusion guidance

#### Scenario: Incomplete outcome is excluded before score evidence is evaluated
- **WHEN** a laboratory observation is `partial`, `ambiguous`, or `unmapped`
- **THEN** its assessment eligibility SHALL be false with `incomplete_resolution`, it SHALL not affect Health Profile readiness, confidence, highlights, scores, or synthesis input, and no candidate identity SHALL be presented as active identity

#### Scenario: Qualitative result is excluded from numeric assessment
- **WHEN** a resolved verified observation with a reviewed compatible binding has `value_kind` other than `numeric`
- **THEN** its assessment eligibility SHALL be false with `non_numeric_value` and the UI SHALL explain that the result is not used in numeric assessment without calling the source result invalid

#### Scenario: Missing document-native range is excluded
- **WHEN** a resolved verified numeric observation with a reviewed compatible binding has blank `raw_reference_text` or no finite persisted reference boundary
- **THEN** its assessment eligibility SHALL be false with `missing_document_reference_range` and the system SHALL NOT substitute any non-source range

#### Scenario: Inverted document-native range is excluded
- **WHEN** a resolved verified numeric observation with a reviewed compatible binding has finite `ref_low` greater than finite `ref_high`
- **THEN** its assessment eligibility SHALL be false with `invalid_document_reference_range`

#### Scenario: Verified numeric source-backed result enters assessment
- **WHEN** a resolved active reviewed observation has a reviewed compatible binding, verified status, finite numeric value, and usable document-native range
- **THEN** its assessment eligibility SHALL be true and it MAY enter Health Profile assessment subject to the existing score role, specimen, readiness-group, and contribution-group policies

## ADDED Requirements

### Requirement: Assessment eligibility policy recalculation
When the assessment eligibility policy changes, the system SHALL requeue a Health Profile recalculation for every profile with a laboratory observation and mark its synthesis state stale. The requeue SHALL preserve an existing in-flight assessment job and SHALL NOT update or delete append-only assessment versions.

#### Scenario: Existing laboratory profile is recalculated under the new policy
- **WHEN** the EH-142 policy migration is applied for a profile with a laboratory observation and no in-flight calculation
- **THEN** the profile SHALL have a queued `health_profile` recalculation job and a stale synthesis state while historical assessment versions remain unchanged

#### Scenario: In-flight calculation is preserved
- **WHEN** the EH-142 policy migration encounters a profile whose `health_profile` calculation is already `processing`
- **THEN** the job SHALL remain `processing` and the migration SHALL not mutate its assessment version history
