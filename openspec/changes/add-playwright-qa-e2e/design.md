## Context

EasyHealth has manual UI checklists in `QA/eh-101` through `QA/eh-105` and targeted local scripts for registry, database, and worker contracts. The root package has no browser-test runner. The application is already started by the developer during this workflow; Playwright must attach to that process rather than own its lifecycle.

The application uses one shared remote Supabase environment and the team has no production environment. That makes remote state usable for tests, but it also means an E2E run must coexist with manual development data and cannot rely on `supabase db reset`, table truncation, broad storage deletion, or a destructive cleanup query. Document uploads normally enqueue an asynchronous worker job that can invoke an external model, so browser coverage must not depend on timing, model output, or the deployed worker being available.

The relevant product surfaces span the `auth-shell`, `documents`, and `health-profile` domains. The existing EH-104 and EH-105 automated suites remain the authority for database lineage, CAS, failure atomicity, and worker behavior that is not observable in the browser.

## Goals / Non-Goals

**Goals:**

- Add a Playwright test suite that targets an explicitly supplied, already-running local EasyHealth origin.
- Establish an authenticated test session against remote Supabase without receiving a real email or exposing privileged credentials to browser code.
- Create deterministic, synthetic document and profile states that exercise every current Interface check in `QA/eh-101` through `QA/eh-105`.
- Keep each E2E run isolated from shared data and make cleanup limited to resources that the run can prove it created.
- Make failures actionable with trace, screenshot, and coverage IDs while preventing credentials from appearing in artifacts.

**Non-Goals:**

- Starting, stopping, configuring, or resetting Next.js, Supabase, Docker, or the deployed document worker.
- Testing an LLM extraction result, Poppler/OCR, worker scheduling, migrations, RLS/DB constraints, transactional rollback, or concurrency through Playwright.
- Deleting or modifying data outside the E2E run's owned user, document, storage paths, and tracked fixture IDs.
- Replacing the manual QA checklists or declaring their developer-evidence sections browser-tested.
- Adding a public or browser-accessible test-control API to the application.

## Decisions

### 1. Attach Playwright to the developer-owned server

`playwright.config.ts` will require `E2E_BASE_URL` and set it as `use.baseURL`; it will not configure Playwright's `webServer` option. A preflight request will fail early with a clear message when the origin is unavailable or is not EasyHealth.

The chosen base URL must be registered as an allowed redirect URL in the remote Supabase Auth project. The running origin and the app's documented `URL` setting must be aligned before an E2E run. This addresses the observed `localhost:3000` versus configured `localhost:3002` mismatch without guessing which port the developer intends to use.

**Alternative considered:** let Playwright launch `next dev`. Rejected because the user explicitly wants to test the currently running instance, and a second server can use different environment values or collide on ports.

### 2. Use a unique, remotely authenticated E2E principal per run

Node-side global setup will create a synthetic Auth user whose email and metadata include a cryptographically unique run ID. It will prepare the profile/onboarding state required for the application shell and request an admin-generated magic link. The generated one-time token hash is supplied to `${E2E_BASE_URL}/auth/callback`, where the application verifies it with Supabase `verifyOtp`, writes the normal cookie-backed session, and redirects the browser to the app shell. The callback continues to support the existing PKCE `code` flow for OAuth.

The service-role key is read only by Node setup/fixture code. The browser receives only the existing public Supabase configuration and an authenticated session cookie; traces, screenshots, console dumps, and test reports must redact environment values and magic-link URLs.

The default implicit magic-link flow puts session tokens in a URL fragment, which a server route cannot receive. The documented Supabase email-template configuration can instead send `token_hash` and `type` to the same callback for real user magic links. Directly writing Supabase session cookies remains rejected because it bypasses the application's callback/session integration.

**Alternative considered:** automate email inbox access or Google OAuth. Rejected because both introduce external-provider state and timing.

### 3. Treat shared remote Supabase as a namespaced test fixture store

Each run owns a prefix such as `e2e/<run-id>/` and a corresponding Auth/profile identity. Fixture helpers use the service role to create only synthetic rows and storage objects for that principal, maintain an in-memory ledger of created IDs/paths, and remove exactly those resources in `try/finally` teardown. A guarded orphan-cleanup command may remove only expired resources that match the E2E identity/prefix convention; it must require an explicit opt-in environment variable.

The suite runs serially by default. Unique run IDs prevent collision with another E2E run or a developer's manual test account, while serial execution avoids shared worker and profile timing hazards.

**Alternative considered:** reset the remote database before each suite. Rejected because it would erase shared development data. A permanent `e2e_runs` production table was also rejected: fixtures can be safely owned through the Auth profile, resource prefix, and local ledger without changing the application data model.

### 4. Seed deterministic viewer and downstream states; mock only browser-triggered asynchronous transitions

Fixture helpers will create minimal, schema-valid synthetic documents, original/preview storage objects, extracted evidence, accepted laboratory observations, instrumental findings, and Health Profile inputs through the remote service-role client. Each fixture mirrors a named QA fixture such as `LAB-RESOLVED`, `LAB-PARTIAL`, `INST-REPEAT`, or `INST-FAILURE` and exposes its IDs to the associated spec.

