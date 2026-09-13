## ADDED Requirements

### Requirement: Assessment read projection has one canonical source

The Health Profile assessment read path SHALL project the selected profile payload and profile-wide assessment metadata from the latest persisted assessment version, the assessment recalculation job, and an optional request-time fallback. A usable canonical persisted payload SHALL be preferred over a fallback; a legacy, malformed, or policy-incompatible payload SHALL not be exposed as the current persisted profile.

#### Scenario: Canonical persisted assessment is selected

- **WHEN** the latest assessment version contains the current readiness and reported-results contract
- **AND** the fallback snapshot is absent
- **THEN** the projection returns that persisted profile
- **AND** sets `has_current_version` to `true`
- **AND** sets `fallback` to `false`

#### Scenario: Legacy or malformed assessment uses fallback

- **WHEN** the latest assessment version is missing, legacy, malformed, or stamped with an incompatible freshness-policy version
- **AND** a request-time fallback snapshot is available
- **THEN** the projection returns the fallback profile
- **AND** sets `has_current_version` to `false`
- **AND** sets `fallback` to `true`
- **AND** does not expose the invalid persisted payload as the current profile

### Requirement: Lifecycle state is derived from persisted version and job status

The projection SHALL derive exactly one profile-wide `display_state` from whether a usable canonical persisted version exists and the current assessment job status. It SHALL preserve the existing lifecycle values `current`, `processing`, `outdated`, and `error`.

#### Scenario: Completed persisted assessment is current

- **WHEN** a usable persisted version exists
- **AND** the job status is `succeeded` or the job row is absent
- **THEN** `display_state` is `current`

#### Scenario: Pending persisted assessment is outdated

- **WHEN** a usable persisted version exists
- **AND** the job status is `queued` or `processing`
- **THEN** `display_state` is `outdated`
- **AND** the persisted profile remains selected

#### Scenario: Failed persisted assessment retains the last version

- **WHEN** a usable persisted version exists
- **AND** the job status is `retryable_failed` or `failed`
- **THEN** `display_state` is `error`
- **AND** the persisted profile remains selected
- **AND** the job error metadata remains available to the client

#### Scenario: Initial fallback is processing

- **WHEN** no usable persisted version exists
- **AND** the job status is missing, `queued`, `processing`, or `succeeded`
- **THEN** `display_state` is `processing`
- **AND** any available fallback profile remains selectable for display

#### Scenario: Fallback failure is reported as an assessment error

- **WHEN** no usable persisted version exists
- **AND** the job status is `retryable_failed` or `failed`
- **THEN** `display_state` is `error`
- **AND** the fallback profile, when available, remains factual profile data rather than a health-result error

### Requirement: Assessment metadata remains a derived API read contract

A successful Health Profile response SHALL expose the existing assessment metadata fields, including status, display state, current-version presence, fallback presence, version/hash/timestamp information, freshness policy metadata, attempts, and error fields. Lifecycle metadata SHALL be derived at read time and SHALL NOT be persisted inside immutable assessment payloads.

#### Scenario: Projection preserves assessment metadata sources

- **WHEN** a persisted or fallback profile is projected for an authenticated Health Profile response
- **THEN** version identifiers, input hashes, generated/evaluated timestamps, policy version, attempt counts, and error fields come from their existing version/job/fallback sources
- **AND** no lifecycle field is written to an assessment version or job by the read projection

### Requirement: Lifecycle remains separate from score and freshness evidence

The assessment read projection SHALL not change system score/readiness fields, observation-level freshness, or document-processing state. Presentation consumers SHALL receive the projected profile-wide lifecycle state without using null scores, marker freshness, readiness reasons, or document status to recompute it.

#### Scenario: Lifecycle update does not suppress a persisted score

- **WHEN** a usable persisted profile has a numeric system score
- **AND** its job status is `queued` or `processing`
- **THEN** the response retains the numeric score and marks the profile lifecycle `outdated`
- **AND** per-system readiness and observation-freshness fields remain unchanged

#### Scenario: Observation freshness remains a separate axis

- **WHEN** a system has an `outdated` or `unknown_date` observation-freshness/readiness reason
- **THEN** that reason remains part of the system score/readiness projection
- **AND** it does not change the profile-wide lifecycle state unless the assessment job/version inputs independently require such a state
