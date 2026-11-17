# Tasks

## 1. Auth-shell identity and persistence

- [x] 1.1 Add additive profile fields for guest classification, conversion state, monotonic activity/expiry timestamps, and versioned guest consent; verify the migration applies cleanly and leaves existing normal profiles unchanged.
- [x] 1.2 Add an idempotent guest profile initialization path that associates the temporary Auth user with one EasyHealth profile and preserves the existing profile-name gate; verify repeated initialization returns the same profile id.
- [x] 1.3 Add typed server-side session identity resolution exposing profile ownership and guest classification without writing on the `/app/*` read path; verify existing authenticated app-navigation hot-path checks still pass.
- [x] 1.4 Add a kill switch and environment/configuration contract for guest entry, anonymous Auth, quotas, and retention; verify the disabled state exposes no guest entry and does not change normal sign-in behavior.
- [ ] 1.5 Enable anonymous sign-ins and the required abuse-control settings in the target Supabase environment; verify deployment evidence shows the setting enabled before the application flag is turned on.

## 2. Auth-shell guest onboarding and consent

- [ ] 2.1 Add `Login as Guest` to the auth entry page with loading, failure, and retry states; verify a browser smoke flow creates one temporary session and routes to guest onboarding.
- [ ] 2.2 Adapt profile onboarding for guest sessions so a non-empty name is required while email remains optional/unavailable; verify blank-name submissions are rejected and a valid name persists to the guest profile.
- [ ] 2.3 Add the one-checkbox guest-consent flow with Terms/Privacy links, server-storage disclosure, browser-session loss warning, 30-day retention, and conversion instructions; verify the UI does not enter `/app` before acceptance.
- [ ] 2.4 Extend consent validation and persistence with the guest-consent version/timestamp while retaining the existing required audit fields; verify partial, stale, and replayed consent requests produce the specified outcomes.
- [ ] 2.5 Add guest identity state to the client account shell and show the guest recovery/deletion information without exposing an email placeholder; verify normal accounts retain their current account presentation.

## 3. Shared authorization, activity, and abuse controls

- [ ] 3.1 Apply the guest-aware ownership guard to patient-facing document, biomarker, health-profile, report, assistant, and share-management paths; verify a guest can read only resources owned by its profile and cannot use a client-supplied profile id.
- [ ] 3.2 Audit clinician workspace, grants, recordings, transcription, and projection authorization paths for anonymous users; verify direct guest requests receive denial responses without clinician or patient workspace data.
- [ ] 3.3 Add meaningful guest activity recording and a throttled browser activity signal that does not write on every app-shell request; verify activity is monotonic, updates the expiry window, and stops extending converted/deleting profiles.
- [ ] 3.4 Add anonymous-account creation throttling, abuse challenge integration, and independent guest upload/processing/resource quotas; verify limit responses are deterministic and do not bypass ownership or leak another account's data.
- [ ] 3.5 Add unit and route-level security tests for anonymous-session classification, ownership isolation, clinician denial, activity boundaries, and quota enforcement; verify the tests exercise direct API calls rather than only hidden UI controls.

## 4. Account conversion and guest account UI

- [ ] 4.1 Implement email conversion by attaching and verifying an email identity on the current anonymous session; verify the profile id, documents, biomarkers, reports, and expiry state remain attached after recovery.
- [ ] 4.2 Implement Google conversion through identity linking on the current anonymous session rather than the normal sign-in flow; verify successful linking preserves the same profile id and an existing-identity conflict leaves both accounts unchanged.
- [ ] 4.3 Add `Save my data` UI states for start, pending verification, success, conflict, and retry; verify a converted guest is no longer eligible for guest TTL cleanup.
- [ ] 4.4 Add account-conversion tests for interrupted callbacks, expired links, duplicate identities, and session refresh; verify no conversion path creates a second owner for existing guest data.

## 5. Profile deletion lifecycle and data purge

- [ ] 5.1 Add an idempotent profile-level deletion operation with freeze, lease, retry, terminal status, safe error code, and tombstone metadata; verify the operation record contains no document content, filenames, raw Storage paths, or extracted health data.
- [ ] 5.2 Implement the authenticated `Delete guest data` request path and confirmation UI; verify the request is accepted once, blocks new guest writes, signs the browser session out, and returns the existing operation outcome on retry.
- [ ] 5.3 Connect profile purge to the existing durable document-deletion lifecycle so queued/active writers, derived document rows, reports, observations, health-profile projections, and Storage manifests are handled safely; verify a completed purge leaves no guest-owned product data or recoverable temporary Auth account.
- [ ] 5.4 Add purge failure and concurrency tests for active uploads, processing leases, pending Storage intents, worker retries, and repeated deletion requests; verify transient failures remain retryable and are never reported as completed.
- [ ] 5.5 Add explicit guest-account deletion evidence for database rows, private Storage objects, Auth-user removal, and retained operational tombstones; verify the evidence contains only approved metadata and no medical content.

## 6. Worker retention and operational recovery

- [ ] 6.1 Add worker claim/lease/retry handling for profile-level guest purge and reuse the existing Storage verification safeguards; verify stale claims are reclaimable and Storage cleanup is confirmed before finalization.
- [ ] 6.2 Add the 30-day inactivity selector for unconverted guest profiles and route selected profiles through the same purge operation as explicit deletion; verify converted, active, deleting, and recently active profiles are excluded or handled correctly at the boundary.
- [ ] 6.3 Add worker logs, safe error codes, counters, and alerts for guest creation, conversion, purge backlog, retryable failures, and terminal cleanup; verify operators can distinguish a queued, in-progress, retryable, and completed purge without seeing health content.
- [ ] 6.4 Add database/worker integration coverage for TTL expiry, conversion-vs-cleanup races, worker restart, and Storage failure recovery; verify a restart resumes the operation without duplicate deletion or premature success.

## 7. Product copy, documentation, and release evidence

- [ ] 7.1 Obtain approved guest-consent and disclosure copy, replace applicable legal placeholders, and document server-side storage, browser-session loss, retention, AI processing, conversion, and deletion behavior; verify the rendered links and version identifiers match the approved copy.
- [x] 7.2 Add the guest-mode manual QA checklist with preconditions, safe synthetic data, numbered browser actions, expected results, deletion/TTL evidence, and known environment limitations; verify it does not claim unavailable local-only storage or unapproved legal behavior.
- [x] 7.3 Add release documentation for Supabase anonymous Auth, abuse controls, feature-flag rollout, worker readiness, retention monitoring, and rollback; verify each documented command/configuration is executable or explicitly marked environment-dependent.
- [ ] 7.4 Run the guest browser flow with a synthetic account through entry, name, consent, upload, processing, biomarker/report read, conversion, and deletion; verify the observed result matches every applicable guest-mode scenario.
- [ ] 7.5 Run the focused auth, route authorization, database, worker, typecheck, build, and OpenSpec validation suites; verify `openspec validate --strict` and all guest-mode release gates pass before enabling the flag.
