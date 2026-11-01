## Context

Sprint 8 spans `auth-shell`, `documents`, `health-profile`, and `ai-config`. The repository already has profile-scoped documents, accepted structured findings, Registry 2.0 observations, medical-event dates, report evidence mappings, report citation validation, report safety rules, and privacy-safe `ai_invocations` metadata. It does not have an assistant request boundary, a semantic index, conversational evidence objects, beta access state, or assistant-specific quotas.

The implementation must preserve the existing report and extraction contracts. A document is eligible only when it is owned by the active session profile, active, upload-complete, and processed. Laboratory observations additionally pass the existing current-source and `structuredContextEligible` boundary. Narrative text is source evidence, not policy or instructions; retrieved text must be treated as untrusted context to prevent prompt injection.

The change is implemented on the isolated `feat/sprint-8-grounded-ai` branch in dependency order: EH-157 policy, EH-155 structured retrieval, EH-156 semantic retrieval, EH-158 evidence validation, EH-159 operations controls, EH-160 beta onboarding, and EH-161 release readiness.

## Goals / Non-Goals

**Goals:**

- Expose one authenticated assistant request boundary with explicit answer modes: verified personal facts, evidence-backed summaries, and general education.
- Make personal-data answers fail closed unless every personal claim points to an authorized source owned by the current profile.
- Reuse existing structured context and source-lifecycle rules rather than creating a parallel observation read model.
- Add profile-scoped semantic retrieval over page OCR and accepted narrative source text with page/document anchors, metadata filters, re-indexing, and RLS/service-role boundaries.
- Make safety policy deterministic around diagnosis, treatment, medication, dose, urgency, uncertainty, and unsupported claims before and after model generation.
- Enforce quotas atomically before expensive retrieval/generation and record privacy-safe request, retrieval, cost, latency, and error metadata.
- Add a beta surface that is inaccessible without an operator-set invite flag and current required consents, with a synthetic example path that never writes fake medical data.
- Provide release evidence artifacts and executable checks without claiming production readiness until the real restore, deletion, rollback, privacy, and incident exercises are recorded.

**Non-Goals:**

- No diagnosis, treatment plan, medication recommendation, dose adjustment, emergency triage, or clinician replacement behavior.
- No cross-profile search, shared semantic index, public assistant endpoint, or client-controlled profile/document scope.
- No automatic acceptance, correction, or mutation of observations from assistant output.
- No replacement of report citation validation, report schemas, holistic synthesis, or existing document extraction prompts.
- No vector search over unverified extracted laboratory staging rows; those remain review inputs, not verified assistant evidence.
- No free-form assistant memory or persistence of conversation transcripts; request text and model response text are not stored in telemetry.
- No production go/no-go claim from local code/tests alone.

## Decisions

### 1. One assistant response contract with server-owned evidence

The API returns a typed response containing `request_id`, `mode`, `answer`, `citations`, `limitations`, and `safety`. The model receives opaque source IDs plus source snapshots and can propose only claim objects that reference those IDs. The server resolves IDs from an in-memory authorized source map and removes/rejects claims with missing, stale, cross-profile, or out-of-scope sources.

This follows the report evidence pattern but uses a separate assistant contract and validator because conversational answers have different modes, claim shapes, and fallback semantics. Reusing the report schema directly would couple unrelated contracts and could accidentally allow report-only fields or question claims into the assistant.

**Alternatives rejected:** returning raw model prose (cannot prove personal claims); reusing report persistence (would create unnecessary report records and weaken the no-transcript requirement); trusting source IDs from the browser (authorization bypass).

### 2. Policy before retrieval, validator after generation

The safety module classifies each request into `personal_facts`, `grounded_summary`, or `general_education`, rejects or limits unsafe intents before retrieval, and supplies a fixed system policy. The response validator then checks answer mode, claim source IDs, source kind, profile/document scope, prohibited advice patterns, uncertainty language, and required disclaimer/limitations.

Retrieved document text is wrapped as quoted evidence and explicitly marked untrusted. It is never interpolated into the system policy. When the validator cannot prove a personal claim, it returns an insufficient-evidence answer with a safe limitation instead of guessing.

**Alternatives rejected:** prompt-only policy (not a security boundary); post-hoc keyword filtering alone (misses source/scope errors); letting the model decide whether evidence is sufficient (not deterministic).

### 3. Structured retrieval is the first evidence tier

EH-155 calls `buildDocumentStructuredContext(profileId)` and projects only its eligible rows into assistant sources. Filters are applied server-side for document type, date range, and canonical/analyte/measurement identifiers. The request may provide filters, but the server always intersects them with the current profile and active document set. The response marks structured sources as `verified_structured` and preserves source row/document IDs, dates, values, and document links.

This avoids duplicating Registry admission logic and ensures unresolved, superseded, archived, incomplete, or unprocessed records never become verified assistant facts.

