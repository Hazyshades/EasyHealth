## Why

The QA package defines twenty browser-facing regression checks for EH-101 through EH-105, but the repository has no browser E2E runner. Existing database and worker scripts prove internal contracts; they do not prove that an authenticated user can complete the documented document, biomarker, and Health Profile journeys in the running application.

The team intentionally uses one shared remote, non-production Supabase database. Browser coverage must therefore be repeatable without resetting the database, truncating shared tables, or deleting data that an E2E run cannot prove it owns.

## What Changes

- Add a Playwright E2E test harness that targets an already-running local Next.js server through an explicit base URL; the test runner does not start or stop the application server.
- Add Node-only remote Supabase setup and cleanup helpers that create a unique, run-scoped E2E user, documents, storage objects, and fixture state, then delete only resources owned by that run.
- Establish an authenticated browser session through the supported Supabase callback flow, with a documented redirect-URL prerequisite for the selected local server port and server-side handling for both PKCE codes and one-time magic-link token hashes.
- Harden reviewed-biomarker acceptance persistence for the existing shared schema: avoid a PostgREST `ON CONFLICT` target that cannot use the historical partial unique index, and add a forward migration that replaces it with a standard UNIQUE constraint.
- Add deterministic fixture-driven browser coverage mapped to the Interface checks in `QA/eh-101` through `QA/eh-105`, including normal laboratory and instrumental journeys, source navigation, review/reprocess behavior, downstream Biomarkers/Health Profile safety boundaries, and a controlled failed-processing recovery state.
- Preserve the existing DB, worker, and static verification scripts as developer evidence; browser tests do not claim to prove migrations, concurrency, or hidden lineage invariants.
- Document required E2E environment variables, shared-database safety rules, local-server readiness checks, fixture ownership, cleanup behavior, and how to run the suite against the current Next.js instance.

## Capabilities

### New Capabilities

- `qa-browser-e2e`: Repeatable Playwright coverage for the documented QA interface journeys using an externally started local application and safely isolated state in the shared remote Supabase environment.

### Modified Capabilities

- `supabase-auth`: extend the server callback so email magic links can establish a normal cookie-backed session from a verified one-time token hash, while retaining the existing PKCE callback behavior.

## Impact

- **Target domains:** `auth-shell`, `documents`, and `health-profile`.
- **Validated existing capability specs:** `supabase-auth`, `document-upload-async`, `document-viewer`, `document-extraction-review`, `instrumental-observations`, `biomarkers-overview`, and `health-profile`.
- **Code and dependencies:** root package scripts and lockfile, Playwright configuration, E2E fixtures/helpers/specs, the application Auth callback, biomarker-acceptance persistence compatibility handling, a forward Supabase migration, and QA coverage documentation.
- **Remote services:** the shared remote Supabase Auth, database, and Storage environment receives only run-owned synthetic test data; the service-role credential is available only to Node-side setup/cleanup and never to browser code, screenshots, traces, or reports.
- **Local runtime:** the operator starts Next.js separately and supplies its exact URL. The app URL used for Supabase redirects must match that running origin.
