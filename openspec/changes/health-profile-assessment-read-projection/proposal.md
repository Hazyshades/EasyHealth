## Why

EH-146 introduced an explicit profile-wide assessment lifecycle mapper, but the read contract is still assembled across the API route and client adapters. The route validates persisted payloads, selects a request-time fallback, and derives lifecycle metadata, while the profile page and dashboard retain defensive defaults; this leaves one lifecycle fact harder to test and allows clients to diverge if metadata is absent. The change consolidates that existing behavior before another lifecycle consumer is added.

This is a behavior-preserving Health Profile read-contract change. It does not alter score/readiness semantics, observation freshness, document-processing state, assessment persistence, migrations, or RPCs.

## What Changes

- Add one canonical assessment read projection for a persisted canonical payload, a legacy/malformed payload fallback, assessment-job metadata, and the resulting lifecycle metadata.
- Move persisted-payload shape validation and fallback-versus-persisted interpretation behind the read projection while keeping profile-scoped database access and fallback snapshot I/O in the API adapter.
- Make `assessment.display_state`, `assessment.has_current_version`, status, fallback, version, timestamp, policy, and error fields one explicit read contract for successful `GET /api/health-profile` responses.
- Migrate the Health Profile page and dashboard to consume the server-projected lifecycle state instead of independently recomputing or defaulting it; preserve the existing narrow lifecycle props passed to cards, map, and drawer.
- Keep profile-wide assessment lifecycle (`current`, `processing`, `outdated`, `error`) separate from per-system score/readiness, observation freshness, and document-processing state.
- Add focused projection coverage for canonical, missing, legacy, malformed, queued, processing, succeeded, retryable-failed, and failed combinations, including retention of the last completed profile during updates and failures.
- Preserve the existing response fields, HTTP authorization/no-store behavior, immutable assessment payloads, assessment-job/version persistence, and all EH-123/EH-144/EH-146 observable semantics.

No breaking API, scoring, readiness, migration, persistence, or RPC changes are intended.

## Capabilities

### New Capabilities

- `health-profile-assessment-read-projection`: canonical, pure projection of persisted/fallback assessment data and profile-wide lifecycle metadata for API and client consumption.

### Modified Capabilities

- `health-profile-api`: make the existing assessment lifecycle metadata contract explicit and require one consistent persisted-versus-fallback interpretation without changing the endpoint shape or score/readiness payload.

## Impact

- **Target domain:** `health-profile`; dashboard consumption also touches `auth-shell` surfaces.
- **Application code:** `src/app/api/health-profile/route.ts`, a new assessment-read projection module, `src/app/app/profile/page.tsx`, `src/app/app/page.tsx`, and shared assessment metadata types.
- **Consumers:** `OverallAssessmentCard`, `BodyMap`, `HealthProfileDrawer`, and the dashboard health-assessment widget continue receiving narrowed lifecycle state/error props; per-system readiness and freshness logic remain local to their existing contracts.
- **API:** `GET /api/health-profile` keeps its current fields, authentication, `Cache-Control: no-store`, fallback behavior, and lifecycle values.
- **Persistence:** no database schema, RPC, job, version, receipt, or payload changes.
- **Verification:** focused pure projection/state-matrix checks plus existing EH-123, EH-144, EH-146, drawer, API, and UI regression coverage.