**Alternatives rejected:** querying raw `observations` independently (would bypass current-source/Registry eligibility); querying extracted staging rows (unreviewed); serializing the whole structured context to the client (overexposure and no claim boundary).

### 4. Semantic retrieval uses pgvector with fixed model dimensions

EH-156 adds the `vector` extension and a profile/document/page-owned `assistant_document_chunks` table with `vector(1536)` embeddings, content hash, page/section metadata, and lifecycle timestamps. Chunking happens at page boundaries with bounded paragraph chunks and overlap. The production embedding model is configured by `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`) and uses the existing server-side OpenAI credential; the model and provider are recorded in index metadata, never in user-visible content.

The database RPC accepts `profile_id`, a query embedding, match count, threshold, and optional document/date/type filters. It repeats the active-document/profile predicates inside SQL, so callers cannot turn the RPC into a cross-profile lookup. Every returned chunk carries `document_id`, page number, chunk ID, content hash, and a bounded excerpt. Semantic sources are labeled `document_text` rather than verified structured facts.

A re-index request creates an `assistant_reindex_jobs` row. The worker claims and processes jobs, then publishes only the current document's chunks through a generation-fenced transaction after the source snapshot is read. A content hash and write generation make re-indexing idempotent; stale or failed publishes retain the previous index and record a safe error code.

**Alternatives rejected:** in-memory cosine search (does not scale or survive process restarts); lexical `ILIKE` search (does not meet semantic retrieval acceptance); embedding the entire document as one vector (poor page citations and large prompt payloads); a provider-specific opaque hosted index (authorization and deletion evidence are harder to prove).

### 5. Atomic quota reservation precedes expensive work

EH-159 adds a security-definer `reserve_assistant_request` RPC that locks a profile-scoped advisory key, counts recent request reservations, checks request and daily cost ceilings, and inserts a non-PHI reservation with a UUID request ID. The API returns `429` with a reset timestamp when the reservation is denied. Completion updates the same request event with retrieval counts, token counts, cost estimate, latency, provider/model, and outcome.

The request event stores no question, prompt, generated answer, OCR text, source excerpts, or document filenames. `ai_invocations` remains the canonical LLM-call metadata table and accepts the assistant stage/error codes; the assistant request event adds the feature-level retrieval and quota dimensions.

**Alternatives rejected:** in-process counters (lost on restart and race-prone); client-side limits (bypassable); logging raw requests for debugging (violates PII minimization).

### 6. Beta access is additive and explicit

The profile receives `closed_beta_enabled`, invitation/revocation timestamps, and a sample-data marker. Existing profile and consent gates remain unchanged for the rest of the app. The assistant route and page require both current required consents and the invite flag. The synthetic example path is deterministic, clearly labeled, never persisted, and cannot be mixed with personal sources.

Feedback is a separate server-owned table containing only request ID, rating/category, mode, and source counts. Analytics events contain feature and outcome metadata, not document content. The UI states the assistant limitation/disclaimer before the first request and provides a support contact from configuration.

**Alternatives rejected:** gating the entire app on beta access (would break existing users); storing fake observations in the health profile (unsafe contamination); free-form feedback text by default (unnecessary PHI channel).

### 7. Release readiness is evidence-backed, not inferred

EH-161 adds a checklist and verification script covering migrations, RLS, quota behavior, privacy-safe logging, retention/deletion integration, backup/restore, rollback, incident contacts, and known limitations. Local automation can verify code and schema invariants. Production-specific items remain `PENDING` until an operator records command output, timestamps, and sign-off. The branch must not claim a closed-beta go/no-go based solely on typecheck or unit tests.

## Risks / Trade-offs

- **Embedding provider availability:** semantic retrieval depends on a configured embedding model and vector extension. The assistant degrades to structured/general mode with an explicit limitation when the index is unavailable; it never silently presents semantic results as verified facts.
- **Embedding privacy and cost:** page text is sent to the configured embedding provider and incurs cost. The beta checklist requires AI consent, provider documentation, quotas, and PII-safe telemetry before enabling the flag.
- **Prompt injection in documents:** retrieved text is untrusted and may contain instructions. System-policy separation, source-ID-only claims, and post-generation validation reduce but do not eliminate model risk; prohibited-claim fixtures are required.
- **Database migration compatibility:** vector extension/RPC support must be verified in local and target Supabase environments before deployment. The release gate blocks beta enablement when the extension or function is unavailable.
- **Large profiles:** loading the full structured context is bounded by request limits and source caps; semantic retrieval uses SQL top-k. A later optimization may add narrower structured queries, but the first release keeps one canonical eligibility projection.
- **Deletion and re-index races:** document deletion must remove chunks and queued jobs through the durable deletion path. Re-index completion checks lifecycle and content hash before replacing rows, preventing stale chunks from returning after archive/delete.
- **Operational evidence gap:** local tests cannot prove production restore, retention, alert routing, or rollback. Those items remain explicit release blockers until executed by an operator.
