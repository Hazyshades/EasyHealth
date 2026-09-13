## 1. Read projection contract

- [x] 1.1 Define shared assessment version, job, fallback, and metadata types.
- [x] 1.2 Extract canonical readiness and reported-results payload validation.
- [x] 1.3 Implement the pure persisted-versus-fallback read projection.
- [x] 1.4 Preserve the complete lifecycle truth table and metadata source precedence.
- [x] 1.5 Add direct fixtures for canonical, missing, legacy, malformed, and policy-incompatible payloads.

## 2. API integration

- [x] 2.1 Keep authentication, profile-scoped version/job/synthesis reads, and fallback snapshot I/O in the route adapter.
- [x] 2.2 Replace route-local payload selection and assessment metadata assembly with the read projection.
- [x] 2.3 Preserve the existing response fields, no-store headers, authorization boundary, and fallback behavior.
- [x] 2.4 Confirm worker, assessment version, job, receipt, and RPC contracts remain untouched.

## 3. Client consumption

- [x] 3.1 Share the assessment metadata response type across the profile page and dashboard.
- [x] 3.2 Remove profile-page lifecycle recomputation and consume the server-projected display state.
- [x] 3.3 Remove the dashboard current-state default from successful assessment responses.
- [x] 3.4 Preserve narrowed lifecycle props for cards, map, drawer, and dashboard widgets.
- [x] 3.5 Keep system readiness, observation freshness, and document-processing logic on separate axes.

## 4. Verification

- [x] 4.1 Add a deterministic assessment-read state-matrix verifier for all version/job combinations.
- [x] 4.2 Verify retained persisted scores and metadata during queued, processing, and failed updates.
- [x] 4.3 Verify legacy and malformed payloads use fallback without exposing retired readiness shapes.
- [x] 4.4 Run `pnpm test:eh146` and `pnpm test:health-profile-drawer-status`.
- [x] 4.5 Run focused EH-123, EH-144, Health Profile API, and type checks; record any pre-existing blockers.

## 5. Cleanup and review

- [x] 5.1 Remove obsolete route/client interpretation helpers and imports after parity is proven.
- [x] 5.2 Review the diff for score/readiness, persistence, RPC, and API-shape drift.
- [x] 5.3 Validate this OpenSpec change strictly before implementation begins.

Implementation note: `pnpm typecheck` remains blocked by pre-existing `DocumentType` errors for `consultation_note` and `discharge_summary` in unrelated document and timeline files. Focused projection, EH-123, EH-144, EH-146, drawer-status, reported-results, and CI-coverage checks pass.
