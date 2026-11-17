# Design

## Context

See `proposal.md` for the product motivation and `specs/guest-mode/spec.md` for the observable contract.

The current app already uses Supabase Auth sessions, server-side profile resolution, service-role server routes scoped by `profile_id`, private document Storage, and a background worker for document processing. Uploads create database reservations and Storage objects before the worker extracts data. Document deletion is already a durable, lease-aware lifecycle that waits for writers, removes Storage manifests, verifies emptiness, and finalizes database state. The app shell intentionally avoids profile writes on the `/app/*` read path.

The current authentication entry supports Google OAuth and email OTP only. Profile onboarding requires a first name before the consent gate. The current consent API records required terms, privacy, health-data, and AI-processing state. There is no guest classification, anonymous-sign-in configuration, profile-level purge lifecycle, or account-linking flow for a current anonymous session.

## Goals / Non-Goals

**Goals:**

- Add a temporary, server-backed patient account that can use the existing document and health workflows without an email.
- Keep guest data isolated by the existing profile ownership boundary.
- Make loss of an unlinked browser session, 30-day retention, conversion, and deletion observable to the guest.
- Preserve guest data when an email or Google identity is linked to the current session.
- Make explicit deletion and inactivity purge safe with active document writers, Storage objects, derived records, and queued worker jobs.
- Keep clinician-only authorization separate from the fact that Supabase anonymous users have an authenticated session.
- Roll out additively behind a kill switch without changing normal-account behavior.

**Non-Goals:**

- Browser-only document storage or a client-side extraction/AI pipeline. Full guest mode remains server-backed.
- Anonymous access to clinician workspace, patient grants, or clinician recording/transcription features.
- Automatic recovery of an unlinked guest account after browser data is cleared.
- A new general account-deletion system for non-guest users.
- Redesigning the normal Google/email onboarding flow beyond shared conversion and consent primitives.
- Choosing legal policy language without legal/product approval; implementation may not ship with the repository's existing legal placeholders as final guest copy.

## Decisions

### 1. Use Supabase anonymous Auth as the guest identity

The browser client will create an anonymous authenticated session directly, without an OAuth or email redirect. The session uses the existing SSR cookie transport, so current server routes continue to resolve one user/profile per request. The hosted Supabase project must enable anonymous sign-ins before the feature flag is enabled.

Alternatives considered:

- **Local-only guest data:** rejected because the current upload, Storage, worker extraction, biomarker persistence, and report APIs are server-backed.
- **Synthetic guest email/password accounts:** rejected because it creates credentials that cannot be recovered and complicates abuse controls and identity linking.
- **Unauthenticated public mode:** rejected because it would require weakening ownership checks around medical data.

### 2. Add an explicit guest lifecycle to the profile

Add additive profile state sufficient to distinguish an anonymous guest from a converted account and to schedule cleanup: guest classification, last meaningful activity, expiry timestamp, guest-consent version/timestamp, and deletion state as needed by the operation record. The guest marker is cleared only after identity linking is confirmed; it is never inferred solely from a browser flag.

The server identity helper will expose the authenticated profile plus guest classification to protected routes. Read paths must not update activity on every app-shell request. Meaningful guest mutations and a throttled client activity signal update the activity timestamp; the activity update is monotonic and cannot extend a converted or deleting profile.

Alternatives considered:

- **Only inspect the Auth JWT on each route:** insufficient for retention queries, conversion state, and safe server-side cleanup.
- **Only use a local-storage guest flag:** insecure and lost with browser data; it cannot authorize or classify server requests.
- **Write activity from middleware on every request:** rejected because it regresses the app-shell read-only hot path.

### 3. Keep one guest consent UI but preserve the existing audit model

Guest onboarding presents one required consent action with links to Terms and Privacy Policy and explicit language for health-data processing, AI processing, server-side storage, browser-session loss, retention, and conversion. The server records the existing required consent timestamps/fields and a guest-consent version/timestamp so the one UI action remains auditable and future copy changes can force re-consent.

The consent endpoint must reject partial or stale guest consent. A guest cannot reach patient data workflows before the current guest consent is accepted. Optional marketing and analytics choices remain separate and are not implied by guest consent.

Alternatives considered:

- **Treat one checkbox as an unstructured boolean:** rejected because it loses the existing required-consent audit semantics.
- **Reuse the normal four-card UI unchanged:** rejected because the selected guest flow intentionally uses one concise action, while the server still retains the underlying required facts.
- **Skip consent for guests:** rejected because guest uploads contain health data and are processed by AI providers.

### 4. Reuse patient APIs; enforce guest classification at shared authorization boundaries

Guest requests use the same profile-scoped document, biomarker, health-profile, and report APIs as normal patient accounts. No endpoint may accept a client-supplied profile id as authority. Guest-aware checks are added to shared authorization helpers and clinician workspace boundaries so an authenticated anonymous user cannot be treated as a clinician.

Guest resource limits are applied before expensive upload/processing work. Anonymous account creation uses the provider's abuse controls plus application-level throttling; exact thresholds remain configuration, not hard-coded behavior in the contract.

Alternatives considered:

