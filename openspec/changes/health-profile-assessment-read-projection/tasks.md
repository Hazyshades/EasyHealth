## 1. Read projection contract

- [ ] 1.1 Define shared assessment version, job, fallback, and metadata types.
- [ ] 1.2 Extract canonical readiness and reported-results payload validation.
- [ ] 1.3 Implement the pure persisted-versus-fallback read projection.
- [ ] 1.4 Preserve the complete lifecycle truth table and metadata source precedence.
- [ ] 1.5 Add direct fixtures for canonical, missing, legacy, malformed, and policy-incompatible payloads.

## 2. API integration

- [ ] 2.1 Keep authentication, profile-scoped version/job/synthesis reads, and fallback snapshot I/O in the route adapter.
- [ ] 2.2 Replace route-local payload selection and assessment metadata assembly with the read projection.
- [ ] 2.3 Preserve the existing response fields, no-store headers, authorization boundary, and fallback behavior.
- [ ] 2.4 Confirm worker, assessment version, job, receipt, and RPC contracts remain untouched.

## 3. Client consumption

- [ ] 3.1 Share the assessment metadata response type across the profile page and dashboard.
- [ ] 3.2 Remove profile-page lifecycle recomputation and consume the server-projected display state.
- [ ] 3.3 Remove the dashboard current-state default from successful assessment responses.
- [ ] 3.4 Preserve narrowed lifecycle props for cards, map, drawer, and dashboard widgets.
- [ ] 3.5 Keep system readiness, observation freshness, and document-processing logic on separate axes.

## 4. Verification

- [ ] 4.1 Add a deterministic assessment-read state-matrix verifier for all version/job combinations.
- [ ] 4.2 Verify retained persisted scores and metadata during queued, processing, and failed updates.
- [ ] 4.3 Verify legacy and malformed payloads use fallback without exposing retired readiness shapes.
- [ ] 4.4 Run `pnpm test:eh146` and `pnpm test:health-profile-drawer-status`.
- [ ] 4.5 Run focused EH-123, EH-144, Health Profile API, and type checks; record any pre-existing blockers.

## 5. Cleanup and review

- [ ] 5.1 Remove obsolete route/client interpretation helpers and imports after parity is proven.
- [ ] 5.2 Review the diff for score/readiness, persistence, RPC, and API-shape drift.
- [ ] 5.3 Validate this OpenSpec change strictly before implementation begins.
