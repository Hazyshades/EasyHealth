# Spec Delta

## Purpose

Guest mode lets a person try EasyHealth without providing an email, while preserving the existing document, biomarker, health-profile, and report workflows under a temporary, isolated account with explicit consent, recovery, and deletion rules.

## ADDED Requirements

### Requirement: Guest entry creates a temporary account
The system SHALL provide a `Login as Guest` action that creates a temporary authenticated account without requiring an email address or external identity.

#### Scenario: Guest entry succeeds
- **WHEN** a signed-out visitor selects `Login as Guest`
- **THEN** the system creates a new temporary account, establishes a browser session, and sends the visitor to guest onboarding

#### Scenario: Guest entry fails
- **WHEN** temporary-account creation fails
- **THEN** the visitor remains signed out and sees an actionable error without entering the application

### Requirement: Guest onboarding requires a name
The system SHALL require a non-empty name before a guest can enter the application, and SHALL NOT require an email address for this gate.

#### Scenario: Guest submits a valid name
- **WHEN** a guest enters a non-empty name and submits onboarding
- **THEN** the name is associated with the temporary account and the guest proceeds to consent

#### Scenario: Guest submits an empty name
- **WHEN** a guest submits onboarding without a non-empty name
- **THEN** the system rejects the submission and keeps the guest on the name step

### Requirement: Guest consent is explicit and versioned
The system SHALL require one guest-consent action before health-data or AI-assisted features become available, link to the applicable Terms and Privacy Policy, explain server-side storage and guest-session loss, and record the accepted consent version and timestamp.

#### Scenario: Guest accepts consent
- **WHEN** a guest accepts the complete guest-consent text
- **THEN** the system records the consent audit state and version and allows the guest to continue to the application

#### Scenario: Guest declines or leaves consent incomplete
- **WHEN** a guest does not accept the complete guest-consent text
- **THEN** the system does not grant access to the application data workflows

### Requirement: Guest has isolated access to the patient product
After guest onboarding, the system SHALL allow the guest to use the same patient-facing document upload, document processing, biomarker, health-profile, and report workflows available to a normal account, scoped only to the guest account.

#### Scenario: Guest uses the product
- **WHEN** an onboarded guest uploads a supported document and opens the resulting product views
- **THEN** the document, processing result, biomarkers, health-profile data, and reports are available to that guest under the same ownership rules as a normal account

#### Scenario: Guest attempts to access another account's data
- **WHEN** a guest requests a resource that is not owned by the guest account
- **THEN** the system denies access and does not reveal the resource content or metadata

### Requirement: Guest data is server-backed and its recovery limit is visible
The system SHALL disclose that guest documents, derived health data, and account state are stored on the service, that clearing browser data loses the current session, and that unlinked guest data cannot be recovered through the browser after that loss.

#### Scenario: Guest reviews storage disclosure
- **WHEN** a guest views onboarding or guest account information
- **THEN** the interface explains server-side storage, browser-data loss, the 30-day inactive retention window, and the account-conversion option

#### Scenario: Guest clears browser data
- **WHEN** a guest clears the site's browser data and returns without converting the account
- **THEN** the previous guest session is not restored and the guest is shown the signed-out entry flow

### Requirement: Guest can preserve data by converting the account
The system SHALL let a guest link an email identity or Google identity to the current temporary account without creating a second account or moving data through an unscoped export.

#### Scenario: Guest links an email identity
- **WHEN** a guest completes the email-link flow from the current session
- **THEN** the same account becomes recoverable with that identity and all existing guest data remains attached

#### Scenario: Guest links a Google identity
- **WHEN** a guest completes Google identity linking from the current session
- **THEN** the same account becomes recoverable with Google and all existing guest data remains attached

#### Scenario: Identity linking conflicts
- **WHEN** the requested email or Google identity already belongs to another account
- **THEN** linking fails with a clear recovery instruction and neither account's data is merged or changed

### Requirement: Guest can explicitly delete all guest data
The system SHALL provide an explicit guest deletion action that is idempotent, prevents new guest writes after acceptance, removes guest-owned database and Storage data through the safe deletion lifecycle, and signs the browser session out after the deletion request is accepted.

#### Scenario: Guest requests deletion
- **WHEN** an onboarded guest confirms `Delete guest data`
- **THEN** the system accepts one deletion request, stops or cancels eligible guest processing, removes guest-owned data and Storage objects through the deletion lifecycle, and signs the guest out

#### Scenario: Guest repeats deletion
- **WHEN** a guest repeats the deletion request for the same guest account
- **THEN** the system returns the existing deletion outcome without duplicating work or reviving data

### Requirement: Inactive guest data expires after 30 days
The system SHALL mark unconverted guest accounts for purge after 30 days without activity and SHALL exclude accounts that have been converted to a permanent identity.

#### Scenario: Guest becomes inactive
- **WHEN** an unconverted guest account has no activity for 30 consecutive days
- **THEN** the system starts the guest purge lifecycle and prevents the expired guest session from accessing product data

#### Scenario: Guest returns before expiry
- **WHEN** an unconverted guest uses the product before the 30-day inactivity window ends
- **THEN** the system records activity and does not purge the guest account for that activity window

#### Scenario: Converted account reaches the former expiry date
- **WHEN** a guest account has been converted and the former guest expiry date is reached
- **THEN** the system does not purge the converted account or its data as guest data

### Requirement: Guest purge covers derived and stored data
The system SHALL remove guest-owned source documents, Storage objects, extraction artifacts, biomarkers, reports, health-profile projections, queued processing state, and the temporary Auth account, while retaining only records explicitly required for security, legal, or operational audit.

#### Scenario: Guest purge completes
- **WHEN** the safe guest purge lifecycle reports completion
- **THEN** no guest-owned product data or recoverable temporary Auth account remains accessible

#### Scenario: Guest purge encounters a transient failure
- **WHEN** a worker or Storage operation fails during guest purge
- **THEN** the system retains a retryable deletion state, records a safe error code, and does not report deletion as complete

### Requirement: Guest access excludes clinician-only capabilities
The system SHALL prevent anonymous guest accounts from acting as clinicians, accessing clinician workspace data, or receiving clinician grants solely because they possess an authenticated session.

#### Scenario: Guest opens clinician workspace
- **WHEN** a guest requests a clinician-only route or action
- **THEN** the system denies the request without exposing clinician or patient workspace data

### Requirement: Anonymous guest creation is abuse-controlled
The system SHALL apply rate limits and an abuse-control challenge or equivalent protection to anonymous account creation and SHALL enforce guest resource limits independently of normal-account limits. Public deployments MUST configure a provider challenge or equivalent provider control.

#### Scenario: Private beta uses the approved throttle equivalent
- **WHEN** a visitor selects the EasyHealth guest entry in an access-limited deployment while the provider challenge is unavailable
- **THEN** the system MUST reserve a peppered pre-auth creation ticket and consume it once before creating the guest profile; direct provider-level anonymous sign-ups remain subject to hosted Auth limits and do not grant an EasyHealth profile.

#### Scenario: Guest creation limit is exceeded
- **WHEN** a visitor exceeds the configured anonymous-session creation limit
- **THEN** the system refuses additional guest creation temporarily and explains when or how the visitor can retry

#### Scenario: Guest exceeds a resource limit
- **WHEN** a guest exceeds a configured upload, processing, or usage limit
- **THEN** the system blocks the limited action without exposing another user's data or bypassing ownership checks
