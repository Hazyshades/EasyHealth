## 1. Safety policy and contracts

- [x] 1.1 Add assistant answer modes, request schema, response schema, and limitation codes
- [x] 1.2 Implement request safety classification and prohibited clinical-intent handling
- [x] 1.3 Implement fixed assistant system policy with untrusted-evidence framing
- [x] 1.4 Implement post-generation answer safety validation and safe refusal fallback
- [x] 1.5 Add EH-157 safety fixtures for diagnosis, medication, dose, uncertainty, and prompt injection

## 2. Structured retrieval

- [x] 2.1 Add assistant source types and opaque source-id projection
- [x] 2.2 Implement structured intent parsing and bounded server-side filters
- [x] 2.3 Project eligible observations and accepted document findings through existing context boundaries
- [x] 2.4 Add EH-155 structured retrieval verification fixtures and cross-profile cases

## 3. Semantic document retrieval

- [x] 3.1 Add vector extension, chunk, embedding, and re-index job migrations
- [x] 3.2 Implement page-aware narrative chunking and content hashing
- [x] 3.3 Implement configured embedding provider adapter and privacy-safe embedding telemetry
- [x] 3.4 Implement idempotent re-index job claim, publish, retry, and stale-source handling
- [x] 3.5 Implement profile-scoped pgvector match RPC and semantic source projection
- [x] 3.6 Add EH-156 semantic retrieval and deletion-isolation database fixtures

## 4. Assistant API and evidence

- [x] 4.1 Implement authenticated assistant service pipeline and request boundary
- [x] 4.2 Implement claim-to-source validation, citation routes, and coverage metadata
- [x] 4.3 Add assistant API route with safe status and error responses
- [x] 4.4 Add assistant page, answer view, citations, limitations, and feedback controls
- [x] 4.5 Verify assistant UI states, keyboard flow, responsive layout, and copy

## 5. Operations and quotas

- [x] 5.1 Add atomic assistant quota, request event, and feedback migrations
- [x] 5.2 Extend AI invocation stages and safe assistant error-code constraints
- [x] 5.3 Wire request reservations, usage metrics, retrieval metrics, and cost estimates
- [x] 5.4 Implement assistant feedback endpoint with controlled categories
- [x] 5.5 Add operator documentation for limits, privacy-safe logs, alerts, and provider costs
- [x] 5.6 Add EH-159 quota, telemetry, PII, and feedback verification fixtures

## 6. Closed-beta onboarding

- [x] 6.1 Add profile invite, revocation, and synthetic-example state fields
- [x] 6.2 Enforce invite and current-consent checks without blocking the existing app
- [x] 6.3 Add deterministic synthetic example path without profile data writes
- [x] 6.4 Add beta onboarding copy, disclaimers, support contact, and feedback flow
- [x] 6.5 Add EH-160 manual QA checklist with safe data and product-interface steps

## 7. Release readiness

- [x] 7.1 Integrate assistant chunks and jobs with durable document deletion
- [x] 7.2 Add release checklist, rollback/restore evidence template, and known limitations
- [x] 7.3 Add executable EH-161 release readiness verification
- [x] 7.4 Add EH-155 through EH-161 QA checklist coverage and developer evidence sections

## 8. Verification and delivery

- [x] 8.1 Run focused safety, retrieval, citation, quota, onboarding, and release checks
- [x] 8.2 Run typecheck, worker typecheck, build, and relevant database contracts
- [x] 8.3 Exercise the assistant through the running app and record UI evidence
- [x] 8.4 Review OpenSpec status and unresolved production gates
- [x] 8.5 Commit and push the isolated Sprint 8 branch
