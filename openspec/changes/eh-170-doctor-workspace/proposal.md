# Proposal

## Why

EasyHealth already lets a profile owner review a Health Profile, inspect laboratory observations, create a Doctor Visit Brief, and share a scoped report. It does not yet provide a durable clinician workspace where a clinic can manage patient relationships, record consultations, or create reviewed clinical notes.

The product needs a clearly bounded future path for clinician workflows without presenting an unimplemented clinic portal or dictation service as available. This change defines that path and the access boundaries that must exist before clinicians can read patient data.

## What Changes

- Add a separate `For clinicians` product area with `Clinic` and `Dictaphone` navigation entries.
- Define the clinic workspace boundary for clinics, clinicians, patient invitations, patient access grants, scoped patient reads, consultation records, revoke, and audit history.
- Define a clinician read projection that consumes the existing Health Profile, observation, document, Doctor Visit Brief, and report-share contracts without bypassing their provenance or safety rules.
- Define the Dictaphone workflow for recording audio, transcription, structured consultation-note candidates, clinician review, correction, and final persistence.
- Provide honest preview and `Coming soon` states until the corresponding authorization and processing paths are available.
- Keep diagnosis, treatment selection, urgency decisions, and autonomous clinical directives outside the feature boundary.
- Define privacy, retention, deletion, consent, and access-audit requirements for patient data and audio recordings.
- Keep the current patient-owned Health Profile and report-sharing behavior intact.

## Capabilities

### New Capabilities

- `clinic-workspace`: A clinician-facing workspace with clinic membership, patient access grants, scoped patient reads, consultation records, revocation, and audit history.
- `consultation-recording`: A reviewed workflow for audio capture, transcription, structured consultation-note candidates, and clinician-approved persistence.

### Modified Capabilities

None. The current main specs define patient-owned Health Profile and report behavior that this change consumes. They do not currently define clinician identity, clinic membership, patient grants, or consultation recording.

## Impact

- **Target domains:** `auth-shell`, `health-profile`, `documents`, and `reports`.
- **Navigation:** The current flat app navigation needs a clinician group without adding dead links or crowding the mobile bottom navigation.
- **Identity and access:** New clinic, clinician membership, patient grant, scope, revoke, consent, and audit concepts are required. The existing profile-to-auth-user ownership model remains the patient boundary.
- **Health data reads:** Clinician views must reuse profile-scoped observations, Health Profile readiness, reported-result exclusions, source identity, and report scope. A clinician grant must never make unresolved data score-eligible.
- **Consultations:** Consultation records need a durable source relationship, review state, edit history, and safe persistence boundary. Audio storage and retention must be separated from the final structured note.
- **Privacy and operations:** Audio and patient data require explicit retention, deletion, access-event, and incident-response decisions before production use.
- **UI direction:** The supplied clinician screenshots establish a separate navigation concept. The current EasyHealth design system is light and neutral, so the clinician palette and theme relationship must be decided before implementation.
