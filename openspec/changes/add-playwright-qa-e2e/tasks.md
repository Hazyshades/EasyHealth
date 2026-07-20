## 1. Playwright and externally run application setup

- [x] 1.1 Add `@playwright/test`, a locked browser-install workflow, and root package scripts for running the E2E suite against an externally supplied origin.
- [x] 1.2 Add `playwright.config.ts` that requires `E2E_BASE_URL`, uses it as `baseURL`, has no `webServer` configuration, runs serially by default, and retains failure-only trace/screenshot/video artifacts.
- [x] 1.3 Implement a preflight that verifies the supplied origin is reachable EasyHealth before remote setup begins, reports the origin clearly, and checks that required E2E environment variables are present without printing values.
- [x] 1.4 Document the required local-server origin and remote Supabase Auth redirect allow-list setup, including resolution of the current `localhost:3000` versus configured `localhost:3002` mismatch.

## 2. Shared remote Supabase safety and authenticated browser context

- [x] 2.1 Create Node-only E2E environment helpers that validate the remote Supabase URL, public credentials, service-role credential, explicit remote-test opt-in, and a generated unique run ID without exposing secrets to browser code.
- [x] 2.2 Implement a run ownership ledger for the synthetic Auth user, profile, document IDs, and Storage paths, using an `e2e/<run-id>/` namespace and synthetic-only fixture labels.
- [x] 2.3 Implement global setup that creates the synthetic Auth/profile/onboarding state, uses an admin-generated one-time magic-link token hash through the real `/auth/callback`, and saves Playwright storage state; keep the application callback compatible with its existing PKCE code flow.
- [x] 2.4 Implement teardown that deletes only ledger-owned remote resources in dependency-safe order and rejects database resets, table truncation, unscoped Storage deletes, or unowned user/profile deletion.
- [x] 2.5 Add an explicit opt-in orphan-cleanup command limited to expired E2E-prefixed resources and tests for the cleanup guard behavior.
- [x] 2.6 Redact service-role credentials, auth headers, and magic-link values from Playwright logs, traces, reports, and committed configuration.
- [x] 2.7 Keep reviewed-biomarker acceptance and manual-correction persistence compatible with the historical partial source-lineage index, and add a forward migration to a standard UNIQUE constraint.

## 3. Deterministic synthetic document and profile fixtures

- [x] 3.1 Add minimal synthetic source assets and typed fixture helpers for storage-backed document previews, source text/pages, and the document viewer's required metadata.
- [x] 3.2 Implement schema-valid laboratory fixtures for `LAB-BASELINE`, `LAB-RESOLVED`, `LAB-PARTIAL`, `LAB-AMBIGUOUS`, `LAB-PROVENANCE`, `LAB-PROVENANCE-PARTIAL`, and `LAB-NOT-RESOLVED`, including accepted/reviewable state and downstream observation inputs where required.
- [x] 3.3 Implement schema-valid instrumental fixtures for `INST-NORMAL`, `INST-REPEAT`, and `INST-FAILURE`, including distinct source occurrences, stable visible finding state, and a deterministic recoverable failure state.
- [x] 3.4 Add fixture assertions that fail fast on remote Supabase mutation errors and prove each created resource is registered in the run ownership ledger.
- [x] 3.5 Add browser request helpers that exercise upload/reprocess UI responses without enqueuing or awaiting real worker/LLM processing; keep worker, route, and DB verification responsibilities in their existing suites.

## 4. Stable browser interaction layer

- [x] 4.1 Build reusable Playwright helpers for authenticated navigation, seeded document opening, source selection, refresh, Biomarkers, and Health Profile assertions.
- [x] 4.2 Audit target controls for accessible role/name locators and add narrowly scoped `data-testid` attributes only where a stable semantic locator is unavailable.
- [x] 4.3 Add failure diagnostics that preserve the checklist ID, synthetic fixture identity, and useful browser evidence without exposing configuration values.

## 5. Checklist-mapped browser coverage

- [x] 5.1 Implement `EH101-UI-01` through `EH101-UI-03`: baseline document readability, source navigation, and stable biomarker history after refresh.
- [x] 5.2 Implement `EH102-UI-01` through `EH102-UI-05`: resolved upload/review visibility, partial/ambiguous safety boundaries, and the empty-resolved-trend explanation.
- [x] 5.3 Implement `EH103-UI-01` through `EH103-UI-04`: visible raw evidence/source attribution, refresh/reprocess presentation, and safe unresolved-data handling.
- [x] 5.4 Implement `EH104-UI-01` through `EH104-UI-03`: consistent resolved review, non-resolved trend exclusion, and coherent reprocess presentation.
- [x] 5.5 Implement `EH105-UI-01` through `EH105-UI-05`: instrumental findings/source selection, reprocess display stability, distinct repeated findings, laboratory-assessment exclusion, and controlled failed-processing recovery.
- [x] 5.6 Add a QA E2E coverage map that links each test ID to its manual Interface check and explicitly leaves each checklist's Developer evidence required section to the existing DB/worker/static commands.

## 6. Verification and handoff

- [x] 6.1 Run the E2E preflight and the full serial Playwright suite against the currently running local EasyHealth server and shared remote Supabase environment; verify teardown leaves no owned resources.
- [x] 6.2 Run type checking and relevant existing registry, EH-104 DB, and EH-105 worker/static checks; record separately any unavailable local prerequisite rather than treating it as browser coverage.
- [x] 6.3 Validate `add-playwright-qa-e2e` with `openspec validate --strict` and review the final test/QA coverage mapping before requesting implementation completion.
