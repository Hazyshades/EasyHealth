# Guest mode QA checklist

## Preconditions

- Use a disposable application and Supabase project with `107_guest_mode.sql`, `108_guest_creation_reservations.sql`, `109_guest_write_fence.sql`, `110_guest_conversion.sql`, and `111_guest_activity_and_consent.sql` applied and the worker running against the same project.
- For an invite-only private beta, Google and CAPTCHA may remain disabled only when `GUEST_ABUSE_CHALLENGE_REQUIRED=false`, `GUEST_ABUSE_CHALLENGE_ENABLED=false`, the pepper is configured, a trusted-ingress adapter supplies a signed client-address attestation, and the deployed origin is access-limited. Record that this is not public abuse protection; hosted Auth platform limits still apply to direct anonymous sign-in.
- Set both guest flags to `true`, configure a stable `GUEST_RATE_LIMIT_PEPPER`, configure the trusted-ingress sidecar/adapter, and record the quota values used for the run.
- Prepare two independent browser profiles or private windows. Use one guest account in each to check ownership isolation.
- Prepare one normal non-guest test account to confirm the existing sign-in and account presentation are unchanged.
- Test once at a desktop viewport and once at a 375 px mobile viewport.

## Manual product checks

### 1. Guest entry and onboarding

1. Open the auth entry page in a clean browser profile.
2. Confirm `Login as Guest` is visible only when the public guest flag is enabled.
3. Activate `Login as Guest` once. Confirm a loading state prevents duplicate activation.
4. Confirm the browser reaches the guest Profile onboarding page and does not show the app shell before onboarding is complete.
5. Submit the guest Profile form with a blank name. Confirm validation appears and the page does not advance.
6. Enter a synthetic first name and continue. Confirm the name is accepted and remains visible after reload.
7. Confirm the guest consent page has one required checkbox, links to Terms and Privacy, and clearly states server-side storage, browser-session loss, retention, AI/health-data processing, conversion, and deletion behavior.
8. Try to continue with the checkbox clear. Confirm the control remains disabled or the page reports the missing required consent without navigating to `/app`.
9. Accept the guest consent. Confirm the app shell opens and the account shell identifies the session as a guest without displaying a fake email address.

### 2. Patient product isolation

1. In guest window A, open the patient dashboard and upload `guest-demo-lab.pdf`.
2. Confirm the upload enters processing and the guest can read only its own document, biomarker, health-profile, and report results.
3. In guest window B, attempt to open the document, biomarker, health-profile, report, assistant, or share-management endpoint using IDs observed from window A. Confirm the response is unauthorized/not found and no window-A data is shown.
4. Attempt the same cross-profile requests directly in the browser Network panel, not only through hidden UI controls. Confirm a client-supplied profile ID cannot change the server-owned profile scope.
5. Open clinician workspace, recording, transcription, projection, and grant routes while authenticated as the guest. Confirm each returns a denial response and no clinician or patient workspace data.

### 3. Activity and quota behavior

1. Stay on `/app` for at least one normal route navigation and observe Network requests. Confirm activity is sent through the throttled guest activity endpoint rather than by every app-shell read.
2. Confirm a successful activity heartbeat extends the displayed expiry deadline and never moves the stored activity timestamp backward.
3. Configure a low disposable upload or processing quota. Upload or reprocess until the limit is reached. Confirm the limit response is deterministic (`429`), contains no other profile's data, and does not bypass ownership.
4. Retry after a quota limit and confirm the request remains blocked until the configured UTC usage window changes.
5. Trigger the guest creation throttle from one controlled attested client address until it blocks. Confirm the response is `429` with `Retry-After`; do not inject or vary raw forwarding headers and do not continue testing with real user data.

### 4. Save my data conversion

1. From the guest Account page, open `Save my data` and confirm the email form has a clear pending-verification state and no password or email placeholder is shown before an identity exists.
2. Submit a synthetic email address. Confirm the UI reports that verification is pending and offers retry guidance without creating a second profile.
3. Verify the email through the configured provider callback. Confirm the same profile ID, document, biomarker, report, and account data remain present after the session refresh.
4. Repeat with an email identity already owned by another disposable account. Confirm the conflict is reported, neither account loses data, and no second owner is created for the guest data.
5. After successful conversion, confirm the account is presented as standard, the guest expiry is cleared, and the worker does not select the profile for guest TTL cleanup.

### 5. Explicit deletion

1. In a disposable guest account with the synthetic document and derived results, open Account and choose `Delete guest data`.
2. Confirm the first click only opens the explicit confirmation state. Confirm the final action names the irreversible deletion and does not submit accidentally.
3. Confirm the final action signs the browser session out or reports the documented sign-out limitation while still returning the deletion operation outcome.
4. Confirm a follow-up app request cannot create or modify guest data after the deletion request; new writes must be denied while the profile is deleting.
5. Confirm the worker completes the operation. After completion, confirm the guest cannot sign in again with the old anonymous session and the product data is unavailable.
6. Repeat the deletion request through a safe API replay before the operation is finalized. Confirm it returns the existing operation outcome instead of creating a second operation.

