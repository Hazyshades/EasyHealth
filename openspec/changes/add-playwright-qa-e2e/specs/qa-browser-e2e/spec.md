## ADDED Requirements

### Requirement: Playwright targets an externally running EasyHealth server
The E2E suite SHALL require an explicit `E2E_BASE_URL` and SHALL use that origin for browser navigation. It SHALL NOT start, stop, restart, or otherwise manage a Next.js server. Before tests create remote state, the suite SHALL fail with a clear diagnostic when the supplied origin is unreachable or does not identify itself as EasyHealth.

#### Scenario: Running server is accepted
- **WHEN** `E2E_BASE_URL` points to a reachable current EasyHealth server
- **THEN** Playwright runs against that server without configuring a `webServer` process

#### Scenario: Server preflight fails safely
- **WHEN** `E2E_BASE_URL` is absent, unreachable, or serves a different application
- **THEN** the suite stops before creating a remote E2E user, document, or storage object and reports the invalid target

### Requirement: Remote Supabase E2E state is isolated and non-destructive
The E2E harness SHALL use a unique run ID to namespace its synthetic Auth user, profile, documents, and Storage paths in the shared remote Supabase environment. It SHALL run serially by default and SHALL clean up only IDs and object paths recorded as created by that run. It MUST NOT reset the database, truncate a table, delete an unowned profile, or perform an unscoped Storage deletion.

#### Scenario: A normal run cleans up owned data
- **WHEN** a run completes after creating its synthetic fixture state
- **THEN** teardown removes only the run's recorded Auth/profile/document/Storage resources and leaves unrelated shared data intact

#### Scenario: A failed run leaves recoverable owned data only
- **WHEN** a test fails or the runner exits before ordinary teardown completes
- **THEN** any retained data remains identifiable by the E2E run namespace and an explicit guarded cleanup operation can target only that namespace

#### Scenario: Cleanup guard rejects a broad operation
- **WHEN** cleanup is invoked without an owned run ID or attempts to use a broad reset, truncate, or unscoped delete
- **THEN** the harness rejects the operation before it sends a destructive request to Supabase

### Requirement: Browser authentication uses the supported Supabase callback flow
The application callback SHALL create a cookie-backed session from either a PKCE code or a valid one-time Supabase magic-link token hash. Node-side test setup SHALL create a synthetic authenticated principal and obtain a session through the application's `/auth/callback` using the token hash from an admin-generated magic link. The selected origin MUST be an allowed redirect URL in remote Supabase Auth. Service-role credentials and magic-link values MUST remain outside browser code and test artifacts.

#### Scenario: Authenticated test session reaches the app shell
- **WHEN** the configured redirect origin is allowed and setup follows the generated magic link
- **THEN** the browser receives a session through the application's callback route and can access the authenticated app shell without an external email inbox or OAuth provider

#### Scenario: Server-side magic-link verification reaches the app shell
- **WHEN** `/auth/callback` receives a valid `token_hash` and email verification type
- **THEN** it verifies the one-time token server-side, creates the normal cookie-backed session, and redirects without retaining the token hash in the destination URL

#### Scenario: Disallowed redirect origin is diagnosed before coverage runs
- **WHEN** remote Supabase Auth rejects the configured local callback origin
- **THEN** setup fails with an actionable redirect-allow-list diagnostic and does not run checklist assertions

### Requirement: E2E fixtures are deterministic and synthetic
The harness SHALL create minimal schema-valid synthetic fixture states for the named QA cases, including source documents, previews, extracted evidence, laboratory observations, instrumental findings, and Health Profile inputs. Browser checks SHALL use those states rather than wait for a remote worker, OCR process, or LLM response. A browser-triggered upload or reprocess check MAY mock only the asynchronous client response needed to exercise the UI; it SHALL NOT claim to verify worker persistence or job execution.

#### Scenario: Browser coverage does not depend on external AI processing
- **WHEN** the E2E suite runs with the remote worker unavailable or an AI provider unreachable
- **THEN** its seeded document-viewer, Biomarkers, Health Profile, and controlled-failure checks remain deterministic

#### Scenario: Fixture data is visibly synthetic
- **WHEN** a test creates a document or profile fixture
- **THEN** its name, email, source text, and Storage path identify it as an E2E synthetic resource and contain no real patient data

### Requirement: EH-101 interface checks are covered
The suite SHALL include browser tests titled with `EH101-UI-01` through `EH101-UI-03` and assert only the observable outcomes defined by the EH-101 Interface checks.

#### Scenario: EH101-UI-01 preserves readable baseline values
- **WHEN** the browser opens seeded `LAB-BASELINE` in Documents
- **THEN** the visible values, units, reference ranges, and dates match the synthetic baseline without exposing registry or migration internals

#### Scenario: EH101-UI-02 navigates to a biomarker source
- **WHEN** the browser selects a baseline biomarker result with source data
- **THEN** the viewer opens or selects the corresponding source page or source text

#### Scenario: EH101-UI-03 keeps history stable after refresh
- **WHEN** the browser opens the seeded biomarker history and refreshes once
- **THEN** the expected point appears once with its value, unit, date, and status unchanged

### Requirement: EH-102 interface checks are covered
The suite SHALL include browser tests titled with `EH102-UI-01` through `EH102-UI-05` and SHALL distinguish resolved laboratory evidence from partial or ambiguous evidence in the visible application surfaces.

#### Scenario: EH102-UI-01 shows resolved source evidence
- **WHEN** the browser performs the upload UI flow for `LAB-RESOLVED` and opens its seeded processed document
- **THEN** the visible value, unit, and source area match the synthetic document evidence