Browser specs will visit real application pages and assert visible labels, values, source navigation, selection, and cross-page effects. For actions that would enqueue the nondeterministic worker (`upload` and `reprocess`), the browser layer will intercept only the client request/response needed to exercise the UI state, while fixture state supplies the resulting ready or failed document. Existing route, worker, and database suites retain responsibility for actual persistence and asynchronous behavior.

**Alternative considered:** upload PDFs through the real API and wait for the remote worker/LLM. Rejected because the current worker requires external AI credentials and its output/timing cannot make a reliable browser regression suite. A test-only application API was rejected because it would increase the production attack surface.

### 5. Preserve checklist traceability and split coverage by safety boundary

Specs are organized by roadmap ID and test titles include the checklist IDs (for example, `EH105-UI-03`). The suite covers all current Interface checks, grouped as follows:

- EH-101: persisted laboratory document readability, source navigation, and non-duplicated history.
- EH-102 and EH-104: resolved versus partial/ambiguous laboratory evidence, review/reprocess UI, and the absence of false trend or Health Profile inputs.
- EH-103: raw evidence visibility and persistence after refresh/reprocess UI.
- EH-105: instrumental finding display, repeated-finding distinction, reprocess display stability, Health Profile laboratory boundary, and controlled failure/retry presentation.

The test suite may assert only observable outcomes. The developer-evidence sections remain linked to their existing DB/worker/static commands instead of being converted into browser claims.

### 6. Keep reviewed-biomarker acceptance compatible with the shared schema during the forward constraint migration

The first full E2E run exercised the real reviewed-biomarker acceptance UI and exposed that the existing `observations_source_extracted_biomarker_unique` object is a partial unique index. PostgreSQL enforces that invariant, but PostgREST cannot infer it as the target of `ON CONFLICT (source_extracted_biomarker_id)`, so acceptance returned HTTP 500.

Acceptance and manual-correction writers therefore update by the source extracted-biomarker ID first, insert only when absent, and retry that update after a duplicate-key race. This remains idempotent with the historical partial index and with the replacement table-level unique constraint. Forward migration `033_observations_source_extracted_biomarker_upsert_constraint.sql` replaces the partial index with a normal UNIQUE constraint; PostgreSQL permits multiple NULL values, so this preserves the intended lineage invariant for legacy observations. The E2E suite verifies the compatible application path but does not claim database-constraint proof.

## Risks / Trade-offs

- **[Remote test cleanup fails after a crash]** → Prefix every owned resource and provide explicit, narrowly scoped orphan cleanup; never use broad deletion or reset operations.
- **[A shared worker consumes an E2E-uploaded job]** → Default browser tests do not enqueue real processing jobs; they use seeded documents and request interception for asynchronous UI transitions.
- **[Supabase rejects local callback redirects]** → Preflight validates the configured origin and documentation requires it in the remote Auth redirect allow-list before the suite starts.
- **[The live local server uses stale or different environment configuration]** → Preflight records the base URL and verifies the EasyHealth response; the operator owns restarting the server with the intended configuration.
- **[Fixture inserts drift from schema changes]** → Centralize fixtures in typed helpers, keep them minimal, and fail fast on Supabase errors; existing migration/DB test commands remain required in CI.
- **[Privileged keys leak through test diagnostics]** → Keep service-role access in Node-only helpers and redact secrets/URLs from Playwright attachments and logs.
- **[UI copy or structure makes selectors brittle]** → Prefer accessible roles and labels; add narrowly scoped `data-testid` attributes only where a stable semantic locator does not exist.

- **[A magic link returns implicit-flow tokens in a fragment]** → The callback supports server-side `token_hash` verification and the E2E setup never logs or attaches that one-time value.

- **[Code can reach an environment before migration 033]** Keep the update/insert/retry writer path compatible with either index shape; do not weaken source-extracted-biomarker uniqueness or perform an unscoped data migration.

## Migration Plan

1. Add Playwright and E2E scripts plus backward-compatible Auth callback and reviewed-biomarker persistence paths for server-side one-time magic-link verification and the current partial-index schema.
2. Add the preflight, auth bootstrap, fixture ledger, cleanup guard, and a documented environment template; run only against the current local server and shared remote Supabase project.
3. Implement the checklist-mapped specs incrementally, initially with one browser worker and synthetic fixture state.
4. Run the existing static/DB/worker checks alongside the new E2E suite. Investigate failures before expanding parallelism or test scope.
5. The operator applied forward migration 033 to the shared non-production database, then the full serial E2E suite passed again. Roll back browser-harness code by removing the E2E dependency/configuration, test-only fixture files, and the callback's token-hash branch if server-side magic-link support is no longer desired. The forward constraint migration is intentionally retained: it preserves the existing source-lineage invariant and requires no data deletion. Cleanup remains safe to run for the owned prefix.

## Open Questions

- The remote Supabase Auth redirect allow-list must include the final `E2E_BASE_URL` (currently the running EasyHealth server responds on `http://localhost:3000`).
- The implementation must confirm the smallest schema-valid fixture shapes for every EH-101–EH-105 state and whether any existing UI element needs a test ID after accessible locators are evaluated.
- The proposal assumes a single serial browser worker. Parallelization can be considered only after isolated run ownership and cleanup prove stable in the shared database.
