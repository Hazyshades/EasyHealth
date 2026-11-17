# EH-170: Clinician workspace and Dictaphone

**Roadmap status:** In progress — implementation present; production gate closed
**Build / environment:** Local repository; clinician flags disabled by default
**Test run date:** 2026-11-16
**Tester:** Codex implementation session

## What this checklist covers

This checklist covers the grant-scoped Clinic workspace, patient consent, private
Dictaphone recording, transcript review, and retention boundaries. Patient-owned
Health Profile and report behavior must remain unchanged; a clinician must never
receive access merely because a clinic or consultation exists.

## Before you start

- [ ] Use a dedicated synthetic patient account and a separate synthetic clinician account.
- [ ] Use only synthetic or de-identified documents and audio.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.
- [ ] Confirm the test cohort and policy approvals are documented before enabling live Clinic or Dictaphone flags.

## Test data

| ID                     | Test document or setup                                                  | Purpose                                                 |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `EH170-PATIENT-A`      | Synthetic patient profile UUID `00000000-0000-0000-0000-000000170001`   | Patient owner and consent actor                         |
| `EH170-CLINICIAN-A`    | Synthetic clinician profile UUID `00000000-0000-0000-0000-000000170002` | Clinic owner and clinician actor                        |
| `EH170-CLINIC-A`       | Synthetic clinic UUID `00000000-0000-0000-0000-000000170010`            | Named membership and grant boundary                     |
| `EH170-CONSULTATION-A` | Synthetic consultation UUID `00000000-0000-0000-0000-000000170030`      | Consultation and source-reference checks                |
| `EH170-AUDIO-A`        | Short synthetic speech recording with no real patient information       | Consent, upload, retry, and deletion checks             |
| `EH170-DOCUMENT-A`     | Synthetic complete document owned by `EH170-PATIENT-A`                  | Document-scope projection and unavailable-source checks |

## Interface checks

### EH170-UI-01: Disabled clinician preview stays truthful

**Precondition:** `EH170_CLINIC_WORKSPACE_ENABLED=false` and
`EH170_DICTAPHONE_ENABLED=false`.

1. Sign in as a normal patient account.
2. Go to **Clinic**.
3. Confirm the page shows **Coming soon** and no patient, upload, submit, or recording controls.
4. Go to **Dictaphone**.
5. Confirm the page shows **Coming soon** and no patient, upload, submit, or recording controls.

**Expected result:** Both routes are read-only previews. No synthetic counts,
patient records, or fake controls appear.

**Result:** `Pass` — an authenticated synthetic patient account
(`eh170-browser-patient@example.test`) opened both routes at
`http://localhost:3000`; Clinic and Dictaphone rendered the read-only
`Coming soon` previews with no patient records, upload controls, or recording
controls.
**Notes / evidence link:** Browser verification completed against the local
Supabase stack on 2026-11-16; visual captures showed `No clinic connections`
and `No consultation recordings`.

### EH170-UI-02: Create a clinic and invite a named clinician

**Precondition:** Enabled Clinic cohort; synthetic clinician owner is signed in.

1. Go to **Clinic**.
2. Enter a name for `EH170-CLINIC-A` and click **Create clinic**.
3. Select the clinic and enter the UUID for a second synthetic clinician.
4. Click **Invite clinician**.
5. Sign in as the invited synthetic clinician and accept the invitation.

**Expected result:** The owner sees the named membership and its state. The
invited clinician sees only their own invitation and, after acceptance, the
active membership. No unrelated clinic membership appears.

**Result:** `Blocked` — the live Clinic cohort remains disabled by policy; the
database contract now passes locally, but an enabled clinician owner and
invited-clinician account are not configured for this session.
**Notes / evidence link:** `pnpm test:eh170-db` passed all 100 subtests; enabled
cohort browser evidence remains pending.

### EH170-UI-03: Patient approves only requested scopes

**Precondition:** Active synthetic clinician membership; patient and clinician
accounts are separate.

1. As the clinician, invite `EH170-PATIENT-A` with `health_profile` and `consultations` only.
2. As the patient, open **Clinic** and review the pending request.
3. Approve the requested scopes.
4. Confirm the grant displays the selected scopes and expiry.
5. As the clinician, attempt a report or document projection without its scope.

**Expected result:** Health Profile and consultation reads are allowed. Report
and document reads fail closed; no alternate source or signed URL is returned.
The patient can revoke the grant.

