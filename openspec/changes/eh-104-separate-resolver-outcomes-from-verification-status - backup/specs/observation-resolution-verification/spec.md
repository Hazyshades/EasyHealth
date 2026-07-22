## ADDED Requirements

### Requirement: Resolver outcome is enumerated independently and includes partial everywhere

The resolver outcome SHALL be one of `resolved`, `ambiguous`, `partial`, `unmapped` in every database contract and API surface. `partial` SHALL be a first-class outcome, not a legacy or optional value.

#### Scenario: Extracted biomarker enforces partial

- **WHEN** a resolver produces a partial outcome for a `document_extracted_biomarkers` row
- **THEN** the row stores `resolver_result = 'partial'` under an explicit check constraint that includes `partial`

#### Scenario: Shadow events enforce partial

- **WHEN** a resolution shadow event records a partial outcome
- **THEN** `measurement_resolution_shadow_events.resolver_result` is constrained to the same four-value set

### Requirement: Verification status is enumerated with an explicit actor

The verification status SHALL be one of `pending`, `auto_verified`, `user_verified`, `manually_corrected`, `rejected`, `NOT NULL DEFAULT 'pending'`. Every non-pending status SHALL record a decision timestamp and an actor type (`system` or `user`), and `auto_verified` SHALL be produced only by an explicit system decision source.

#### Scenario: Auto verification requires a system actor

- **WHEN** a revision is auto-verified
- **THEN** `verification_status = 'auto_verified'`, `verification_actor_type = 'system'`, `verification_actor_id IS NULL`, and `verification_decided_at` is set

#### Scenario: Manual verification requires a user actor

- **WHEN** a revision is user-verified or manually-corrected
- **THEN** `verification_actor_type = 'user'` and `verification_actor_id IS NOT NULL`

#### Scenario: Auto verification API is defined but not wired at runtime in EH-104

- **WHEN** EH-104 ships
- **THEN** `createAutomaticVerification()` exists as an explicit system decision source, but no runtime call site invokes it; production rows may remain `pending` until EH-120 wires activation, and this does not affect scoring eligibility

#### Scenario: Auto verification is never inferred from a null actor

- **WHEN** a promotion runs without an actor id
- **THEN** the system SHALL NOT implicitly mark the revision `auto_verified`; `auto_verified` is set only by the explicit system decision source

### Requirement: Active normalization revision is the source of truth

The active `observation_normalization_revisions` row SHALL be the authoritative source for both resolver outcome and verification status. `document_extracted_biomarkers` SHALL hold only the pre-acceptance review state and SHALL NOT be treated as authoritative after an observation is created.

#### Scenario: Post-acceptance DTO reads the active revision

- **WHEN** an observation DTO is built after acceptance
- **THEN** `resolver_result` and `verification_status` are projected from the active revision, not from `document_extracted_biomarkers`

### Requirement: Verified outcome requires a resolved reviewed definition

A verified revision (`auto_verified`, `user_verified`, `manually_corrected`) SHALL be `resolved` with a non-null `measurement_definition_key` (enforced by a DB CHECK), and the selected definition SHALL have `maturity = 'reviewed'` (enforced as a service guard inside the RPC/service that writes the verified revision, because maturity is owned by the code Registry, not the database).

#### Scenario: DB guard rejects verified without resolved definition

- **WHEN** an attempt is made to set a verified status on a row that is not `resolved` or has a null `measurement_definition_key`
- **THEN** the database rejects the write

#### Scenario: Service guard rejects non-reviewed definition

- **WHEN** a verified revision would reference a `measurement_definition_key` whose maturity is not `reviewed`
- **THEN** the writing RPC/service rejects the write (cannot be a DB CHECK because maturity lives in the Registry)

#### Scenario: Manual selection resolves before verification

- **WHEN** a user selects a reviewed measurement definition for an incomplete row
- **THEN** a resolved revision is created/activated, after which `user_verified`/`manually_corrected` may apply

### Requirement: Rejected revision is terminal

A `rejected` revision SHALL remain `rejected` on its row for audit. Reprocessing SHALL create a new revision rather than mutate the rejected row's status.

#### Scenario: Rejected row cannot change status

- **WHEN** an update targets a `rejected` revision
- **THEN** the database blocks changing `verification_status` away from `rejected`

#### Scenario: Reprocessing inserts a new revision

- **WHEN** a rejected result is reprocessed
- **THEN** a new revision is inserted (default `pending` or re-resolved) and the prior rejected revision is preserved

### Requirement: Observation DTO projects both dimensions from the active revision

Observation DTOs (biomarkers list, health-profile, document detail) SHALL expose `resolver_result` and `verification_status` projected from the active normalization revision, in addition to the `resolution_status` retained on `observations` for scoring.

#### Scenario: Health-profile DTO carries verification

- **WHEN** the health-profile API returns an observation
- **THEN** the payload includes `resolver_result` and `verification_status` from the active revision alongside `resolution_status`

### Requirement: observations.resolution_status is an atomic projection of the active revision

`observations.resolution_status` SHALL mirror the active revision's `resolver_result`, synchronized in the same transaction as promotion/correction, so it is a projection rather than an independent copy.

#### Scenario: Projection equals active revision after promotion

- **WHEN** a revision is promoted or a correction changes the active revision's `resolver_result`
- **THEN** `observations.resolution_status` is updated in the same transaction to equal the active revision's `resolver_result`

#### Scenario: Fixture asserts projection equality

- **WHEN** the promotion fixture runs
- **THEN** it asserts `observations.resolution_status` equals the active revision's `resolver_result`

### Requirement: Scoring eligibility is unchanged

EH-104 SHALL NOT alter scoring eligibility. Score-impacting observations remain selected by `resolution_status = 'resolved'` plus a reviewed assessment binding, as defined by `strict-system-score-readiness-2`.

#### Scenario: Partial/ambiguous excluded by existing rule

- **WHEN** scoring evaluates observations
- **THEN** `partial`/`ambiguous`/`unmapped` rows are excluded by the existing `resolution_status = 'resolved'` condition, with no additional verification gate added by EH-104
