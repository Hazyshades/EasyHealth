# Guest mode release guide

Guest mode uses a Supabase anonymous Auth user and a normal EasyHealth `profiles` row classified as `guest`. Product data remains server-side. Browser storage is only a session transport: clearing browser data or signing out loses access unless the user first saves the account with email or Google.

The guest retention default is 30 days after the latest meaningful activity. The database stores the expiry timestamp; the worker selects expired, unconverted, active profiles and sends them through the durable profile-deletion operation.

## Required migration and services

1. Apply `supabase/migrations/107_guest_mode.sql`, `supabase/migrations/108_guest_creation_reservations.sql`, `supabase/migrations/109_guest_write_fence.sql`, and `supabase/migrations/110_guest_conversion.sql` after the existing migrations.
2. Run the document worker with the same Supabase URL and service-role key as the application.
3. Confirm the worker can list and delete objects in the private `lab-documents` bucket. It verifies the profile prefix is empty before finalizing a purge.
4. Keep the application and worker deployment on compatible migration versions. Do not roll back the migration while guest profiles or deletion tombstones exist.

## Supabase Auth settings

These settings are hosted-project or deployment evidence, not inferred from local source files:

- Anonymous sign-ins: enabled in the target Supabase project.
- Manual identity linking: enabled for email and Google conversion when those providers are enabled.
- Google provider: currently disabled in the target project; enabling it is required before claiming Google conversion support.
- Public anonymous-sign-in abuse protection: not configured in the target project. The current app does not yet pass a provider token to Supabase anonymous sign-in, so public guest creation remains blocked until that integration is implemented and verified.
- Invite-only private beta: may use `GUEST_ABUSE_CHALLENGE_REQUIRED=false` with `GUEST_ABUSE_CHALLENGE_ENABLED=false`, the peppered creation-window throttle, and an access-limited deployed origin. This is not public abuse protection.
- Redirect URLs include `/auth/callback` for the deployed origin.
- RLS policies are reviewed with Supabase's `auth.jwt()->>'is_anonymous'` claim in mind. Anonymous users use the `authenticated` Postgres role.

The local repository contains `enable_anonymous_sign_ins = true` in `supabase/config.toml`; this does not prove that the hosted project is enabled.

## Environment contract

Set both feature flags only after the hosted Auth settings and smoke flow are ready. The private-beta path below deliberately omits a CAPTCHA provider but keeps the peppered creation throttle.

| Variable | Default | Purpose |
| --- | ---: | --- |
| `GUEST_MODE_ENABLED` | `false` | Server-side entry and initialization kill switch. |
| `NEXT_PUBLIC_GUEST_MODE_ENABLED` | `false` | Client entry-point visibility switch. |
| `GUEST_RETENTION_DAYS` | `30` | Retention window used when a guest profile is initialized. Keep aligned with approved copy and worker policy. |
| `GUEST_CREATION_LIMIT` | `5` | Creation attempts per rate-limit window. |
| `GUEST_CREATION_WINDOW_SECONDS` | `3600` | Creation throttle window. |
| `GUEST_RATE_LIMIT_PEPPER` | unset | Required server secret for the hashed trusted-ingress address key; use a secret of at least 16 characters. |
| `GUEST_ABUSE_CHALLENGE_ENABLED` | `false` | Deployment marker for an actually configured provider challenge. Setting it to `true` does not provide a token integration and does not enable public guest creation. |
| `GUEST_ABUSE_CHALLENGE_REQUIRED` | `true` | Hard gate for guest creation. Set to `false` only for a deliberately invite-only/private beta that accepts the absence of a CAPTCHA provider. |
| `GUEST_PURGE_BACKLOG_ALERT_THRESHOLD` | `10` | Worker warning threshold for queued plus retryable purge operations. |
| `GUEST_PURGE_RETRY_ALERT_THRESHOLD` | `3` | Worker warning threshold for retryable purge operations. |
| `GUEST_PURGE_ALERT_COOLDOWN_SECONDS` | `300` | Minimum interval between repeated worker warning alerts. |
| `GUEST_UPLOAD_COUNT_PER_DAY` | `10` | Guest upload count quota. |
| `GUEST_UPLOAD_BYTES_PER_DAY` | `104857600` | Guest upload byte quota. |
| `GUEST_PROCESSING_COUNT_PER_DAY` | `10` | Guest processing/reprocess quota. |

The server requires the pepper and the explicit private-beta override before allowing guest creation. Public creation remains blocked until a provider token is integrated. Quota reservations are atomic database operations and return deterministic `429` responses on limits and `503` responses when the quota service is unavailable.