**Result:** `Blocked` — the live Clinic cohort remains disabled by policy, so
scope approval and revoke cannot be exercised through product controls.
**Notes / evidence link:** `supabase/tests/eh170_doctor_workspace.sql`;
`pnpm test:eh170-db` passed all 100 subtests.

### EH170-UI-04: Consent gates Dictaphone recording

**Precondition:** Active consultation grant with `consultations` scope; no active
recording consent.

1. As the clinician, choose `EH170-CONSULTATION-A` in **Dictaphone**.
2. Attempt **Start recording**.
3. Confirm the request fails with a consent-required state and no recording upload control succeeds.
4. As the patient, grant recording consent from **Clinic**.
5. As the clinician, start recording, capture only `EH170-AUDIO-A`, and stop/upload.

**Expected result:** No recording session or private object is created before
consent. After consent, the lifecycle shows recording/uploaded/transcribing
states and the storage path is never shown to the user.

**Result:** `Blocked` — the live Dictaphone cohort and approved transcription
provider are not enabled for this session.
**Notes / evidence link:** `supabase/tests/eh170_doctor_workspace.sql`;
`pnpm test:eh170-db` passed all 100 subtests; worker/provider evidence remains
required.

### EH170-UI-05: Review before final note and independent deletion

**Precondition:** A synthetic recording has a transcript draft.

1. Open the recording in **Dictaphone**.
2. Confirm transcript text and note candidate are separate states.
3. Edit the candidate and leave **Mark this revision reviewed** unchecked; save.
4. Confirm the revision is a draft.
5. Mark the corrected candidate reviewed and save a second revision.
6. Delete source audio, then confirm transcript and note state remain visible.
7. Delete the transcript and confirm its text is gone while the note revision remains auditable.

**Expected result:** Review creates an append-only revision. Unsupported
clinical directives are not persisted as directives. Audio, transcript, and
note deletion operate independently.

**Result:** `Blocked` — the live Dictaphone interface and approved provider
remain unavailable; the disabled preview was verified separately in EH170-UI-01.
**Notes / evidence link:** `supabase/tests/eh170_doctor_workspace.sql`;
`pnpm test:eh170-db` passed all 100 subtests.

### EH170-UI-06: Revoke closes every clinician path

**Precondition:** Active grant, consultation, report/document scope, and a
transcription job or note draft owned by `EH170-PATIENT-A`.

1. As the patient, revoke the clinician grant.
2. As the clinician, refresh Clinic and Dictaphone.
3. Attempt consultation read, report projection, document projection, recording audio URL, note save, and transcription retry.
4. Inspect access events for denied/revoked results without content payloads.

**Expected result:** Every path fails closed before returning patient data or
persisting a note. Existing patient-owned data remains intact.

**Result:** `Blocked` — the live enabled cohort remains unavailable, so the
end-to-end revoke sweep cannot be exercised through product controls.
**Notes / evidence link:** Cross-route fixtures and the passing database output
are available; enabled browser evidence remains pending.

## Developer evidence required

- [x] `pnpm test:eh170` — navigation and pure recording/note lifecycle
  checks pass.
- [x] `pnpm typecheck` — application TypeScript checks pass.
- [x] `pnpm typecheck:worker` — worker TypeScript checks pass.
- [x] `pnpm build` — Next.js production build compiled all EH-170 API and app routes; the configured local policy kept live cohort behavior disabled.
- [x] `pnpm test:eh170-db` — local Supabase migration, RLS, RPC privilege,
  `Files=1, Tests=100, Result: PASS`.
  Local setup note: the disposable database had stale local history entries
  `091`–`094` without matching migration files; those entries were repaired as
  reverted locally before applying migrations `095`–`106`. No remote migration
  history was changed.
- [ ] Enabled-cohort browser run — required for Clinic and Dictaphone live
  controls; the disabled preview is covered by EH170-UI-01.
- [ ] Provider adapter smoke — required with an approved transcription provider
  and synthetic audio; do not capture transcript text in logs or audit evidence.
- [ ] Retention worker evidence — required with synthetic expired rows, a valid
  deletion actor UUID, and private storage assertions.

## Out of scope or not manually testable yet

- Production DPA and regional-residency approval are a release prerequisite, not
  a local test claim. Keep the Dictaphone flag disabled until the approval record
  and retention values exist.
- Remote Wiki publication is not part of EH-170 because no Registry or biomarker
  behavior changed.
- Browser live-flow checks require enabled feature flags, synthetic clinician and
  patient setup, and the approved provider; record them as blocked rather than
  passing when those prerequisites are absent. The disabled preview has now been
  verified with a synthetic patient account.