#### Scenario: EH102-UI-02 shows reviewed resolved data in Biomarkers
- **WHEN** the browser completes the available review action for `LAB-RESOLVED`
- **THEN** the resolved measurement appears once in Biomarkers with its expected value, unit, reference information, and date

#### Scenario: EH102-UI-03 keeps partial evidence out of trusted outputs
- **WHEN** the browser opens `LAB-PARTIAL` and then visits Biomarkers and Health Profile
- **THEN** raw source evidence remains reviewable without creating a confident measurement, fabricated trend, or assessment input

#### Scenario: EH102-UI-04 keeps ambiguous evidence out of trusted outputs
- **WHEN** the browser opens `LAB-AMBIGUOUS` and then visits Biomarkers and Health Profile
- **THEN** the source label/value remains available without silently appearing as one trusted resolved measurement

#### Scenario: EH102-UI-05 explains empty resolved trends safely
- **WHEN** the browser uses a fixture account containing incomplete or ambiguous evidence only
- **THEN** Biomarkers explains the absence of a resolved trend instead of rendering guessed chart data

### Requirement: EH-103 interface checks are covered
The suite SHALL include browser tests titled with `EH103-UI-01` through `EH103-UI-04` and SHALL assert the visible raw-evidence and source-attribution boundary.

#### Scenario: EH103-UI-01 traces a result to its document
- **WHEN** the browser opens seeded `LAB-PROVENANCE` and selects its distinctive result
- **THEN** the displayed raw label, value, unit, reference text, source excerpt, and page match the synthetic source document

#### Scenario: EH103-UI-02 preserves evidence after refresh
- **WHEN** the browser completes the available acceptance action for `LAB-PROVENANCE`, refreshes, and reopens the result
- **THEN** the same raw source evidence and location remain visible

#### Scenario: EH103-UI-03 keeps the visible source coherent after reprocess UI
- **WHEN** the browser triggers the reprocess UI for the seeded provenance fixture and receives its deterministic result state
- **THEN** the reopened document displays evidence attributable to the original synthetic source rather than an unrelated value

#### Scenario: EH103-UI-04 retains unresolved raw evidence safely
- **WHEN** the browser opens `LAB-PROVENANCE-PARTIAL` and visits Biomarkers and Health Profile
- **THEN** raw evidence remains visible in the document but is not presented as a confident biomarker or assessment input

### Requirement: EH-104 interface checks are covered
The suite SHALL include browser tests titled with `EH104-UI-01` through `EH104-UI-03` and SHALL assert only the current visible resolver/verification safety boundary.

#### Scenario: EH104-UI-01 keeps a reviewed resolved result consistent
- **WHEN** the browser reviews seeded `LAB-RESOLVED`, refreshes the document, and opens Biomarkers
- **THEN** visible source evidence, document result, and biomarker row do not contradict one another or duplicate the measurement

#### Scenario: EH104-UI-02 blocks a non-resolved trusted trend
- **WHEN** the browser opens seeded `LAB-NOT-RESOLVED` and visits Biomarkers and Health Profile
- **THEN** its raw source does not create a trusted biomarker trend or assessment input

#### Scenario: EH104-UI-03 presents a coherent reprocess result
- **WHEN** the browser triggers reprocess UI for an EH-104 fixture and receives its deterministic ready or needs-review state
- **THEN** the document remains usable and the visible source/result state remains internally consistent

### Requirement: EH-105 interface checks are covered
The suite SHALL include browser tests titled with `EH105-UI-01` through `EH105-UI-05` and SHALL assert the visible instrumental-document and laboratory-assessment boundary.

#### Scenario: EH105-UI-01 displays instrumental source findings
- **WHEN** the browser completes the upload UI flow for seeded `INST-NORMAL` and opens its document
- **THEN** Study findings show the fixture's source findings and navigate to their matching source text or page without showing a laboratory review panel

#### Scenario: EH105-UI-02 preserves normal findings through reprocess UI
- **WHEN** the browser triggers reprocess UI for `INST-NORMAL`, refreshes, and reopens the seeded resulting document
- **THEN** each expected finding remains visible once and the document is not presented as completed with all findings missing

#### Scenario: EH105-UI-03 distinguishes repeated-looking findings
- **WHEN** the browser opens `INST-REPEAT` before and after its deterministic reprocess UI state
- **THEN** both distinct source findings remain separately visible and are neither collapsed nor duplicated

#### Scenario: EH105-UI-04 excludes instrumental-only data from laboratory assessment
- **WHEN** the browser compares the seeded laboratory baseline before and after `INST-NORMAL`
- **THEN** Biomarkers and Health Profile contain no laboratory trend point or laboratory-derived score introduced solely by the instrumental fixture

#### Scenario: EH105-UI-05 presents failed processing recovery
- **WHEN** the browser opens the controlled `INST-FAILURE` state, refreshes, and triggers the available retry or reprocess UI after the simulated fault is cleared
- **THEN** the interface does not present an unsuccessful write as completed, exposes a recoverable state, and returns to a consistent visible document state after the deterministic retry result

### Requirement: E2E diagnostics preserve useful evidence without secrets
The suite SHALL retain Playwright traces, screenshots, and failure diagnostics for failed browser checks using synthetic data. It MUST NOT include service-role credentials, anon-key values, authorization headers, Supabase passwords, or magic-link URLs in test output, attachments, or committed files.

#### Scenario: A browser assertion fails
- **WHEN** a checklist-mapped browser assertion fails
- **THEN** Playwright retains navigational evidence and the failing checklist ID while redacting configured credentials and authentication links
