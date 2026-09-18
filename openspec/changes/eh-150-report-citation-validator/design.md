# Design: eh-150-report-citation-validator

## Context

EH-148 defines a versioned report/evidence DTO, but generation-time parsing alone cannot prove that every citation belongs to the profile, remains in the selected scope, and resolves to a permitted source. EH-151 and EH-153 must not each implement a weaker copy of those checks.

## Goals / Non-Goals

**Goals:**

- Provide one deterministic validation module for generation, persistence, sharing, and export.
- Enforce source identity, profile ownership, report scope, allowed evidence kinds, and claim citation rules.
- Return an auditable result with sanitized content and structured issues.
- Fail closed for broken or cross-profile citations.

**Non-Goals:**

- Semantic clinical fact checking or free-form diagnosis detection beyond the closed EH-148 claim schema and explicit unsafe-field policy.
- Replacing the EH-148 schema or source projection.
- Authorizing a public token; share authentication remains EH-151.

## Decisions

### 1. Expose a pure validator with an authorized source adapter

Add `src/lib/report-citation-validator.ts`:

`validateReportContent(content, context) -> { status, content, version, issue_codes }`

`context` includes the report profile ID, the immutable document scope, and a batched source resolver that returns only rows already authorized for that profile. The pure core validates JSON shape, source relationships, and claim support against that server-authorized catalog; EH-148 then hands the sanitized result and the returned `version` unchanged to `public.create_validated_report`, whose database checks are the authoritative final identity/scope guard. Callers cannot pass an arbitrary cross-profile source catalog as proof.

EH-150 exports `CURRENT_VALIDATOR_VERSION = "eh150.v1"`, `RECOGNIZED_VALIDATOR_VERSIONS = ["eh150.v0", "eh150.v1"]`, and `isRecognizedValidatorVersion(version)`. New validation results always use the current version. A historical version remains accepted for read/share/export only while listed as recognized; retiring one requires an EH-154 release record, migration/revalidation decision, and removal from the compatibility list. Missing, unknown, or retired versions fail closed.

### 2. Validate four boundaries

The validator checks:

1. **Schema:** version, required sections, claim IDs, EH-148's closed claim-input contract, approved template IDs and exact template parameters, source IDs, citation shape, allowed source kinds, and rejection of diagnosis/treatment/urgency/imperative/free-form factual fields. Factual `text` is invalid input; only EH-148's server renderer may create it.
2. **Identity:** every source resolves to the claimed database row and profile; document ID matches the source row.
3. **Scope:** every cited document is in the persisted report scope; no null/implicit all-documents scope is accepted for a new report.
4. **Publication policy:** supported factual claims have at least one valid citation; unknown, broken, cross-profile, source-kind, or out-of-scope identity references are fatal `invalid` results, while uncited or unsafe-but-in-scope claim content may be sanitized into a `limited` result.

A source row that was later archived/removed while its parent document remains active may retain its historical snapshot; EH-148's `report-read.ts` resolver marks affected claims limited with `SOURCE_UNAVAILABLE` on owner/share/export reads and denies live/raw access. A source document that enters `deleting`/tombstoned state invalidates the complete report before owner/share/export reads, so no snapshot is exposed and the durable deletion path purges the report. Validation and read projection never widen authorization.

### 3. Sanitize unsupported claims deterministically

Identity/scope failures (`SOURCE_NOT_FOUND`, `PROFILE_MISMATCH`, `DOCUMENT_OUT_OF_SCOPE`, and `SOURCE_KIND_NOT_ALLOWED`) return `invalid` with stable issue codes and no persisted candidate; they are never downgraded by removing only the affected claim. A claim with no citation or an unsafe unsupported content shape may instead be removed from the publishable claim list and replaced by one machine-generated limitation. The original model text is not copied into the limitation, and a `removed` claim is never persisted or serialized. Non-factual `clinician_question` items may survive without citations when their `factual` flag is false; their model `question_text` is rendered only as a question. If sanitization removes an entire required section, validation fails closed.

The result statuses are `valid`, `limited`, and `invalid`. `limited` is publishable only when all remaining factual claims are valid and the limitations are visible. `invalid` cannot be persisted as a shareable/exportable report.

### 4. Keep issue codes stable and non-sensitive

Issue codes include `SCHEMA_INVALID`, `SOURCE_NOT_FOUND`, `PROFILE_MISMATCH`, `DOCUMENT_OUT_OF_SCOPE`, `SOURCE_KIND_NOT_ALLOWED`, `CLAIM_UNCITED`, `SOURCE_UNAVAILABLE`, and `UNSAFE_CONTENT`. Logs contain codes and internal request IDs only; source text, token material, and health values are excluded.

### 5. Integrate through EH-148's generation boundary

EH-150 owns the pure validator, its closed-template fixtures, and the version policy. EH-148 owns the closed template catalog/renderer, service-only `createValidatedReport`, `public.create_validated_report` RPC, `report-read.ts` lifecycle resolver, and nullable legacy-compatible `validation_status`, `validation_version`, and `validation_issue_codes` columns. EH-150 returns `status`, the exact non-empty `version`, sanitized content, and stable issue codes; EH-148 persists that version unchanged, maps the result into the immutable validation envelope, and runs the RPC after the server-authorized source catalog, exact report scope, and any scope-constrained dynamics extension are ready. The `SECURITY DEFINER` RPC rechecks identity/scope/mappings while atomically writing report content, optional dynamics extension, validation envelope, and evidence mapping. Any RPC or persistence failure rolls back. EH-151 and EH-153 consume EH-148's read projection and do not choose independent validation fields or parse `reports.content` ad hoc.

## Risks / Trade-offs

- Database lookups add latency at generation. Batch source resolution by source IDs and document IDs; do not make one query per claim.
- A source can be deleted after validation. Persist the snapshot, re-check authorization for links/downloads, and expose the limitation.
- Sanitization can remove useful model prose. That is safer than publishing an uncited health claim; the limitation tells the user why content is absent.
- A valid citation does not prove clinical correctness. Documentation and UI copy must not overstate the validator's guarantee.
