# Playwright E2E: local EasyHealth + shared remote Supabase

The Playwright suite always targets an already-running local EasyHealth server. It never starts, restarts, or stops Next.js. It uses the shared non-production Supabase project only after an explicit opt-in and creates synthetic data in an `e2e/<run-id>/` Storage namespace.

## One-time browser setup

```powershell
corepack pnpm e2e:install
```

The installed Chromium revision is pinned by the repository's `@playwright/test` dependency and `pnpm-lock.yaml`.

## Required local origin and Auth redirect URL

Start or keep the normal Next.js server running yourself, then point the test run at the exact reachable origin:

```powershell
$env:E2E_BASE_URL = "http://localhost:3000"
$env:E2E_REMOTE_SUPABASE = "1"
corepack pnpm preflight:e2e
corepack pnpm test:e2e
```

To run one checklist-mapped test without accidentally expanding to the full suite, invoke Playwright directly:

```powershell
corepack pnpm exec playwright test --grep "EH101-UI-01"
```

`E2E_BASE_URL` is required. The harness accepts only `localhost`, `127.0.0.1`, or `::1`, so a browser run cannot accidentally use a deployed application.

The repository's current environment may still contain `URL=http://localhost:3002`, while the running Next.js instance is commonly on `http://localhost:3000`. Do not rely on `URL` for E2E: set `E2E_BASE_URL` to the port that actually responds before every run.

In the shared remote Supabase project's **Authentication → URL Configuration**, add this exact additional redirect URL for each local origin used by the suite:

```text
http://localhost:3000/auth/callback
```

For a different local port, add the matching `${E2E_BASE_URL}/auth/callback`. The suite uses an admin-generated magic link only in Node setup, follows the real application callback route, and saves the resulting browser session state locally. A redirect mismatch is reported before checklist assertions run.

## Server-side magic-link callback

EasyHealth's `/auth/callback` supports both OAuth/PKCE `code` values and a one-time `token_hash` with its email verification type. The E2E setup uses the hash returned by Supabase's admin-generated magic link only to invoke that real callback; it never writes a session cookie itself or records the hash in output.

For ordinary user email magic links to use the same server-side callback, configure the remote Supabase **Magic Link** email template to point at the supplied redirect target with the generated token hash:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=magiclink">Sign in to EasyHealth</a>
```

The configured `RedirectTo` value must remain an allowed Auth Redirect URL. This template change is an Auth-project setting; it is not made by the Playwright harness.

## Environment and safety boundary

The existing local `.env` supplies these values; they must never be committed or printed:

- `NEXT_PUBLIC_SUPABASE_URL` — must be the shared **remote HTTPS** project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — Node setup/cleanup only; never exposed to browser tests.
- `E2E_BASE_URL` — explicit locally running EasyHealth origin.
- `E2E_REMOTE_SUPABASE=1` — explicit permission to create scoped synthetic remote test data.

The preflight checks all required variables without echoing values, verifies that the supplied origin responds as EasyHealth, and performs a read-only check for the required EH-105 remote schema before any remote mutation. Every run generates a unique lowercase `pw-...` ID unless `E2E_RUN_ID` is supplied. The run owns only:

- two synthetic `e2e+<run-id>.*@easyhealth.test` Auth/profile principals;
- fixture document IDs recorded in `.playwright/e2e-run.json`;
- exact `lab-documents` object paths under `e2e/<run-id>/`.

Playwright runs with one worker. Global teardown deletes only those ledger-owned paths and those exact synthetic principals. It has no database-reset, truncate, unscoped Storage delete, or unowned profile deletion path. `playwright-report`, `test-results`, and local `.playwright` state are ignored by Git. Failure traces retain navigation/screenshot evidence but omit DOM and source snapshots; the magic-link navigation happens only in global setup and is never attached to a test report.

If a run is interrupted, its ledger is deliberately retained for exact recovery:

```powershell
$env:E2E_BASE_URL = "http://localhost:3000"
$env:E2E_REMOTE_SUPABASE = "1"
corepack pnpm e2e:cleanup
```

An older-orphan operation is intentionally separate and requires both an explicit flag and a cutoff at least one hour in the past:

```powershell
$env:E2E_ALLOW_ORPHAN_CLEANUP = "1"
$env:E2E_ORPHAN_BEFORE = "2026-07-19T00:00:00Z"
corepack pnpm e2e:cleanup:orphans
```

It selects only expired `e2e+...@easyhealth.test` profiles and their parsed `e2e/<run-id>/` object paths. Guard behavior is covered by `corepack pnpm test:e2e:safety`.

## What browser tests do and do not prove

The suite seeds deterministic synthetic document, source-page, extracted-evidence, laboratory, instrumental, and cached Health Profile synthesis records. Upload and reprocess tests intercept only the asynchronous browser response needed to exercise the client UI; they do not enqueue workers or call OCR/LLM providers. The cached synthesis hash is refreshed after fixture-only state changes, so Health Profile reads do not select an AI model or make an external AI call. The existing worker, migration, registry, and database verification commands remain the developer-evidence authority. See [E2E coverage map](e2e-coverage.md) for the interface-check mapping.

The target pages already provide stable accessible headings, labels, checkbox names, and buttons, so the suite uses semantic Playwright locators and adds no production-only `data-testid` attributes.

## Implementation verification record

On 2026-07-20, TypeScript checking, the E2E cleanup guard test, Playwright test discovery (20 tests), and `pnpm test:eh105` passed. Once the external EasyHealth server was reachable, the original setup attempt safely stopped before browser assertions because the shared Supabase schema cache did not contain `public.document_extracted_instrumental_measures`, required by the `INST-*` EH-105 fixtures. Setup cleanup left no ownership ledger. The preflight now detects that missing table with a bounded read before any remote write. After migration `032_eh105_instrumental_observation_lineage.sql` was applied and the callback gained server-side magic-link token-hash verification, the full command `corepack pnpm exec playwright test` passed all 20 tests serially against `http://localhost:3000` in 3.7 minutes. Its global teardown removed only the owned run resources, and a follow-up `corepack pnpm e2e:cleanup` verified that no ownership ledger remained. The run exposed a pre-existing PostgREST limitation: the application targeted a partial unique index with `ON CONFLICT` during biomarker acceptance. The application now safely uses update/insert/retry persistence, and migration `033_observations_source_extracted_biomarker_upsert_constraint.sql` replaces that partial index with a standard UNIQUE constraint. The operator then applied migration 033 to the shared non-production database; a second full serial suite passed all 20 tests in 3.8 minutes, and a follow-up cleanup again verified no ownership ledger. `pnpm test:eh104-db` was attempted but local Postgres was unavailable. The existing registry chain also reached its environment-dependent stage without loading local variables; its earlier registry/identity checks passed, but the chain did not complete. These are developer-environment limitations, not passed browser coverage.
