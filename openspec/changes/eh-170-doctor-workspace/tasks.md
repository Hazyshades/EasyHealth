# Tasks

## 1. Identity, access, and data foundations

- [ ] 1.1 Freeze the clinic, clinician membership, patient Profile, consultation, grant, consent, and scope vocabulary in the domain documentation; verify the terms match `CONTEXT.md` and the two EH-170 capability specs.
- [ ] 1.2 Add additive migrations for clinics, named-clinician memberships, patient access grants, consultations, minimized access events, recording sessions, transcript drafts, and note revisions; verify foreign keys, unique boundaries, expiry fields, and rollback behavior with migration checks.
- [ ] 1.3 Add deny-by-default row and private-storage policies for every new patient-linked entity; verify cross-profile, cross-clinic, inactive-membership, expired-grant, and revoked-grant access is rejected.
- [ ] 1.4 Implement one shared grant decision for authenticated routes, storage operations, report reads, and background persistence; verify an authorization matrix covers read, create, update, review, export, and revoke operations.
- [ ] 1.5 Implement named-clinician invitation, patient approval, scope selection, expiry, and revoke transitions; verify revoke invalidates subsequent reads and writes before a success response and emits minimized audit events.

## 2. Auth shell and clinician navigation

- [ ] 2.1 Add explicit `For clinicians` navigation metadata for `Clinic` and `Dictaphone`; verify desktop grouping, route titles, active states, and exclusion from the existing mobile bottom-navigation selection.
- [ ] 2.2 Add read-only preview routes with `Coming soon` states until their backend contracts are enabled; verify no preview route exposes fake submit, upload, recording, or patient-data controls.
- [ ] 2.3 Add loading, unavailable, unauthorized, and empty states for the clinician area using the existing light design tokens; verify the states are factual, keyboard-accessible, and do not imply live functionality.

## 3. Clinic workspace and patient projections

- [ ] 3.1 Build the clinic membership and patient-grant management surfaces; verify a clinician sees only active memberships and named grants, while a patient can review scope, expiry, and revoke access.
- [ ] 3.2 Build the policy-aware clinician patient projection from the existing Health Profile and observation contracts; verify source identity, readiness reasons, reported-result exclusions, and incomplete outcomes remain unchanged.
- [ ] 3.3 Enforce resource scopes for Health Profile, observations, reports, documents, and consultations; verify excluded documents have no retrievable storage URL and no fallback source is substituted.
- [ ] 3.4 Build patient-scoped consultation records with clinic and clinician ownership, authorized source references, review status, and revision history; verify a revoked or unavailable source renders as limited rather than widening access.
- [ ] 3.5 Integrate Doctor Visit Brief and report snapshots without bypassing current share, export, citation, limitation, or revoke boundaries; verify a clinician grant cannot make a revoked snapshot or excluded source available.
- [ ] 3.6 Add clinic workspace unit and integration tests for membership, grant, projection, consultation, and report-scope behavior; verify fixtures use synthetic profiles and cover both allow and deny paths.

## 4. Documents and Dictaphone processing

- [ ] 4.1 Implement consent-checked recording sessions and private audio storage with explicit recording, upload, cancellation, failure, and deletion transitions; verify no audio is stored when consent is absent or revoked.
- [ ] 4.2 Implement the asynchronous transcription worker behind a provider adapter; verify accepted, processing, retryable failure, permanent failure, and transcript-ready states are idempotent and do not publish a final note.
- [ ] 4.3 Implement source-preserving transcript drafts and structured consultation-note candidates with field-level source references or unavailable states; verify unsupported diagnosis, treatment, or urgency directives are rejected or retained only as safe limitations.
- [ ] 4.4 Implement clinician review, correction, explicit save, append-only note revisions, and independent audio/transcript/note retention actions; verify an unreviewed candidate cannot appear as a final medical record.
- [ ] 4.5 Complete the approved transcription data-processing and regional-residency review and configure retention values and deletion actors before production enablement; verify the release gate blocks launch when either policy is missing.
- [ ] 4.6 Add deterministic Dictaphone lifecycle and privacy tests for consent, revoke races, retries, source references, deletion, and provider-error sanitization; verify raw audio and transcript text never appear in audit or error payloads.

## 5. Release evidence and rollout

- [ ] 5.1 Add cross-route authorization fixtures covering patient-owned routes, clinician routes, report exports, storage access, and background note persistence; verify every path uses the shared grant decision and fails closed on uncertainty.
- [ ] 5.2 Create `QA/eh-170/checklist.md` with product-interface preconditions, safe synthetic data, numbered Clinic and Dictaphone actions, expected results, and a separate developer-evidence section; verify unavailable interfaces are recorded as blocked rather than passed.
- [ ] 5.3 Update the affected canonical architecture and product documentation with the final access, retention, consent, and rollout behavior; verify every documented command and route matches the shipped implementation.
- [ ] 5.4 Run the focused unit, integration, migration, and security checks, then exercise the enabled clinician flows in the browser; verify no existing patient-owned Health Profile or report behavior regresses.
- [ ] 5.5 Enable the feature flags in dependency order for a controlled cohort and record rollback evidence; verify disabling the flags leaves existing patient data intact and removes clinician access without deleting retained records.

## Workflow follow-up

- Archive the change after implementation, review, and the EH-170 QA checklist are complete.
- Re-run OpenSpec validation after archiving and confirm the archived capability specs are present in the main spec store.
