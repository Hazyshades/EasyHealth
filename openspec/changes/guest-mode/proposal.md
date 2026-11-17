# Proposal

## Why

EasyHealth currently requires Google or email authentication before a person can try the document, biomarker, and report workflows. This creates an avoidable entry barrier for people who want to evaluate the platform first, while the existing server-backed pipeline already provides the isolation needed for a temporary profile. A guest mode should provide immediate access without requiring an email, while making the temporary nature and recovery limits explicit.

## What Changes

- Add `Login as Guest` to the authentication entry surface.
- Create an anonymous Supabase Auth session and an EasyHealth guest profile without requiring an email address.
- Reuse the existing profile-name gate, but present it as the only identity field required for guest registration.
- Replace the four-checkbox onboarding presentation for guests with one versioned guest-consent action that covers Terms of Service, Privacy Policy, health-data processing, and AI-assisted processing; persist the underlying required consent audit fields on the profile.
- Allow guests to use the existing server-backed document upload, storage, worker extraction, biomarker, health-profile, and report flows under their isolated `profile_id`.
- Mark guest profiles explicitly and prevent guest identities from using clinician-only capabilities or other account-only paths.
- Add a guest data lifecycle: update guest activity, retain inactive guest data for 30 days, and purge the guest profile, database records, derived data, and Storage objects through the durable deletion path.
- Add an explicit `Delete guest data` action that starts the same safe purge and signs the browser session out.
- Add `Save my data` account conversion. Email linking and Google identity linking must attach to the current anonymous user rather than create a second account.
- Explain in the guest UI that clearing browser data immediately loses the anonymous session and that unlinked guest data is recoverable only while the server-side retention window remains active.
- Enable anonymous sign-ins in the deployed Supabase Auth configuration and add abuse controls for anonymous session creation and guest resource usage.
- Add automated coverage, manual QA evidence, and operational documentation for guest onboarding, conversion, deletion, TTL cleanup, and failure recovery.

## Capabilities

### New Capabilities

- `guest-mode`: Temporary anonymous access to the EasyHealth product, including guest onboarding, consent, server-backed data isolation, account conversion, explicit deletion, and inactive-data retention.

### Modified Capabilities

- None. The repository has no existing durable auth-shell capability spec covering these requirements; the new capability owns the guest-mode contract.

## Impact

- **Target domains:** `auth-shell`, `documents`, `health-profile`, and `reports`.
- **Auth UI and state:** `src/components/auth-entry-page.tsx`, `src/components/auth-provider.tsx`, and Supabase browser auth configuration.
- **Onboarding/profile APIs:** `src/app/onboarding/*`, `src/app/api/profile/route.ts`, `src/lib/auth/profile.ts`, `src/lib/auth/session.ts`, and onboarding state resolution.
- **Authorization:** guest classification must flow through protected server routes without weakening ownership checks or clinician-only boundaries.
- **Persistence:** a migration will add guest classification, activity/retention metadata, and versioned guest-consent state as needed; all guest-owned rows remain scoped to the existing profile relationship.
- **Deletion:** a profile-level purge must coordinate queued/active document writers, derived database rows, document Storage manifests, and Auth-user removal. It must not bypass the durable document deletion safeguards.
- **Worker and operations:** the worker needs a scheduled guest-retention cleanup path, retry/observability evidence, and safeguards against deleting converted accounts.
- **Legal/product copy:** guest consent text must describe server-side storage, anonymous-session loss after browser-data clearing, retention, AI processing, and the account-conversion path. Existing legal documents contain placeholders and require review before production release.
