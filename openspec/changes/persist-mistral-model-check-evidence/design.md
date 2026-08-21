## Context

The document worker already calls `models.list` from `ensureWorkerAiReady` when Mistral OCR is enabled. `verifyMistralOcrModel` checks the configured region's catalog for the configured model, but it returns no evidence and stores no result. The existing `ai_invocations` table is document/profile-scoped and therefore is not suitable for a worker-global startup check.

The change crosses the worker startup boundary, Supabase migrations, disposable database contracts, and EH-163 release evidence. The check must remain independent of document processing and must never capture patient data, API keys, raw catalog payloads, or provider error bodies.

## Goals / Non-Goals

**Goals:**

- Persist every enabled-Mistral startup model check as an append-only, service-only record.
- Distinguish a successful catalog request with the requested model present from a provider failure or a missing model.
- Return a sanitized evidence object to the startup caller and print only that object in a one-line startup log.
- Fail worker readiness when either the regional check fails or its evidence cannot be persisted.
- Provide a worker-only operator command that executes the same check without downloading or processing a document.
- Make the record queryable for a deployment reviewer to attach to EH-163.

**Non-Goals:**

- Persisting the full `models.list` response or a model catalog snapshot.
- Adding a client-facing readiness API or UI.
- Changing OCR selection, OCR request construction, document provenance, or review gates.
- Automatically retrying document OCR jobs.
- Treating a successful model check as privacy, legal, ZDR, training-control, or clinical-quality approval.

## Decisions

### 1. Use a dedicated readiness-evidence table

Add `public.ai_provider_model_checks` rather than extending `ai_invocations`. Startup checks have no profile or document, while `ai_invocations` requires both a profile and document-scoped semantics. The new table records only provider-readiness metadata and is restricted to `service_role`.

Each row contains `provider`, `region`, `requested_model`, `model_present`, `success`, nullable stable `error_code`, `latency_ms`, `worker_instance_id`, `adapter_version`, and `checked_at`. The table has no response-body, API-key, document, or patient identifier columns.

The table grants `SELECT` and `INSERT` only to `service_role`; public, anonymous, and authenticated roles receive no access. Update/delete privileges are not granted, and a mutation guard trigger rejects direct updates/deletes so the evidence remains append-only even if grants are changed later.

### 2. Persist both success and failure

`verifyMistralOcrModel` builds one sanitized evidence object for every attempted `models.list` call. A missing configured model becomes a failed check with stable `ocr_provider_unavailable`; an SDK/network failure is mapped through the existing privacy-safe error mapper. The record is inserted before the function returns or rethrows the stable provider error.

If persistence fails, readiness fails with a fixed non-provider message. The worker must not claim ready while the required audit record is missing.

### 3. Keep the verification boundary injectable

The verifier accepts an optional evidence recorder for deterministic tests. Production uses a Supabase recorder; tests use an in-memory recorder and fake Mistral client. This avoids live API calls and avoids network calls from unit tests while preserving the production startup path.

The verifier returns the sanitized record on success. `ensureWorkerAiReady` logs only provider, region, requested model, model-presence, success, check timestamp, and stable error code. No model catalog IDs, raw SDK error text, request headers, or secrets are logged.

### 4. Add a worker-only operational command

Add `pnpm verify:eh163-model-check`, executed from the worker environment, which calls the same verifier and prints the sanitized result. The command does not process a document. A successful invocation creates the database evidence row that can be queried and copied into the QA checklist and EH-163 issue comment.

### Alternatives considered

- **Reuse `ai_invocations`:** rejected because startup has no profile/document and would corrupt document invocation semantics.
- **Store the complete model catalog:** rejected because it adds unnecessary provider metadata and makes release evidence noisier without proving more than `model_present`.
- **Only print a startup log:** rejected because logs are ephemeral and are not a durable audit record.
- **Block startup when evidence persistence fails:** selected because a missing release evidence record must not be silently treated as a successful readiness check.

## Risks / Trade-offs

- A new migration must be applied before an enabled worker can start; this is intentional fail-closed behavior and must be covered in deployment ordering.
- A temporary Supabase outage can prevent worker startup even when Mistral is reachable; this preserves the evidence contract but requires the existing worker supervisor to retry startup.
- The table records one row per startup/operator check and can grow over time. The append-only history is deliberate; retention/archival policy is outside this change.
- A successful `models.list` check proves endpoint/model availability only. The QA and Issue evidence must continue to list the independent privacy, legal, ZDR, training, corpus, and regression gates.
