## ADDED Requirements

### Requirement: Panel specimen policies are their own approval scope

Candidate-release policy SHALL define a named owner scope for panel specimen policies, separate from the per-measurement score-affecting binding scope. A candidate SHALL NOT be launchable while a reviewed panel policy lacks a hash-bound approval from its named owner. The approval record SHALL enumerate the score-affecting measurement keys the policy can reach, so the signature states what was reviewed rather than only that a review occurred.

#### Scenario: Unapproved panel policy blocks the candidate

- **WHEN** the catalog contains a reviewed panel specimen policy with no hash-bound approval from its named owner
- **THEN** candidate validation fails and the manifest is not launchable

#### Scenario: Approval enumerates the score-affecting reach

- **WHEN** the complete-blood-count policy is approved
- **THEN** the approval record names the score-affecting keys it can reach, including `hemoglobin_whole_blood`, `hematocrit_whole_blood`, `rbc_whole_blood`, `wbc_whole_blood`, `platelets_whole_blood`, `rdw_cv` and `rdw_sd`

#### Scenario: Changing a policy detaches its approval

- **WHEN** a policy's heading forms, specimen or analyte allowlist change
- **THEN** the candidate input hash changes and the existing approval no longer applies

### Requirement: Corpus coverage for the panel path

The candidate corpus SHALL cover the panel path in both directions. It SHALL include a haematology row printed under a matching heading, asserting the specimen is satisfied and the outcome resolves with `specimen_from_reviewed_panel`. It SHALL include a negative row whose analyte is outside the policy allowlist printed under the same heading, asserting the specimen remains missing and the outcome stays `partial`.

#### Scenario: Positive panel row resolves

- **WHEN** the corpus evaluates a haemoglobin row printed under a complete-blood-count heading
- **THEN** the expected classification is `resolved` with the policy evidence code recorded

#### Scenario: Out-of-scope analyte under the same heading stays incomplete

- **WHEN** the corpus evaluates a glucose row printed under a complete-blood-count heading
- **THEN** the expected classification is `partial` with the specimen axis missing
- **AND** no whole-blood glucose definition is selected

#### Scenario: Unrecognized heading stays incomplete

- **WHEN** the corpus evaluates a haematology row printed under a heading no policy declares
- **THEN** the expected classification is `partial`