## Rollout

1. Deploy the migration and worker code with both guest flags false.
2. Set the pepper and quota values in the application environment. Keep the pepper stable across application instances.
3. Configure and verify hosted anonymous Auth, manual linking, Google, callback URLs, and a provider-token abuse control before a public rollout. The current build intentionally blocks this path until the token integration exists.
4. For an invite-only private beta, leave Google and CAPTCHA disabled, set `GUEST_ABUSE_CHALLENGE_REQUIRED=false`, keep `GUEST_ABUSE_CHALLENGE_ENABLED=false`, and keep the deployed origin access-limited. This is not public abuse protection.
5. Run the manual checklist in `QA/guest-mode/checklist.md` with synthetic data.
6. Enable `GUEST_MODE_ENABLED` and `NEXT_PUBLIC_GUEST_MODE_ENABLED` together for a small cohort or disposable environment.
7. Monitor guest creation decisions, conversion outcomes, the worker metrics line, deletion backlog, retryable purge error codes, and threshold alerts. Logs contain operation identifiers and safe error codes, not filenames, storage paths, or health content.
8. Expand the cohort only after database, worker, Storage, Auth-user removal, and conversion evidence is recorded.

## Disable and rollback

- To stop new guest entry without deleting existing guest data, set both feature flags to `false` and redeploy the application.
- Keep the worker running while existing guest deletion operations drain. Existing explicit and TTL operations are database-backed and do not depend on the client flag.
- If abuse protection or Storage is unhealthy, disable both flags, preserve the migration and worker, and investigate retryable operations.
- Do not delete migration `107_guest_mode.sql` or manually delete guest profiles. Use the deletion operation and worker so document writers, derived rows, Storage, Auth users, and operational tombstones remain consistent.

## Operational evidence commands

Run from the repository root. If `pnpm` is not installed as a standalone command, use the equivalent `corepack pnpm` command.

```text
pnpm test:guest-mode
pnpm test:guest-mode-db
pnpm exec tsc --noEmit
pnpm --dir worker exec tsc --noEmit
pnpm exec tsx scripts/verify-app-navigation-hot-path.ts
openspec validate guest-mode --strict
```

`test:guest-mode-db` requires a reachable local Supabase/Postgres instance with pgTAP. Hosted Auth settings, hosted CAPTCHA, remote Storage, and production worker evidence require the target environment and are not established by local typechecking.

## Current local, hosted, and release evidence

- The pure guest identity/lifecycle/consent verifier passes, including the explicit private-beta policy branch that requires the pepper but does not require a provider challenge.
- The app navigation hot-path verifier passes.
- Application and worker TypeScript checks pass when invoked with `corepack pnpm`.
- `corepack pnpm exec next build` passes.
- Browser smoke confirmed the disabled state hides guest entry and the server-disabled state shows a retryable guest error without console errors.
- The target Supabase project `nuqvypxavtorupntmrau` has the guest migration objects, guest profile columns, eleven service-role guest routines including the one-time creation-ticket and conversion RPCs, RLS on the guest tables, and empty guest operational tables.
- Hosted Auth has anonymous sign-ins and manual identity linking enabled. A disposable anonymous sign-in returned HTTP 200; the created Auth user was deleted successfully with HTTP 200.
- The hosted Site URL and six-entry redirect allowlist include the Railway origin and `/auth/callback`; the private `lab-documents` bucket and service-role-only Storage policy are present.
- The target migration history still ends at version `100`; versions `101`–`110` are not recorded because the guest SQL was applied manually while unrelated migrations were pending. Do not claim migration-history reconciliation or run an uncontrolled push until that state is repaired deliberately.
- The hosted guest write-fence metadata and transactional smoke passed for profile writes, idempotent deletion requests, TTL rejection, expired activity rejection, and eligible conversion.
- The local database verifier is blocked because the Supabase CLI is unavailable and Docker/local Postgres is not reachable.
- The full Auth, onboarding, Storage, conversion, and deletion flow was not run: the private-beta Railway variables are staged but not deployed, Google OAuth is disabled, and public provider-token abuse protection is not configured.
- Railway `document-worker` now has `WORKER_POLL_INTERVAL_MS=30000`; the redeployment completed successfully and the worker reported `EasyHealth document worker started`. This lowers polling volume at the cost of up to roughly 25 seconds of additional job pickup latency.
- Guest consent/legal copy approval is a release/legal gate. This implementation must not be represented as approved legal text until that approval is attached to the release record.