### 6. Normal account regression and disabled state

1. With guest flags disabled, reload the auth entry page. Confirm no guest entry is visible.
2. Sign in with the normal disposable account. Confirm the existing Profile/consent gates, app navigation, email presentation, and account controls remain unchanged.
3. With the server flag disabled but a direct guest API request attempted, confirm guest initialization is rejected and no profile is created.

## Developer evidence

- [x] `corepack pnpm test:guest-mode`.
- [ ] `corepack pnpm test:guest-mode-db` against a reachable local Supabase/Postgres database with pgTAP. Current workspace is blocked by missing Supabase CLI and Docker/local Postgres.
- [x] `corepack pnpm exec tsc --noEmit` and `corepack pnpm --dir worker exec tsc --noEmit`.
- [x] `corepack pnpm exec tsx scripts/verify-app-navigation-hot-path.ts`.
- [x] `corepack pnpm exec next build`.
- [x] `openspec validate guest-mode --strict`.
- [x] Hosted target migration objects, guest profile columns, service-role grants, guest-table RLS, private `lab-documents` Storage, Auth anonymous sign-ins, manual linking, Site URL, and `/auth/callback` redirect allowlist were inspected.
- [x] Disposable hosted anonymous sign-in returned HTTP 200 and its test Auth user was removed with HTTP 200.
- [x] Hosted `guest_creation_reservations`, `reserve_guest_creation_ticket`, and `consume_guest_creation_ticket` objects were applied and a disposable transactional reservation/consumption smoke passed with cleanup.
- [x] Hosted guest write-fence triggers and the idempotent/TTL-checked deletion routine from `109_guest_write_fence.sql` were applied and metadata-validated.
- [x] Hosted `110_guest_conversion.sql` was applied; expired activity and eligible conversion transactional smokes passed with rollback cleanup.
- [ ] Apply and smoke-test `111_guest_activity_and_consent.sql`; the current Supabase dashboard session expired before this forward migration could be applied, so hosted activity-fence and three-argument conversion evidence is pending.
- [ ] Review direct product API responses for guest ownership, clinician denial, activity, quota, conversion, and deletion; do not count UI-only hiding as authorization evidence.
- [ ] Verify `guest_profile_deletion_operations` contains only profile ID, reason, status, lease/retry timestamps, safe error code, and receipt metadata. It must contain no filename, raw Storage path, document content, extracted health data, prompt, or report text.
- [ ] Record the SQL evidence for the purge: no guest-owned `profiles`, `documents`, document deletion work, derived reports/observations/health-profile rows, or Storage objects remain; the approved operational tombstone remains with `status = 'completed'`.
- [ ] Exercise a worker restart between claim and completion. Confirm the expired lease is reclaimable and completion is not reported before Storage verification.
- [ ] Record quota values, attested creation-throttle results, worker status logs, retryable error codes, and alert/dashboard evidence without health content. Verify durable upload reservations release all three quota units on failed uploads, successful uploads finalize their reservation, repeated release/finalization calls are idempotent, the worker reconciles stale reserved rows, and report/synthesis/assistant/recalculation calls reserve processing capacity before model or worker execution.

## Known limitations

- Do not mark the browser flow tested without a reachable running app, hosted or disposable Supabase Auth, Storage, and worker.
- Do not mark email conversion tested without the provider, manual linking, redirect URL, and verification flow configured. Google OAuth is currently disabled in the target project and the private-beta UI does not offer Google conversion; an invalid/fake email cannot complete a magic-link conversion. Google conversion requires separate provider enablement and UI/API evidence before it can be claimed.
- The private-beta override may omit CAPTCHA only for an access-limited deployment with the peppered creation throttle and trusted-ingress attestation. The current app does not pass a provider token to anonymous Auth, so public guest creation remains blocked; do not describe private mode as public abuse protection. Direct hosted Auth attempts remain governed by provider/platform limits.
- Do not mark TTL, purge, concurrency, or Storage claims from TypeScript or pure verifier output. They require the database, worker, Auth admin, and private Storage evidence above.
- Guest consent/legal copy is not approved merely because the UI renders it. Attach legal/product approval and the matching version identifier before release.
- The target migration history still ends at version `100`; the manually applied guest SQL is not migration-history reconciliation.
- The package `corepack pnpm build`/`corepack pnpm typecheck` lifecycle wrappers are not usable in this Windows workspace because their child scripts invoke standalone `pnpm`; direct `corepack pnpm exec next build` and direct TypeScript checks pass.