- **A separate guest API surface:** rejected because it would duplicate ownership and processing behavior.
- **Allow all authenticated users into clinician checks:** rejected because anonymous users receive an authenticated role but have no clinician grant.
- **Rely only on UI hiding:** rejected because direct API requests must remain denied.

### 5. Convert by linking the current identity, never by signing into another account

`Save my data` starts from the active anonymous session. Email conversion attaches and verifies an email identity on that user; Google conversion uses identity linking on that user. The conversion transaction clears guest retention state only after the provider confirms the identity and the server verifies that no other account owns it. A conflict leaves both accounts unchanged and keeps the guest session usable.

The UI must not call the normal sign-in OAuth path for conversion, because that path may establish a different user. After successful conversion, the same profile id remains the owner of all existing documents and derived data.

### 6. Implement profile purge as a durable operation

Explicit deletion and TTL cleanup create or reuse one idempotent profile-level deletion operation. The operation freezes new guest writes, marks the profile as deleting, cancels eligible queued work, and coordinates each document through the existing durable document-deletion lifecycle. It then removes non-document profile-owned rows and all known/profile-prefixed Storage objects, verifies that no guest product data remains, deletes the temporary Auth user, and records terminal success without retaining health content.

The operation record must survive the final profile deletion and must contain only operational metadata, safe error codes, timestamps, and a profile identifier/tombstone—not document content, filenames, raw Storage paths, or extracted health data. Retries are lease-based and must never report completion before Storage and database verification succeed.

Alternatives considered:

- **Directly delete the profile row:** rejected because Storage objects, active writers, derived rows, append-only lineage, and worker leases can outlive a cascading database delete.
- **Delete each table from the API route:** rejected because the request timeout and concurrent worker races make completion unverifiable.
- **Delete Auth first:** rejected because it removes the owner needed to authorize and audit cleanup and can strand profile data.

### 7. Use inactivity TTL as a server-side cleanup policy

A scheduled worker selects unconverted guest profiles whose monotonic activity timestamp is at least 30 days old and whose deletion/conversion state is not active. It creates deletion operations and processes them through the same purge path as explicit deletion. Conversion atomically clears guest eligibility so a former guest cannot be selected by a stale cleanup query.

Clearing browser data is not treated as a deletion signal. The UI describes immediate access loss and eventual TTL cleanup instead of promising instant deletion.

### 8. Keep deployment additive and reversible

Deploy the schema, server authorization, conversion, deletion, and worker support before enabling guest entry. Gate the login action and anonymous Auth usage with a feature flag. Rollback disables new guest creation but leaves the cleanup worker and existing guest deletion/conversion paths available; it does not remove guest columns or abort in-flight purges. Enabling the feature requires anonymous Auth configuration, abuse-control configuration, worker readiness, legal copy approval, and evidence for the guest browser flow.

## Risks / Trade-offs

- **[Risk] Anonymous users are authenticated and may pass generic session checks.** -> Centralize guest classification and deny clinician-only/grant paths at the server boundary; add direct API authorization tests.
- **[Risk] Clearing browser data leaves sensitive server data until TTL.** -> State this prominently, offer account conversion and explicit deletion, enforce the 30-day purge, and do not claim browser-only storage.
- **[Risk] Profile purge races with document processing or Storage writes.** -> Freeze guest writes, reuse document tombstones/leases, wait for worker quiescence, verify Storage emptiness, and retry with safe error codes.
- **[Risk] Anonymous sign-in can be abused to consume AI, Storage, or worker capacity.** -> Enable CAPTCHA/Turnstile or equivalent provider protection, rate-limit creation, enforce per-guest quotas, and monitor rejected/expired operations.
- **[Risk] Identity linking can accidentally create duplicate accounts or merge data.** -> Use current-session linking APIs only, preflight conflicts, keep profile ownership unchanged, and test both successful and conflict paths.
- **[Risk] A guest consent checkbox may be legally insufficient in some jurisdictions.** -> Keep the required underlying audit fields, version the guest text, link the policies, block release pending legal approval, and document the approved copy.
- **[Risk] Existing routes may not update guest activity consistently.** -> Define activity sources centrally, add a throttled heartbeat for meaningful app use, and test expiry boundaries with a controlled clock or database fixture.
- **[Risk] A feature-flag rollback could strand sessions.** -> Keep existing anonymous sessions readable and deletable when entry is disabled; show a deterministic signed-out/recovery message rather than silently creating a replacement guest.

## Migration Plan

1. Add additive profile and deletion-operation schema, indexes, constraints, and service-role RPCs. Do not change normal-account rows or delete existing data.
2. Add guest-aware session/profile resolution, onboarding consent persistence, shared authorization guards, and conversion endpoints while guest entry remains disabled.
3. Add worker claim/lease/retry handling for profile-level guest purge and connect it to the existing document deletion lifecycle.
4. Deploy account UI, guest disclosure/copy, explicit deletion, conversion actions, observability, and tests.
5. Enable Supabase anonymous sign-ins and abuse controls in the target environment; verify worker readiness and legal-approved copy.
6. Enable the application guest flag for a controlled cohort, monitor creation, conversion, upload, purge, and error metrics, then expand rollout.
7. If rollback is required, disable new guest entry and retain cleanup/conversion support until all existing guest profiles have converted or expired. Roll back only additive code/config after active deletion operations are terminal.
