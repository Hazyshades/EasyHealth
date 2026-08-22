## 1. Persistence and access

- [x] 1.1 Add a Supabase migration for the service-only `ai_provider_model_checks` append-only table with privacy-safe columns, regional/model checks, indexes, grants, and mutation protection.
- [x] 1.2 Extend the EH-163 database contract test with readiness-row privacy, service-role access, insert, and append-only assertions.

## 2. Worker readiness

- [x] 2.1 Add the sanitized Mistral model-check type and recorder boundary without storing raw catalog or provider error data.
- [x] 2.2 Refactor `verifyMistralOcrModel` to persist success and failure evidence, return the sanitized success record, and fail closed when evidence persistence fails.
- [x] 2.3 Emit a sanitized startup readiness line and add the worker-only `verify:eh163-model-check` operator command.

## 3. Automated coverage and release evidence

- [x] 3.1 Extend the deterministic Mistral contract script for model-present, model-absent, provider-failure, persistence-failure, and no-sensitive-output cases.
- [x] 3.2 Run the worker model-check command with the configured regional environment, record the sanitized result in `QA/eh-163/checklist.md`, and attach the same evidence to EH-163 Issue #153 without marking unrelated release gates complete.
- [x] 3.3 Run focused TypeScript, worker contract, database, and strict OpenSpec validation; record any remaining EH-163 blockers.
