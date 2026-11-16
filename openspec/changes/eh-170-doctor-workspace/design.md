# Design

## Context

The current app is organized around the authenticated user's patient Profile. Health Profile, observations, documents, Doctor Visit Briefs, and report shares already have separate ownership and source-safety boundaries. There is no clinic identity, clinician membership, patient access grant, consultation record, private audio workflow, or clinician-specific navigation group.

See `proposal.md` for motivation. The capability contracts are in `specs/clinic-workspace/spec.md` and `specs/consultation-recording/spec.md`.

## Goals / Non-Goals

**Goals:**

- Add a reusable authorization boundary for clinic-to-patient access.
- Keep patient ownership in the existing Profile model while permitting explicit, revocable clinic grants.
- Project existing patient data into a clinician view without weakening readiness, provenance, report-scope, or incomplete-result rules.
- Model consultation audio, transcript drafts, and reviewed notes as separate lifecycle artifacts.
- Make navigation honest during staged delivery and keep clinician entries out of the crowded mobile bottom navigation unless the mobile experience is designed for them.
- Provide a migration and rollback path that does not alter existing patient data.

**Non-Goals:**

- Replacing the current patient Health Profile or document review surface.
- Making clinic membership an implicit permission to read patients.
- Delivering autonomous diagnosis, treatment planning, triage, or urgency decisions.
- Turning a transcript or generated note candidate into a final medical record without clinician review.
- Adding billing, scheduling, e-prescribing, insurance, or a full electronic medical record.

## Decisions

### 1. Use patient-approved access grants as the authorization primitive

A clinic membership proves that a clinician belongs to a clinic. It does not prove that the clinician may read a particular patient. A separate patient access grant binds the patient Profile, clinic, actor or permitted clinic role, resource scopes, grant state, issuer, timestamps, and optional expiry.

Authorization checks will evaluate, in order:

1. authenticated actor;
2. active clinic membership;
3. active patient grant for the selected clinic and resource scope;
4. resource ownership and current lifecycle state;
5. requested operation, such as read, create consultation, or review note.

The grant is the single cross-domain permission boundary. Direct table reads, storage URLs, report export routes, and AI processing requests must use the same policy decision rather than implementing separate role checks.

**Alternative rejected:** granting access to every patient in a clinic. This is simple to implement but creates excessive disclosure and makes consent and revoke semantics unsafe.

### 2. Keep patient ownership and clinician projection separate

The existing patient-owned Health Profile and observation projections remain the source of truth. The clinician workspace reads a server-side, scope-filtered projection that preserves the existing fields and states, including raw-result limitations, readiness reasons, source identifiers, and report limitations.

The projection will not copy observations into a clinic-owned record merely to make them visible. Consultation records may reference authorized sources, but a reference does not create a second clinical identity or change source eligibility. A revoked or expired grant causes the projection to stop resolving the affected source.

Immutable Doctor Visit Briefs and report-share snapshots remain snapshots. A clinician can consume or create a permitted snapshot only when the current grant includes the required source scope. A snapshot cannot be used to bypass a current revoke.

**Alternative rejected:** duplicating the full patient record per clinic. Duplication would create stale medical data, unclear deletion behavior, and a second provenance system.

### 3. Use additive relational entities with row-level policy enforcement

The first migration should add separate entities for:

- `clinics`;
- `clinic_memberships`;
- `patient_access_grants`;
- `consultations`;
- minimized access and consent events;
- `recording_sessions`;
- transcript drafts;
- consultation-note revisions.

Each patient-linked row carries the patient Profile identity and a clinic identity where applicable. Foreign keys and unique constraints enforce one relationship per declared boundary, while status and timestamps make revoke and expiry explicit. Private audio belongs in a non-public storage bucket and is referenced by an opaque object identifier, not a public URL.

Database policies must deny cross-profile and cross-clinic access by default. Server routes or actions remain responsible for evaluating the complete grant operation, while database policies provide the final containment boundary for direct access and storage operations.

**Alternative rejected:** storing scopes and memberships only in application session claims. Claims become stale after revoke and cannot provide durable audit or database containment.

### 4. Make recording asynchronous and source-preserving

Dictaphone processing is a state machine:

