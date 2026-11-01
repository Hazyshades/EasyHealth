## Why

EasyHealth already has verified health-profile data, document extraction, reports, and AI invocation telemetry, but it has no conversational assistant that can retrieve those facts, cite their sources, and enforce medical-safety boundaries. Sprint 8 closes that gap and creates a controlled closed-beta path where assistant answers are grounded in the signed-in user's active profile, observable, rate-limited, and releasable only after privacy and recovery checks.

## What Changes

- Add a server-side grounded assistant contract with explicit answer modes for verified personal facts, generated summaries, and general health education.
- Add deterministic structured retrieval over active, processed, profile-owned observations and accepted document findings, with date/type/measurement filters and source payloads.
- Add semantic retrieval over profile-owned narrative document chunks with page/section anchors, metadata filters, permissions, embeddings, similarity search, and re-indexing.
- Add claim-to-source validation and user-visible citations; personal-data claims without valid evidence become an explicit insufficient-evidence response.
- Add assistant medical-safety controls that prohibit diagnosis, prescriptions, dose changes, invented facts, and unsupported certainty, including medication-specific safeguards and refusal language.
- Add per-user assistant limits, token/cost/latency and retrieval telemetry, error taxonomy, PII-safe logs, feedback events, and operational alerts.
- Add a closed-beta invite gate, consent and disclaimer presentation, safe sample-data path, feedback capture with category and support contact, and privacy-preserving analytics events.
- Add the production closed-beta release gate covering retention, backup/restore, deletion/export, incident response, rollback, release notes, and signed go/no-go evidence.
- No existing report, document, profile, or extraction behavior is removed; assistant access is an additional capability behind the beta/release gates.

## Capabilities

### New Capabilities

- `grounded-assistant-safety`: Answer modes, medical-safety policy, refusal behavior, and assistant request contract. (ai-config, health-profile)
- `structured-assistant-retrieval`: Profile-scoped retrieval over verified structured health data. (health-profile, documents)
- `semantic-document-retrieval`: Profile-scoped narrative chunking, embeddings, filtered similarity search, and re-indexing. (documents)
- `assistant-evidence`: Claim/source validation, citation payloads, rendering, and insufficient-evidence fallback. (health-profile, documents)
- `ai-operations-controls`: Assistant rate limits, cost/latency/retrieval telemetry, error taxonomy, and PII-safe operational logging. (ai-config)
- `closed-beta-onboarding`: Invite gating, beta consent/disclaimers, sample data, feedback, and analytics. (auth-shell, health-profile)
- `closed-beta-release-readiness`: Production release checklist, recovery evidence, rollback, incident contacts, and go/no-go record. (auth-shell, ai-config, documents)

### Modified Capabilities

- `ai-invocation-observability`: Extend invocation metadata and operational events to assistant retrieval/generation without storing raw prompts, responses, or sensitive document text.
- `user-onboarding`: Add the closed-beta invite gate and beta-specific onboarding completion state after existing profile and consent gates.
- `document-structured-insights`: Expose accepted structured document findings through the assistant retrieval source contract while preserving document ownership and lifecycle filters.
- `health-profile-api`: Add an authenticated assistant request boundary that never crosses profile scope and returns evidence-bearing answer objects.

## Impact

- Affected domains: `auth-shell`, `documents`, `health-profile`, and `ai-config`.
- Affected specs: `ai-invocation-observability`, `user-onboarding`, `document-structured-insights`, and `health-profile-api`; new capability specs listed above.
- Affected implementation areas: Supabase migrations/RPCs and RLS, Next.js assistant API/UI, document processing/indexing, AI provider routing, telemetry, onboarding, and release evidence.
- Existing report citation and safety validators can inform the assistant boundary, but the assistant requires separate conversational claim validation and must not weaken report contracts.
- The capability is not release-ready until the final release gate has executed evidence for privacy, deletion, restore, rollback, limits, and known limitations.
