# Spec Delta

## Purpose

Define a clinician-facing clinic workspace that separates clinic membership from patient ownership and permits only explicit, scoped, auditable access to patient health data.

## ADDED Requirements

### Requirement: Clinician workspace navigation is truthful
The authenticated application SHALL expose a separate clinician area with `Clinic` and `Dictaphone` entries. An entry without an available implementation SHALL be visibly marked `Coming soon` and SHALL NOT present inactive controls as live functionality.

#### Scenario: Future clinician entry is shown honestly
- **WHEN** the clinician workspace entry has no available implementation
- **THEN** the navigation marks it `Coming soon`
- **AND** the destination shows an explanatory preview or a safe unavailable state
- **AND** no form or action claims to create clinic data

### Requirement: Clinic membership is separate from patient ownership
The system SHALL represent a clinic, its clinician memberships, and a patient Profile as separate identities. A clinician SHALL access clinic operations only through an active membership for the selected clinic.

#### Scenario: Active clinician membership is accepted
- **WHEN** an authenticated clinician selects a clinic where the clinician has an active membership
- **THEN** the system permits clinic-scoped operations for that clinic
- **AND** the patient Profile remains owned by its auth user

#### Scenario: Foreign clinic access is denied
- **WHEN** a clinician requests a clinic operation without an active membership
- **THEN** the system denies the operation with a generic authorization result
- **AND** it does not reveal clinic, patient, or membership metadata

### Requirement: Patient access requires an explicit grant
A clinician SHALL NOT read a patient Profile, Health Profile, observation, document, report, or consultation through clinic membership alone. A patient-approved access grant SHALL identify the clinic, the permitted clinician or clinic role, the patient Profile, the allowed resource scope, the issuer, and the grant state.

#### Scenario: Patient approves a scoped grant
- **WHEN** a patient accepts a clinic invitation and approves a declared resource scope
- **THEN** the system creates an active grant bound to that patient, clinic, and scope
- **AND** an authorized clinician can read only the granted resources

#### Scenario: Grant is absent or revoked
- **WHEN** a clinician requests a patient resource without an active matching grant
- **THEN** the system denies the read before returning patient data
- **AND** the previous grant state does not remain usable

### Requirement: Clinician reads reuse patient-owned projections
An authorized clinic read SHALL consume the same Health Profile, observation, document, Doctor Visit Brief, and report-scope contracts used by the patient surface. It SHALL preserve source identity, readiness states, reported-result exclusions, limitations, and medical disclaimers.

#### Scenario: Authorized clinician reads incomplete laboratory evidence
- **WHEN** a granted clinician reads a patient view containing partial, ambiguous, unmapped, or not-score-ready results
- **THEN** the view preserves those safe states and their source or limitation information
- **AND** it does not convert unresolved evidence into a confirmed identity or score

#### Scenario: Clinician scope excludes a document
- **WHEN** an active grant permits Health Profile observations but excludes original documents
- **THEN** the clinician can read the permitted projection
- **AND** the clinician cannot obtain the excluded document or a storage URL

### Requirement: Clinic consultations are patient-scoped records
A consultation record SHALL be associated with exactly one patient Profile, one clinic, and one authoring clinician. It MAY reference permitted reports, observations, documents, or a reviewed consultation note, but it SHALL NOT widen the patient's access grant.

#### Scenario: Consultation is created inside a grant
- **WHEN** an authorized clinician starts a consultation for a granted patient
- **THEN** the record is linked to the selected clinic, patient, and clinician
- **AND** every referenced source is checked against the active patient scope

#### Scenario: Consultation references an unavailable source
- **WHEN** a referenced document or report is archived, revoked, or outside the grant
- **THEN** the consultation read shows an explicit unavailable or limited state
- **AND** it does not substitute an unrelated source or broaden access

### Requirement: Patient access transitions are auditable
The system SHALL record grant creation, approval, scope change, revoke, expiry, and patient-data reads with clinic, patient, actor, resource kind, result, and timestamp metadata. Audit records SHALL omit bearer tokens, PINs, raw audio, raw IP addresses, and full user-agent strings.

#### Scenario: Patient revokes clinic access
- **WHEN** a patient revokes an active clinic grant
- **THEN** the revoke transition is recorded before success is returned
- **AND** subsequent clinician reads fail
- **AND** the audit record contains only approved minimized metadata
