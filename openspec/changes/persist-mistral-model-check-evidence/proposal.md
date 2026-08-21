## Why

EH-163 verifies the configured Mistral regional model with `models.list` before the worker accepts OCR work, but the check currently disappears after startup. Deployment reviewers cannot prove which region and requested model were checked, when the check passed, or whether the selected model was present without relying on undocumented logs or a later document invocation. This change makes the startup check a privacy-safe, append-only release evidence record and exposes a repeatable operator command for attaching sanitized evidence to EH-163.

## What Changes

- Add a service-only, append-only store for Mistral `models.list` readiness checks.
- Persist only provider, regional endpoint, requested model, model-presence result, success, stable error code, latency, adapter version, worker instance, and timestamp; never persist API keys, raw catalog responses, document content, or provider error bodies.
- Make `verifyMistralOcrModel` return the sanitized check result, persist both successful and failed checks, and fail worker startup if the evidence cannot be recorded.
- Emit a one-line sanitized startup result and add a worker-only command that performs the check without processing a patient document.
- Add TypeScript and disposable database contract coverage for success, missing model, provider failure, privacy-safe fields, service-only access, and append-only behavior.
- Record the successful regional check in `QA/eh-163/checklist.md` and the EH-163 tracking issue without claiming that unrelated privacy, legal, corpus, or regression gates are complete.

## Capabilities

### New Capabilities

- `mistral-model-readiness-evidence`: Privacy-safe, append-only evidence for the regional Mistral model readiness check.

### Modified Capabilities

- None.

## Impact

- Worker startup now depends on both the Mistral readiness check and successful persistence of its sanitized evidence.
- A new Supabase migration and worker command are added; no client-facing API or document schema is changed.
- The existing OCR request path, source provenance, human-review gate, and Health Profile eligibility boundaries remain unchanged.