```text
consent-checked -> recording -> uploaded -> transcribing -> transcript-ready
                                      |                    |
                                      +-> failed           +-> note-draft
                                                             |
                                                   clinician-reviewed
```

Cancellation, expiry, deletion, and retry are explicit transitions. A provider adapter isolates transcription infrastructure from the product contract. The adapter returns transcript content plus processing metadata and never writes a final clinical note directly.

The structured-note step consumes only the authorized transcript and produces a draft with field-level source references or unavailable states. The review step creates an append-only revision for the approved note. Raw audio, transcript draft, and reviewed note have independent lifecycle and retention controls.

**Alternative rejected:** one synchronous request from microphone to final note. Long-running uploads, transcription retries, and provider failures would create ambiguous partial writes and make consent or deletion difficult to enforce.

### 5. Keep the clinician navigation additive and honest

The app shell should render a `For clinicians` group containing `Clinic` and `Dictaphone` from explicit navigation metadata rather than extending the existing patient list with unlabeled entries. The desktop group may expose preview routes. The mobile bottom navigation should continue to select only a bounded set of high-frequency patient items until a clinician mobile layout exists.

A preview route is read-only and has no fake submit, upload, or recording action. Once a real route is enabled, the navigation flag, route guard, authorization checks, loading state, and error state ship together.

**Alternative rejected:** adding disabled links with no destination. They are not discoverable enough for product validation and tend to become permanent dead UI.

### 6. Audit access without collecting sensitive payloads

Access events record actor, clinic, patient, resource kind, operation, result, and timestamp. Grant and consent events additionally record the state transition and declared scope. Events do not include access tokens, PINs, audio bytes, transcript text, raw IP addresses, or complete user-agent strings.

The audit stream is append-only from product paths. Administrative retention and redaction policy must be defined before launch. Failed authorization events should be useful for abuse investigation without revealing whether an unknown patient or clinic exists to the requester.

## Risks / Trade-offs

- **[Risk] Revocation races with an in-flight read or transcription job.** -> Check grant state at request start and before persistence, invalidate queued work on revoke, and fail closed when the second check cannot be completed.
- **[Risk] Live projections can expose more than a report snapshot.** -> Enforce explicit resource scopes, default to least privilege, and keep report export/share code on its existing source and snapshot boundaries.
- **[Risk] Audio is more sensitive and operationally expensive than text.** -> Use private storage, short default retention pending policy approval, independent deletion, encrypted transport and storage, and no raw audio in logs.
- **[Risk] Provider output may invent clinical content.** -> Treat transcript and structured output as drafts, require source references, reject unsupported directives, and require clinician approval.
- **[Risk] A new access model can diverge across routes.** -> Centralize the grant decision, require every patient-linked route and storage operation to call it, and add cross-route authorization fixtures before enabling the UI.
- **[Risk] Clinician navigation can crowd the existing mobile shell.** -> Keep future clinician entries out of the mobile bottom navigation until the clinician mobile information architecture is explicit.

## Migration Plan

1. Add the new relational entities, enums, constraints, private storage bucket, and deny-by-default policies. No existing patient rows are rewritten.
2. Add the shared authorization decision and audit event contract with no enabled caller. Verify that existing patient routes retain their current owner-only behavior.
3. Ship read-only preview navigation behind a feature flag. Preview pages must not create grants, consultations, recordings, or notes.
4. Enable clinic membership and patient grant flows for a controlled test cohort. Validate grant acceptance, scope filtering, revoke, expiry, and cross-profile denial.
5. Enable consultation records, then Dictaphone upload and transcription, then reviewed-note persistence as separate rollout gates.
6. Enable report and Health Profile integrations only after the access and source-scope fixtures pass.
7. Roll back by disabling the feature flags and new routes. Preserve audit and patient data; do not silently delete audio or reviewed notes during rollback. A later cleanup migration may remove unused new entities only after an explicit retention decision.

## Implementation Policies

- Version one patient grants target named clinicians. Clinic-wide role grants are outside this change.
- Transcription uses a provider adapter. Provider selection and regional data-processing approval are rollout prerequisites, not a second product contract.
- Raw-audio and transcript retention durations remain policy configuration, and production enablement is blocked until those values and deletion actors are approved.
- The clinician workspace uses the existing light design tokens. The supplied dark screenshots are treated as structural reference only until a separate theme decision is approved.

