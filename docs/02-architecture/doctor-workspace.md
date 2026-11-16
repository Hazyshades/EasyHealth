# EH-170 clinician workspace

## Boundary

The clinician workspace is a separate, server-authorized surface over patient-owned
records. A Supabase Auth user maps to one `public.profiles.id`. A clinic has named
clinician memberships; a patient grants a clinician access to explicit scopes:

- `health_profile`
- `observations`
- `reports`
- `documents`
- `consultations`

The database function `public.eh170_authorize_patient_access` is the shared grant
decision. API routes, consultation/recording RPCs, report projection, document
projection, and note persistence use that decision before reading or writing
patient-linked data. Direct table privileges and direct storage access remain
denied; service-role RPC grants are the only application boundary for the new
entities.

`clinical_access_events` records resource, operation, scope, grant, actor, and
result. It does not record audio, transcript text, note content, provider errors,
or storage URLs.

## Data and transition model

Migrations `101_eh170_doctor_workspace_foundation.sql` through
`106_eh170_membership_listing.sql` define:

- `clinics` and `clinic_memberships` with named invitation, acceptance, and
  revoke transitions;
- `patient_access_grants` with requested scopes, approved scopes, expiry, and
  revoke/expire transitions;
- `consultations` and availability-marked source references;
- `consultation_recording_consents`, `recording_sessions`, `transcript_drafts`,
  and append-only `consultation_note_revisions`;
- private `doctor-recordings` storage with an application-generated path.

Recording states are explicit: consent checked, recording, uploading, uploaded,
transcribing, transcript ready, note draft, clinician reviewed, completed,
failed, cancelled, and deleted. Consent is checked when a session starts, before
an upload is finalized, when a worker claims a recording, and before a worker
persists a transcript. Audio deletion, transcript deletion, and note deletion
are independent operations.

A transcript is a draft source, not a final note. Candidate note content is
sanitized before persistence: diagnosis, treatment, urgency, and medication
directives are removed and retained as a limitation. Review creates a new note
revision with reviewer identity and timestamp; prior revisions are superseded,
not overwritten.

## Projection boundaries

- Health Profile projection calls `buildHealthProfileSnapshot` for the patient
  after a `health_profile` grant decision. It keeps the existing Registry-v2
  readiness, source identity, reported-result, and incomplete-outcome behavior.
- Report projection calls `resolveReportRead` for the patient, then disables
  clinician sharing/export capabilities. Invalidated, legacy, unavailable, or
  incomplete-source reports remain unavailable or limited.
- Document projection requires the `documents` scope and an active, complete,
  non-archived patient document. A signed URL is created only after the grant
  decision; excluded documents have no fallback URL.
- Consultation source summaries expose `available` or `unavailable`; missing
  sources never widen the projection.

The projection endpoint is `GET /api/doctor-workspace/projection` with
`kind=health_profile|report|document`, `clinicId`, `patientProfileId`, and the
resource-specific ID. It is not a replacement for patient-owned report or
Health Profile routes.

## API and UI surfaces

With the rollout gate enabled:

- `GET/POST /api/doctor-workspace` lists clinics, memberships, grants, and
  consultations and performs named transition actions;
- `GET/POST /api/doctor-workspace/recordings` lists recordings and performs
  start, cancel, retry, and deletion actions;
- `POST /api/doctor-workspace/recordings/upload` accepts a bounded audio upload;
- `GET /api/doctor-workspace/recordings/:id` returns transcript/note state;
- `GET /api/doctor-workspace/recordings/:id/audio` returns a short-lived signed
  URL only for an authorized, non-deleted source;
- `POST /api/doctor-workspace/notes` creates drafts, appends revisions, and
  performs note deletion.

`/app/clinic` and `/app/dictaphone` render factual loading, empty, unavailable,
and enabled states. When disabled, they render the read-only `Coming soon`
preview and do not expose patient data or recording controls.

## Dictaphone worker

The Dictaphone worker calls `eh170_claim_recording_transcription`, downloads from
the private bucket, and sends the audio through the configured provider adapter.
The current adapter is OpenAI's transcription endpoint. Provider failures are
reduced to stable codes (`provider_unavailable`, `provider_timeout`,
`provider_rejected`, `audio_unavailable`, or `access_revoked`). The worker never
logs source audio or transcript text. Lease tokens make completion and failure
updates idempotent; a revoked grant or consent cannot produce a ready transcript.

Retention is a separate worker pass. It removes expired audio objects first,
then records audited audio retirement, transcript deletion, and note revision
deletion through service-role-only RPCs. The configured deletion actor must be a
profile UUID.

## Release gate and rollback

The production gate is closed unless all of these are true:

- `EH170_CLINIC_WORKSPACE_ENABLED=true`;
- `EH170_DICTAPHONE_ENABLED=true` for Dictaphone;
- `EH170_ROLLOUT_PROFILE_IDS` contains the controlled cohort in production;
- DPA and region approval flags are true;
- recording, transcript, and note retention days are positive;
- `EH170_RETENTION_DELETE_ACTOR` is a valid profile UUID.

Enable in order: migrations and RPC privileges, clinic cohort, approved patient
grants, Dictaphone only after the processing policy gate, then the worker. To
roll back, set the relevant feature flag to `false` or remove the profile from
the cohort. Existing patient data and retained artifacts are not deleted; new
clinician API reads fail closed and recording/transcription work stops. Re-enable
only after the policy and access evidence is restored.

## Verification commands

```text
pnpm test:eh170
pnpm typecheck
pnpm typecheck:worker
pnpm test:eh170-db
```

`pnpm test:eh170-db` requires the repository's local Supabase/Docker runtime.
The database test covers RLS, function privileges, grant/membership transitions,
consent checks, note sanitization/review, revoke denial, and transactional
rollback. Browser verification must use synthetic profiles and the enabled
cohort; a disabled environment should verify the truthful preview instead.
